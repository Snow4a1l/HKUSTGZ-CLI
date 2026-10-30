import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseSisnGrades } from '../src/parsers/grades.js';
import { run } from '../src/main.js';

// Synthetic replacements in the two observed table shapes; no personal grades.
const fixture=()=>({schemaVersion:1,source:'sisn',view:'term-information',
  sourceUrl:'https://sisn.hkust-gz.edu.cn/student-record/my-academics',term:'2026-27 Fall',
  capturedAt:new Date().toISOString(),tables:[
    [['Class','Description','Units','Grading','Grade','Grade Points']],
    [['TEST 1001','Example course','3.00','Graded A+ to F','**',''],
      ['TEST 1002','Example course two','','Graded P, F or PP','PP','']],
    [['','From Enrollment','Cumulative Total']],
    [['Units Toward GPA:'],['Taken','3.000','12.000'],['Passed','','9.000'],['In Progress','3.000','3.000'],
      ['Units Not for GPA:'],['Taken','0.000','0.000'],['Passed','',''],['In Progress','0.000','0.000'],
      ['GPA Calculation'],['Total Grade Points','','21.000'],['/ Units Taken Toward GPA','','9.000'],['= GPA','','2.123']]
  ]});

test('grades preserve official GPA, blank units, zero and unreported grades without local calculation',()=>{
  const value=parseSisnGrades(fixture());
  assert.equal(value.courses.length,2);
  assert.equal(value.courses[0].grade,'**');
  assert.equal(value.courses[0].gradeUnreported,true);
  assert.equal(value.courses[1].grade,'PP');
  assert.equal(value.courses[1].units,null);
  assert.equal(value.officialStatistics.unitsNotForGpa.taken.term,0);
  assert.equal(value.officialStatistics.unitsTowardGpa.passed.term,null);
  assert.equal(value.officialStatistics.gpa.cumulative,2.123);
  assert.notEqual(value.officialStatistics.gpa.cumulative,21/9);
  const completed=fixture();
  completed.tables[3]=completed.tables[3].filter(r=>r[0]!=='In Progress');
  assert.equal(parseSisnGrades(completed).officialStatistics.unitsTowardGpa.inProgress,null);
});

test('grade snapshots fail closed on changed columns, duplicate groups and raw private errors',()=>{
  for(const edit of [s=>{s.tables[0][0][2]='Unknown Units';},s=>{s.tables[1][0][2]='PRIVATE_BAD_VALUE';},
    s=>{s.tables[1].push(s.tables[1][0]);},s=>{s.tables[3][4]=['Units Toward GPA:'];},
    s=>{s.tables[3].pop();},s=>{s.sourceUrl+='?token=PRIVATE';},s=>{s.term='all';}]){
    const snapshot=fixture();edit(snapshot);
    assert.throws(()=>parseSisnGrades(snapshot),e=>e.code==='SNAPSHOT_INVALID'&&!e.message.includes('PRIVATE'));
  }
});

test('grade CLI lists selected-term rows and summary omits rows but preserves official source',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hkustgz-grades-'));
  try{
    const path=join(directory,'grades.json'); await writeFile(path,JSON.stringify(fixture()));
    const result=await run(['grade','list','--source','sisn','--snapshot',path]);
    assert.equal(result.exitCode,0);
    assert.equal(result.payload.data.localGpaCalculated,false);
    assert.equal(result.payload.data.officialRanking,null);
    assert.equal(result.payload.data.liveChecked,false);
    assert.equal(result.payload.data.courses.length,2);
    const summary=await run(['grade','summary','--source','sisn','--snapshot',path]);
    assert.equal(summary.payload.data.courses,undefined);
    assert.equal(summary.payload.data.officialStatistics.gpa.cumulative,2.123);
    assert.equal((await run(['grade','list','--source','sisn'])).payload.error.code,'NOT_IMPLEMENTED');
  }finally{await rm(directory,{recursive:true,force:true});}
});
