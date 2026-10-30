import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {beginRefresh,updateRefresh,loadRefresh,finishRefresh} from '../src/lib/daily-store.js';
import {dailyAgenda,dailyStatus} from '../src/modules/daily.js';
import {parseSisnWeek,shanghaiDate} from '../src/parsers/week.js';

const NOW=Date.parse('2026-10-30T10:00:00Z');
const stamp=new Date(NOW-120000).toISOString();
const weekly=()=>({schemaVersion:1,source:'sisn',view:'weekly-calendar',sourceUrl:'https://sisn.hkust-gz.edu.cn/system/my-calendar',
  term:'2026-27 Fall',weekLabel:'Week of 2026-10-26 - 2026-11-01',includeWaitlisted:false,capturedAt:stamp,
  days:['26\nMon','27\nTue','28\nWed','29\nThu','30\nFri','31\nSat','01\nSun'].map((heading,index)=>({heading,
    cards:index===4?['TEST1001 - L01\nExample class\n09:00 - 09:50\nExample room\nExample teacher']:[]}))});
const assignment=(course,id,offset,state='unsubmitted')=>({id,course_id:course,name:`Example task ${course}-${id}`,
  due_at:offset===null?null:new Date(NOW+offset*86400000).toISOString(),unlock_at:null,lock_at:null,
  html_url:`https://hkust-gz.instructure.com/courses/${course}/assignments/${id}`,is_quiz_assignment:false,
  submission_types:['online_upload'],locked_for_user:false,submission:state===null?undefined:{workflow_state:state,submitted_at:null},
  secure_params:'DO_NOT_OUTPUT'});
async function fixture(root){
  const {runId}=await beginRefresh(root);
  await updateRefresh(runId,run=>{
    run.date='2026-10-30';run.startedAt=stamp;run.calendar={status:'ok',expandedDate:run.date,snapshot:weekly()};
    run.discovery={status:'ok',selectedTerm:'2026-27 Fall',capturedAt:stamp,scope:'visible-dashboard-course-cards'};
    run.canvas=[99,100].map(id=>({course:{id,title:`Example course ${id}`,code:`TEST${id}`,term:'2026-27 Fall',url:`https://hkust-gz.instructure.com/courses/${id}`},status:'ok',
      snapshot:{schemaVersion:1,source:'canvas',kind:'assignments-api',courseId:id,capturedAt:stamp,
        sourceUrl:`https://hkust-gz.instructure.com/api/v1/courses/${id}/assignments?per_page=100&include%5B%5D=submission`,pagination:{page:1,perPage:100,complete:false},
        assignments:id===99?[assignment(id,1,1),assignment(id,2,-1,'graded'),assignment(id,3,-1),assignment(id,4,null)]:[assignment(id,1,2),assignment(id,2,3,null)]}}));
  },root);
  await finishRefresh(runId,root);
  return runId;
}
async function withRoot(work){
  const root=await mkdtemp(join(tmpdir(),'hkustgz-daily-'));
  try{await work(root);}finally{
    assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep+'hkustgz-daily-'));
    await rm(root,{recursive:true,force:true});
  }
}

test('dated SISN week validates month boundaries and does not generate semester recurrence',()=>{
  const parsed=parseSisnWeek(weekly());
  assert.equal(parsed.weekStart,'2026-10-26');assert.equal(parsed.weekEnd,'2026-11-01');
  assert.equal(parsed.classes[0].date,'2026-10-30');assert.equal(parsed.classes[0].startTime,'09:00');
  const bad=weekly();bad.days[4].heading='31\nFri';
  assert.throws(()=>parseSisnWeek(bad),error=>error.code==='SNAPSHOT_INVALID');
  assert.equal(shanghaiDate(new Date('2026-10-30T16:01:00Z')),'2026-10-31');
});

test('daily query unifies courses with distinct IDs, pending/unknown submissions, undated and overdue tasks',async()=>withRoot(async root=>{
  await fixture(root);
  const data=await dailyAgenda({root,now:NOW});
  assert.equal(data.classes.length,1);assert.equal(data.classes[0].status,'ended');
  assert.equal(data.upcomingTasks.length,3);assert.equal(data.overdueUnsubmittedTasks.length,1);assert.equal(data.undatedTasks.length,1);
  assert.equal(data.upcomingTasks.at(-1).submissionState,'unknown');
  assert.equal(data.coverage.canvas.courses.length,2);assert.equal(data.coverage.canvas.allDiscoveredCoursesCaptured,true);
  assert.equal(data.coverage.canvas.paginationComplete,false);assert.equal(data.coverage.canvas.accountWideComplete,false);
  assert.equal(data.liveChecked,false);assert.equal(data.oldestAgeSeconds,120);
  assert.ok(!JSON.stringify(data).includes('DO_NOT_OUTPUT'));
}));

test('freshness checks the oldest source and Shanghai day, with explicit stale preview only',async()=>withRoot(async root=>{
  const runId=await fixture(root);
  await updateRefresh(runId,run=>{run.canvas[0].snapshot.capturedAt=new Date(NOW-61*60000).toISOString();},root);
  await assert.rejects(dailyAgenda({root,now:NOW}),error=>error.code==='REFRESH_REQUIRED');
  assert.equal((await dailyAgenda({root,now:NOW,allowStale:true})).stale,true);
  await fixture(root);
  const midnight=Date.parse('2026-10-30T16:01:00Z');
  await assert.rejects(dailyAgenda({root,now:midnight,maxAgeMinutes:1440}),error=>error.code==='REFRESH_REQUIRED');
}));

test('a new collecting batch supersedes prior success instead of silently returning old data',async()=>withRoot(async root=>{
  const oldId=await fixture(root);const fresh=await beginRefresh(root);
  assert.notEqual(oldId,fresh.runId);
  await assert.rejects(dailyAgenda({root,now:NOW}),error=>error.code==='CAPTURE_IN_PROGRESS');
  await assert.rejects(finishRefresh(fresh.runId,root),error=>error.code==='CAPTURE_IN_PROGRESS');
  assert.equal((await dailyStatus({root})).runId,fresh.runId);
  assert.equal((await loadRefresh(oldId,root)).captureState,'complete');
}));

test('failed calendar/course captures remain unknown and expose incomplete coverage',async()=>withRoot(async root=>{
  const runId=await fixture(root);
  await updateRefresh(runId,run=>{run.calendar={status:'error',code:'BROWSER_CAPTURE_FAILED'};run.canvas[1].status='error';delete run.canvas[1].snapshot;},root);
  await finishRefresh(runId,root);
  const data=await dailyAgenda({root,now:NOW});
  assert.equal(data.classes,null);assert.equal(data.coverage.canvas.allDiscoveredCoursesCaptured,false);
  assert.equal(data.coverage.canvas.courses[1].status,'error');assert.equal(data.upcomingTasks.length,1);
  assert.ok(data.warnings.some(warning=>warning.includes('unknown, not empty')));
}));

test('daily query refuses uncaptured dates and malformed IDs without traversing private storage',async()=>withRoot(async root=>{
  await fixture(root);
  await assert.rejects(dailyAgenda({root,now:NOW,date:'2026-11-02'}),error=>error.code==='DATE_NOT_CAPTURED');
  await assert.rejects(dailyAgenda({root,now:NOW,date:'2026-02-30'}),error=>error.code==='INVALID_ARGUMENT');
  await assert.rejects(loadRefresh('../outside',root),error=>error.code==='SNAPSHOT_INVALID');
}));
