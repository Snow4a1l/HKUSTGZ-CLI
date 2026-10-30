import { CliError } from '../lib/errors.js';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const invalid = () => { throw new CliError('SNAPSHOT_INVALID', 'SISN snapshot does not match the supported calendar view.', 'Refresh the Time Slots Overview using the Browser workflow in docs/BROWSER_COURSES.md.'); };
const dateValid = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const timeValid = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function parseSisnOverview(snapshot) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.source !== 'sisn' ||
      snapshot.view !== 'time-slots-overview' || snapshot.sourceUrl !== 'https://sisn.hkust-gz.edu.cn/system/my-calendar' ||
      typeof snapshot.term !== 'string' || !snapshot.term.trim() || snapshot.term.length > 80 ||
      typeof snapshot.includeWaitlisted !== 'boolean' ||
      typeof snapshot.capturedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(snapshot.capturedAt) ||
      Number.isNaN(Date.parse(snapshot.capturedAt)) || new Date(snapshot.capturedAt).toISOString() !== snapshot.capturedAt ||
      Date.parse(snapshot.capturedAt) > Date.now() + 300000 ||
      !Array.isArray(snapshot.days) || snapshot.days.length !== 7) invalid();
  const courses = [];
  snapshot.days.forEach((day, index) => {
    if (!day || day.heading !== weekdays[index] || !Array.isArray(day.cards) || day.cards.length > 100) invalid();
    const seen = new Set();
    for (const card of day.cards) {
      if (typeof card !== 'string' || card.length > 10000) invalid();
      const lines = card.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const identity = /^([A-Z]{2,8}\d{4}[A-Z]?)\s*-\s*([A-Z]\d{2,3})$/.exec(lines.shift() ?? '');
      if (!identity || seen.has(`${identity[1]}-${identity[2]}`)) invalid();
      seen.add(`${identity[1]}-${identity[2]}`);
      let title = null;
      if (lines.length && !/^\d{4}-\d\d-\d\d - \d{4}-\d\d-\d\d$/.test(lines[0])) title = lines.shift();
      let startDate = null, endDate = null, startTime = null, endTime = null, location = null, instructors = [];
      if (lines.length) {
        const dates = /^(\d{4}-\d\d-\d\d) - (\d{4}-\d\d-\d\d)$/.exec(lines.shift());
        const times = /^(\d\d:\d\d) - (\d\d:\d\d)$/.exec(lines.shift() ?? '');
        if (!dates || !dates.slice(1).every(dateValid) || dates[1] > dates[2] ||
            !times || !times.slice(1).every(timeValid) || times[1] >= times[2] || lines.length > 2) invalid();
        [, startDate, endDate] = dates;
        [, startTime, endTime] = times;
        location = lines.shift() ?? null;
        instructors = (lines.shift() ?? '').split('|').map(value => value.trim()).filter(Boolean);
      }
      if (title !== null && startDate === null) invalid();
      const missingFields = [];
      if (title === null) missingFields.push('title');
      if (startDate === null) missingFields.push('dateRange');
      if (startTime === null) missingFields.push('time');
      if (location === null) missingFields.push('location');
      if (!instructors.length) missingFields.push('instructors');
      courses.push({ courseCode: identity[1], section: identity[2], title, day: index + 1,
        weekday: day.heading, startDate, endDate, startTime, endTime, location, instructors, missingFields });
    }
  });
  return courses;
}
