import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCanvasAssignments, CANVAS_ORIGIN } from '../src/parsers/canvas.js';
import { fetchCanvasAssignments } from '../src/clients/canvas.js';
import { run } from '../src/main.js';

const assignment = (id = 1) => ({ id, course_id: 99, name: `Example assignment ${id}`,
  due_at: '2099-11-05T02:00:00Z', unlock_at: '2099-11-01T02:00:00Z', lock_at: '2099-11-06T02:00:00Z',
  html_url: `${CANVAS_ORIGIN}/courses/99/assignments/${id}`, submission_types: ['online_upload'],
  is_quiz_assignment: false, locked_for_user: false, has_submitted_submissions: true,
  description: 'PRIVATE_DESCRIPTION', secure_params: 'PRIVATE_SECRET',
  submission: { workflow_state: 'unsubmitted', submitted_at: null, grade: 'PRIVATE_GRADE', user_id: 12345 } });
const reply = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers }
});

test('Canvas uses personal submission state and separates due/unlock/lock without leaking extras', () => {
  const value = assignment();
  const [task] = parseCanvasAssignments([value], 99);
  assert.equal(task.submissionState, 'unsubmitted');
  assert.notEqual(task.dueAt, task.lockAt);
  assert.notEqual(task.dueAt, task.unlockAt);
  assert.equal(task.dueAt, '2099-11-05T02:00:00.000Z');
  assert.ok(!JSON.stringify(task).includes('PRIVATE'));
  delete value.submission;
  assert.equal(parseCanvasAssignments([value], 99)[0].submissionState, 'unknown');
  value.due_at = null;
  value.is_quiz_assignment = true;
  assert.equal(parseCanvasAssignments([value], 99)[0].type, 'quiz');
  assert.equal(parseCanvasAssignments([value], 99)[0].dueAt, null);
  value.name='Example external homework (This only serves as a reminder)';
  value.is_quiz_assignment=false;
  value.submission_types=['none'];
  const reminder=parseCanvasAssignments([value],99)[0];
  assert.equal(reminder.reminderOnly,true);
  assert.equal(reminder.submissionStateScope,'canvas-record-only');
  assert.deepEqual(reminder.submissionTypes,['none']);
});

test('Canvas rejects wrong courses, malformed dates, duplicate IDs, and untrusted task URLs', () => {
  for (const edit of [
    a => { a.course_id = 100; }, a => { a.id = 0; },
    a => { a.due_at = '2099-02-30T02:00:00Z'; },
    a => { a.due_at = '2099-01-01T26:00:00Z'; },
    a => { a.due_at = 'Nov 5 at 10am'; },
    a => { a.html_url = 'https://example.com/collect'; },
    a => { a.html_url += '?access_token=PRIVATE_SECRET'; }
  ]) {
    const value = assignment(); edit(value);
    assert.throws(() => parseCanvasAssignments([value], 99), e => e.code === 'UPSTREAM_FORMAT' && !e.message.includes('PRIVATE'));
  }
  assert.throws(() => parseCanvasAssignments([assignment(), assignment()], 99), e => e.code === 'UPSTREAM_FORMAT');
});

test('Canvas HTTP follows bounded same-course pagination with read-only requests', async () => {
  const calls = [];
  const result = await fetchCanvasAssignments(99, { token: 'fake-test-token', fetchImpl: async (url, options) => {
    calls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fake-test-token');
    assert.ok(options.signal instanceof AbortSignal);
    return calls.length === 1 ? reply([assignment(1)], { link: `<${CANVAS_ORIGIN}/api/v1/courses/99/assignments?page=2&per_page=20&include%5B%5D=submission>; rel="next"` }) : reply([assignment(2)]);
  } });
  assert.equal(calls.length, 2);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.pagination.complete, true);
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  let count = 0;
  const limited = await fetchCanvasAssignments(99, { token: 'fake', maxPages: 1, fetchImpl: async () => {
    count++; return reply([assignment()], { link: `<${CANVAS_ORIGIN}/api/v1/courses/99/assignments?page=2>; rel="next"` });
  } });
  assert.equal(count, 1);
  assert.equal(limited.pagination.complete, false);
});

