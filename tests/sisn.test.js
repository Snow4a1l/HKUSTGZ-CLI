import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSisnOverview } from '../src/parsers/sisn.js';
import { run } from '../src/main.js';

// Synthetic values in the observed DOM shape, not a personal timetable.
const fixture = () => ({ schemaVersion: 1, source: 'sisn', view: 'time-slots-overview',
  sourceUrl: 'https://sisn.hkust-gz.edu.cn/system/my-calendar', term: '2026-27 Fall',
  includeWaitlisted: false, capturedAt: '2026-10-01T00:00:00.000Z',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(heading => ({ heading, cards: [] })) });
const full = 'TEST1001 - L01\nExample Course\n2026-09-01 - 2026-12-07\n10:30 - 11:50\nExample Room\nExample, One | Example, Two';

test('SISN preserves separate sections, weekdays, and incomplete cards without inferring time', () => {
  const snapshot = fixture();
  snapshot.days[0].cards = [full, 'TEST1001 - T01'];
  snapshot.days[2].cards = [full.replace('Example Course\n', '')];
  const courses = parseSisnOverview(snapshot);
  assert.equal(courses.length, 3);
  assert.equal(courses[0].title, 'Example Course');
  assert.deepEqual(courses[0].instructors, ['Example, One', 'Example, Two']);
  assert.equal(courses[1].section, 'T01');
  assert.equal(courses[1].startTime, null);
  assert.ok(courses[1].missingFields.includes('time'));
  assert.equal(courses[2].day, 3);
  assert.equal(courses[2].title, null);
});

test('SISN rejects changed views, dates, times, duplicate cards, and partial weekday capture', () => {
  const edits = [
    s => { s.view = 'weekly-calendar'; },
    s => { s.sourceUrl += '?token=do-not-echo'; },
    s => { s.days.pop(); },
    s => { s.days[0].heading = 'Tue'; },
    s => { s.capturedAt = 'invalid'; },
    s => { s.capturedAt = '2099-01-01T00:00:00.000Z'; },
    s => { s.days[0].cards = ['unexpected content']; },
    s => { s.days[0].cards = [full, full]; },
    s => { s.days[0].cards = [full.replace('2026-09-01', '2026-02-30')]; },
    s => { s.days[0].cards = [full.replace('10:30 - 11:50', '25:30 - 26:50')]; },
    s => { s.days[0].cards = [full.replace('10:30 - 11:50', '11:50 - 10:30')]; },
    s => { s.days[0].cards = [full + '\nUnrecognized extra field']; }
  ];
  for (const edit of edits) {
    const snapshot = fixture(); edit(snapshot);
    assert.throws(() => parseSisnOverview(snapshot), error => error.code === 'SNAPSHOT_INVALID');
  }
});

test('course CLI reads local snapshot, filters day, reports age and rejects invalid inputs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hkustgz-sisn-'));
  try {
    const file = join(dir, 'snapshot.json');
    const snapshot = fixture();
    snapshot.days[0].cards = [full]; snapshot.days[2].cards = [full];
    await writeFile(file, JSON.stringify(snapshot));
    const result = await run(['course', 'list', '--source', 'sisn', '--snapshot', file, '--day', '3']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.payload.data.courses.length, 1);
    assert.equal(result.payload.data.courses[0].day, 3);
    assert.equal(result.payload.data.totalOccurrences, 2);
    assert.equal(result.payload.data.liveChecked, false);
    assert.equal(result.payload.data.retrieval, 'browser-dom-snapshot');
    assert.ok(result.payload.data.ageSeconds > 0);
    for (const args of [ ['--day', '0'], ['--day', '1.5'], ['--day', 'Monday'] ]) {
      assert.equal((await run(['course', 'list', '--source', 'sisn', '--snapshot', file, ...args])).exitCode, 2);
    }
    assert.equal((await run(['course', 'list', '--source', 'klms', '--snapshot', file])).exitCode, 2);
    await writeFile(file, '{invalid private content');
    const bad = await run(['course', 'list', '--source', 'sisn', '--snapshot', file]);
    assert.equal(bad.exitCode, 4);
    assert.equal(bad.payload.error.code, 'SNAPSHOT_INVALID');
    assert.ok(!JSON.stringify(bad).includes('private content'));
    await writeFile(file, 'x'.repeat(1024 * 1024 + 1));
    assert.equal((await run(['course', 'list', '--source', 'sisn', '--snapshot', file])).payload.error.code, 'SNAPSHOT_INVALID');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
