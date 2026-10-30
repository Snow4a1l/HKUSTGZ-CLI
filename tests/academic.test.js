import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../src/main.js';

test('program requirements preserve intake, PDF provenance and alternative-course rules', async () => {
  const list = await run(['program','list','--intake','2026-27']);
  assert.equal(list.exitCode, 0);
  assert.equal(list.payload.data.results.length, 10);
  const show = await run(['program','show','beng-ai','--intake','2026-27']);
  assert.equal(show.exitCode, 0);
  const data=show.payload.data;
  assert.equal(data.generalRequirements.minimumCredits, 120);
  assert.equal(data.graduationAuditImplemented, false);
  assert.equal(data.record.durationYears, 4);
  const requirements=data.record.curriculumRequirements;
  assert.equal(requirements.bodyRead, true);
  assert.equal(requirements.requiredMajorCredits, 85);
  assert.equal(requirements.fundamentalGroups.reduce((sum,group)=>sum+group.credits,0),21);
  assert.equal(requirements.majorRequiredCourses.reduce((sum,course)=>sum+course.credits,0),40);
  assert.equal(requirements.majorElectiveRule.courseCountRequired,8);
  assert.equal(requirements.majorElectiveCourses.length,23);
  assert.deepEqual(requirements.fundamentalGroups[0].courseCodes,['UFUG1601','UFUG1603']);
  assert.equal(requirements.fundamentalGroups[0].choose,1);
  assert.deepEqual(requirements.pagesRead,[1,2,3,4]);
  assert.equal(new URL(data.record.sourceUrl).hostname, 'pcc.hkust-gz.edu.cn');
  assert.equal(data.liveChecked, false);
  const search = await run(['program','list','--intake','2026-27','--search','人工智能专业']);
  assert.ok(search.payload.data.results.some(r=>r.id==='beng-ai'));
  const previous = await run(['program','list','--intake','2025-26']);
  assert.equal(previous.payload.data.results.length,9);
  assert.ok(!previous.payload.data.results.some(r=>r.baseId==='beng-nsee'));
  const previousAi = await run(['program','show','beng-ai','--intake','2025-26']);
  assert.equal(previousAi.payload.data.record.intake,'2025-26');
  assert.equal(new URL(previousAi.payload.data.record.sourceUrl).searchParams.get('academicYear'),'2025/26');
});

test('catalog keeps zero credits and literal prerequisites while reporting partial coverage', async () => {
  const zero = await run(['catalog','show','AIAA2110','--term','2026-27 Fall']);
  assert.equal(zero.payload.data.record.credits, 0);
  const result = await run(['catalog','search','应用统计','--term','2026-27 Fall']);
  assert.equal(result.exitCode, 0);
  const data = result.payload.data;
  assert.equal(data.directoryComplete, false);
  assert.equal(data.officialTotalObserved, 266);
  assert.equal(data.timetableVerified, false);
  assert.equal(data.results[0].courseCode, 'UFUG2104');
  assert.equal(data.results[0].prerequisitesText, 'UFUG 1102 OR UFUG 1105');
  assert.equal(data.results[0].eligibilityEvaluated, false);
  const none = await run(['catalog','search','NOTAREALCOURSE','--term','2026-27 Fall']);
  assert.deepEqual(none.payload.data.results, []);
  assert.match(none.payload.data.message,/当前已收录/);
});

test('academic queries require explicit scope and never substitute another intake or term', async () => {
  for (const args of [['program','list'],['catalog','search','AI'],
    ['program','list','--intake','2026-27','--search','，。'],
    ['catalog','search','AI','--term','2026-27 Fall','--limit','0']]) {
    assert.equal((await run(args)).exitCode, 2);
  }
  for (const args of [['program','show','beng-ai','--intake','2024-25'],
    ['catalog','show','ufug2104','--term','2025-26 Fall']]) {
    const result = await run(args);
    assert.equal(result.exitCode, 4);
    assert.equal(result.payload.error.code, 'NOT_INDEXED');
  }
});