test('Canvas never forwards authorization to foreign pagination destinations', async () => {
  for (const target of [
    'https://example.com/api/v1/courses/99/assignments?page=2',
    `${CANVAS_ORIGIN}/api/v1/courses/100/assignments?page=2`,
    `${CANVAS_ORIGIN}/api/v1/courses/99/assignments?access_token=PRIVATE_SECRET`,
    `${CANVAS_ORIGIN}/api/v1/courses/99/assignments?page=2#PRIVATE_SECRET`
  ]) {
    let calls = 0;
    await assert.rejects(fetchCanvasAssignments(99, { token: 'fake', fetchImpl: async () => {
      calls++; return reply([assignment()], { link: `<${target}>; rel="next"` });
    } }), e => e.code === 'UPSTREAM_FORMAT' && !e.message.includes('PRIVATE_SECRET'));
    assert.equal(calls, 1);
  }
});

test('Canvas classifies auth/permission/rate/network/format failures without echoing response bodies', async () => {
  let called = false;
  await assert.rejects(fetchCanvasAssignments(99, { fetchImpl: async () => { called = true; } }), e => e.code === 'AUTH_REQUIRED');
  assert.equal(called, false);
  for (const [status, code] of [[401,'AUTH_REQUIRED'],[403,'FORBIDDEN'],[429,'RATE_LIMITED'],[500,'UPSTREAM_ERROR']]) {
    await assert.rejects(fetchCanvasAssignments(99, { token: 'fake', fetchImpl: async () => reply('PRIVATE_BODY', {}, status) }), e => e.code === code && !e.message.includes('PRIVATE'));
  }
  await assert.rejects(fetchCanvasAssignments(99, { token: 'fake', fetchImpl: async () => { throw new Error('PRIVATE_ERROR'); } }), e => e.code === 'NETWORK_ERROR' && !e.message.includes('PRIVATE'));
  await assert.rejects(fetchCanvasAssignments(99, { token: 'fake', fetchImpl: async () => new Response('<html>PRIVATE</html>') }), e => e.code === 'UPSTREAM_FORMAT');
  await assert.rejects(fetchCanvasAssignments(99, { token: 'fake', fetchImpl: async () => new Response('x'.repeat(2*1024*1024+1), { headers: { 'content-type':'application/json' } }) }), e => e.code === 'UPSTREAM_FORMAT');
});

test('Canvas CLI filters captured tasks and reports incomplete coverage and snapshot freshness', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hkustgz-canvas-'));
  try {
    const path = join(directory, 'canvas.json');
    const tasks = [assignment(1), assignment(2), assignment(3), assignment(4)];
    tasks[1].due_at = '2000-01-01T00:00:00Z';
    tasks[2].due_at = null; tasks[2].submission_types = ['external_tool'];
    tasks[3].is_quiz_assignment = true; tasks[3].submission.workflow_state = 'graded';
    await writeFile(path, JSON.stringify({ schemaVersion:1, source:'canvas', kind:'assignments-api', courseId:99,
      sourceUrl:`${CANVAS_ORIGIN}/api/v1/courses/99/assignments?per_page=20&include%5B%5D=submission`,
      capturedAt:new Date().toISOString(), pagination:{page:1,perPage:20,complete:false}, assignments:tasks }));
    const args = ['lms','deadlines','--source','canvas','--course','99','--snapshot',path];
    const result = await run([...args,'--upcoming','--unsubmitted']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.payload.data.tasks.length, 1);
    assert.equal(result.payload.data.tasks[0].id, 1);
    assert.equal(result.payload.data.undatedCount, 1);
    assert.equal(result.payload.data.liveChecked, false);
    assert.equal(result.payload.data.pagination.complete, false);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal((await run([...args,'--type','quiz'])).payload.data.tasks[0].id, 4);
    for (const params of [ ['--course','0'], ['--course','1.5'], ['--source','classviva'], ['--type','unknown'] ]) {
      const base = ['lms','deadlines','--source','canvas','--course','99'];
      const index = base.indexOf(params[0]); if (index !== -1) base.splice(index, 2);
      assert.equal((await run([...base,...params])).exitCode, 2);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Canvas executable reports missing local credentials as exit code 3 without network access', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../src/cli.js', import.meta.url)),
    'lms','deadlines','--source','canvas','--course','99'], {
    encoding:'utf8', env:{...process.env, HKUSTGZ_CANVAS_TOKEN:''}
  });
  assert.equal(result.status, 3);
  assert.equal(JSON.parse(result.stdout).error.code, 'AUTH_REQUIRED');
  assert.equal(result.stderr, '');
});
