import { readSnapshot } from '../lib/snapshot.js';
import { parseSisnOverview } from '../parsers/sisn.js';

export async function listSnapshotCourses(path, day) {
  const snapshot = await readSnapshot(path);
  const all = parseSisnOverview(snapshot);
  const courses = day === undefined ? all : all.filter(course => course.day === Number(day));
  const ageSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(snapshot.capturedAt)) / 1000));
  return { source: 'sisn', sourceUrl: snapshot.sourceUrl, term: snapshot.term, view: snapshot.view,
    includeWaitlisted: snapshot.includeWaitlisted, capturedAt: snapshot.capturedAt, ageSeconds,
    retrieval: 'browser-dom-snapshot', snapshotProvenance: 'caller-supplied', liveChecked: false,
    timezone: 'Asia/Shanghai', scope: 'displayed-time-slots-overview', totalOccurrences: all.length,
    courses, warnings: [
      'CLI parses a supplied snapshot; it does not verify the current login or refresh the page.',
      'Date ranges and weekdays describe the displayed overview, not confirmed occurrences on every date; holidays and exceptions are unverified.',
      ...(all.length === 0 ? ['No course cards were captured; this does not confirm an empty enrollment.'] : []),
      ...(courses.some(course => course.missingFields.length) ? ['Some cards omit fields; expand them in Browser to read details. Missing values are not inferred.'] : [])
    ] };
}
