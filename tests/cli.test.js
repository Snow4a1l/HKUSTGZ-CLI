import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from '../src/main.js';
import { loadIndex, searchIndex } from '../src/lib/index.js';

test('lost-card question returns official entry and explicitly limited evidence', async () => {
  const { exitCode, payload } = await run(['service', 'search', '校园卡丢了，补办要去哪个网站？']);
  assert.equal(exitCode, 0);
  const [record] = payload.data.results;
  assert.equal(record.id, 'campus-card-replacement-student');
  assert.equal(record.entryType, 'service-form');
  assert.equal(record.loginRequired, true);
  assert.equal(record.navigationVerified, true);
  assert.deepEqual(record.fee, { amount: 20, currency: 'CNY', description: '每张校园卡补办工本费；未支付。' });
  assert.equal(record.processingTime.consistent, false);
  assert.equal(new URL(record.entryUrl).hostname, 'onestop-online.hkust-gz.edu.cn');
  assert.equal(record.materials, null);
  assert.equal(payload.data.liveChecked, false);
  assert.ok(record.matchedFields.some(match => match.field === 'aliases'));
  assert.ok(record.evidence.every(item => ['official-quote', 'source-summary'].includes(item.type)));
});

test('English matching ignores case and punctuation', async () => {
  const { records } = await loadIndex('service');
  assert.equal(searchIndex(records, 'Where can I get a CAMPUS CARD REPLACEMENT?')[0].id, records[0].id);
});

test('no match is honest about limited coverage', async () => {
  const { payload } = await run(['service', 'search', '不存在的火星通行证']);
  assert.deepEqual(payload.data.results, []);
  assert.match(payload.data.message, /当前索引/);
});

test('document body matches disclose summary and section', async () => {
  const { payload } = await run(['document', 'search', 'validation period']);
  const record = payload.data.results[0];
  assert.equal(record.id, 'sis-pre-enrollment-ug');
  assert.equal(record.fullTextIndexed, false);
  assert.equal(record.textType, 'source-summary');
  assert.ok(record.matchedFields.some(match => match.field === 'text'));
  assert.equal(record.publishedAt, null);
  assert.ok(record.section);
});

test('invalid arguments and unknown records have stable error codes', async () => {
  const cases = [
    ['service', 'search'], ['document', 'show', 'a', 'b'],
    ['service', 'search', '补卡', '--limit', '0'],
    ['service', 'search', '补卡', '--limit', '1.5'],
    ['service', 'search', '补卡', '--limit', '51'],
    ['service', 'search', '补卡', '--limit', '1e1'],
    ['service', 'search', '补卡', '--unknown'],
    ['service', 'search', '，。'], ['doctor'], ['course', 'list', '--source', 'other']
  ];
  for (const args of cases) {
    const result = await run(args);
    assert.equal(result.exitCode, 2, JSON.stringify(args));
    assert.equal(result.payload.error.code, 'INVALID_ARGUMENT');
  }
  const missing = await run(['service', 'show', 'missing']);
  assert.equal(missing.exitCode, 4);
  assert.equal(missing.payload.error.code, 'NOT_FOUND');
});

test('offline diagnostics do not call fetch or assert a session', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network forbidden in this test'); };
  try {
    const result = await run(['doctor', '--offline']);
    assert.equal(result.exitCode, 0);
    assert.equal(result.payload.data.networkChecked, false);
    assert.equal(result.payload.data.sessionChecked, false);
    assert.deepEqual(result.payload.data.indexes.map(index=>index.kind), ['service','document','catalog','program']);
    const status = await run(['auth', 'status']);
    assert.equal(status.payload.data.authenticated, null);
    for (const source of ['sisn', 'klms']) {
      const courses = await run(['course', 'list', '--source', source]);
      assert.equal(courses.exitCode, 4);
      assert.equal(courses.payload.error.code, 'NOT_IMPLEMENTED');
      assert.equal(courses.payload.data, undefined);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('executable emits exactly one JSON envelope and preserves exit code from another cwd', () => {
  const cli = new URL('../src/cli.js', import.meta.url);
  for (const [args, code] of [[['service', 'show', 'campus-card-replacement-student'], 0], [['bad'], 2]]) {
    const result = spawnSync(process.execPath, [fileURLToPath(cli), ...args], {
      cwd: process.env.TEMP ?? process.cwd(), encoding: 'utf8'
    });
    assert.equal(result.status, code, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim().split('\n').length, 1);
    assert.equal(JSON.parse(result.stdout).ok, code === 0);
  }
});
