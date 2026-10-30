import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {install} from '../scripts/install.mjs';
import {run} from '../src/main.js';
import {planAgenda} from '../src/modules/plan.js';
import {configure,step,finishPartial} from '../scripts/agent-workflow.mjs';
import {beginRefresh,updateRefresh,loadRefresh} from '../src/lib/daily-store.js';
import {discoverCanvasCourses,captureNextCanvasCourse} from '../scripts/browser-refresh.mjs';

test('real user lookup questions retrieve source-backed records with versions and evaluation boundaries',async()=>{
  const cases=[['service','校园卡丢了，哪里能补办','campus-card-replacement-student'],['service','学校打印机驱动在哪里','public-printer-driver'],
    ['document','给我本科学生手册','ug-entry-guide-2025'],['document','给我本科校历','academic-calendar-2026-27'],['document','Mac打印驱动','printer-driver-guide']];
  for(const[kind,query,id]of cases){const result=await run([kind,'search',query]);assert.equal(result.payload.ok,true);assert.ok(result.payload.data.results.some(r=>r.id===id),query);}
  const course=(await run(['course','explain','应用统计这门课怎么样'])).payload.data;
  assert.equal(course.results[0].courseCode,'UFUG2104');assert.equal(course.evaluation.studentReviewsAvailable,false);
  assert.equal((await run(['course','explain','a nonexistent course'])).payload.data.results.length,0);
});

test('planning avoids past/deadline/class/other-block conflicts, exposes assumptions and leaves overflow explicit',()=>{
  const now=Date.parse('2026-10-30T10:00:00Z');
  const task=(id,dueAt,state='unsubmitted')=>({id,courseId:1,title:'Task '+id,dueAt,submissionState:state,submissionTypes:['external_tool'],url:'https://example.invalid'});
  const agenda={stale:false,runId:'test',queriedAt:new Date(now).toISOString(),coverage:{},warnings:[],taskWindow:{days:2},
    classes:[{date:'2026-10-30',startTime:'19:00',endTime:'20:00'}],undatedTasks:[],overdueUnsubmittedTasks:[],
    upcomingTasks:[task(1,'2026-10-30T13:00:00Z'),task(2,'2026-10-31T13:00:00Z'),task(3,'2026-10-31T13:00:00Z'),task(4,'2026-10-31T13:00:00Z','submitted')]};
  const result=planAgenda(agenda,{now});
  assert.equal(result.blocks.length,1);assert.equal(result.blocks[0].id,2);assert.equal(result.unscheduled.length,2);assert.equal(result.skipped.length,1);
  for(const block of result.blocks){assert.ok(Date.parse(block.start)>=now);assert.ok(Date.parse(block.end)<=Date.parse(block.dueAt));assert.equal(block.completionNeedsConfirmation,true);assert.ok(block.title);}
  assert.equal(result.assumptions.freeTimeConfirmed,false);
  assert.throws(()=>planAgenda({...agenda,stale:true},{now}),e=>e.code==='REFRESH_REQUIRED');
  assert.throws(()=>planAgenda(agenda,{now,window:'23:00-01:00'}),e=>e.code==='INVALID_ARGUMENT');
  agenda.upcomingTasks[1].unlockAt='2026-10-31T11:15:00Z';
  const unlocked=planAgenda(agenda,{now});assert.equal(unlocked.blocks[0].start,'2026-10-31T11:15:00.000Z');
  agenda.upcomingTasks[1].lockAt='2026-10-31T11:30:00Z';
  assert.ok(planAgenda(agenda,{now}).unscheduled.some(t=>t.id===2));
});

test('self-contained install survives source relocation, upgrades, isolates private state and refuses unmanaged conflicts',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hkustgz-install-'));
  try{
    const codexHome=join(home,'codex');const first=await install({codexHome});
    const environment={...process.env,HKUSTGZ_HOME:join(home,'student-state')};
    const setup=JSON.parse(execFileSync(process.execPath,[first.cli,'setup'],{cwd:tmpdir(),env:environment,encoding:'utf8'}));
    assert.equal(setup.ok,true);assert.equal(setup.data.stateDirectory,environment.HKUSTGZ_HOME);
    assert.ok(setup.data.appDirectory.startsWith(join(codexHome,'skills')));
    await writeFile(join(environment.HKUSTGZ_HOME,'keep.txt'),'private');
    const moved=join(codexHome,'skills','relocated');await rename(first.skillDirectory,moved);
    const result=JSON.parse(execFileSync(process.execPath,[join(moved,'scripts','run.mjs'),'document','search','打印机驱动'],{cwd:tmpdir(),env:environment,encoding:'utf8'}));
    assert.equal(result.ok,true);assert.ok(result.data.results.length);
    await rename(moved,first.skillDirectory);await install({codexHome});assert.equal(await readFile(join(environment.HKUSTGZ_HOME,'keep.txt'),'utf8'),'private');
    const other=join(home,'unmanaged');await mkdir(join(other,'skills','hkustgz-cli'),{recursive:true});
    await assert.rejects(install({codexHome:other}),/INSTALL_CONFLICT/);
    const skill=await readFile(join(first.skillDirectory,'SKILL.md'),'utf8');assert.ok(!/[A-Za-z]:[\\/]/.test(skill));assert.ok(!skill.includes('../../docs'));
    const absent=JSON.parse(execFileSync(process.execPath,[first.cli,'daily','status'],{cwd:tmpdir(),env:environment,encoding:'utf8'}));assert.equal(absent.data.available,false);
  }finally{assert.ok(resolve(home).startsWith(resolve(tmpdir())+sep+'hkustgz-install-'));await rm(home,{recursive:true,force:true});}
});

test('a failed source finishes as partial without browser retry or substituting old data',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hkustgz-partial-'));
  try{
    configure({stateDirectory:home});
    const {runId}=await beginRefresh();
    await updateRefresh(runId,value=>{value.calendar={status:'error',code:'BROWSER_CAPTURE_FAILED'};});
    const result=await step({tabs:{list(){throw new Error('Must not contact browser for a failed dependency.');}}});
    assert.equal(result.action,'finished');assert.equal(result.state,'partial');
    const stored=await loadRefresh(runId);assert.equal(stored.discovery.code,'TERM_SOURCE_UNAVAILABLE');
    assert.equal(stored.calendar.status,'error');assert.equal(stored.canvas.length,0);
    const another=await beginRefresh();const ended=await finishPartial();assert.equal(ended.state,'partial');
    assert.equal((await loadRefresh(another.runId)).calendar.code,'NOT_CAPTURED');
  }finally{assert.ok(resolve(home).startsWith(resolve(tmpdir())+sep+'hkustgz-partial-'));await rm(home,{recursive:true,force:true});}
});

test('Canvas discovery works without dashboard cards, selects term student enrollments, and rejects a visible next page',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hkustgz-inventory-'));
  try{
    configure({stateDirectory:home});
    const {runId}=await beginRefresh();
    await updateRefresh(runId,value=>{value.calendar={status:'ok',snapshot:{term:'2026-27 Fall'}};});
    const inventory={hasNext:false,rows:[
      {url:'https://hkust-gz.instructure.com/courses/42',title:'TEST1001 - Example',term:'2026-27 Fall',role:'Student'},
      {url:'https://hkust-gz.instructure.com/courses/43',title:'TEST1002 - Past example',term:'2025-26 Fall',role:'Student'},
      {url:'https://hkust-gz.instructure.com/courses/44',title:'TEST1003 - Observer example',term:'2026-27 Fall',role:'Observer'}]};
    const visits=[];
    const tab={url:async()=> 'https://hkust-gz.instructure.com/',goto:async url=>visits.push(url),
      playwright:{getByRole(role){
        if(role==='heading')return{innerText:async()=> 'All Courses'};
        assert.equal(role,'main','Must not require a dashboard tab or course-card layout.');
        return{evaluate:async()=>inventory};
      }}};
    const result=await discoverCanvasCourses(tab,runId);
    assert.deepEqual(visits,['https://hkust-gz.instructure.com/courses']);assert.deepEqual(result.courses.map(c=>c.id),[42]);
    const saved=await loadRefresh(runId);assert.equal(saved.discovery.excludedCount,2);assert.equal(saved.discovery.accountWideComplete,false);
    inventory.hasNext=true;
    const next=await beginRefresh();
    await updateRefresh(next.runId,value=>{value.calendar={status:'ok',snapshot:{term:'2026-27 Fall'}};});
    await assert.rejects(discoverCanvasCourses(tab,next.runId),/discovery failed/);
    assert.equal((await loadRefresh(next.runId)).discovery.status,'error');
  }finally{assert.ok(resolve(home).startsWith(resolve(tmpdir())+sep+'hkustgz-inventory-'));await rm(home,{recursive:true,force:true});}
});

test('an unreadable assignment UI error page does not prevent the documented read-only endpoint',async()=>{
  const home=await mkdtemp(join(tmpdir(),'hkustgz-ui-fallback-'));
  try{
    configure({stateDirectory:home});const {runId}=await beginRefresh();
    const course={id:42,title:'TEST1001 - Example',code:'TEST1001',term:'2026-27 Fall',url:'https://hkust-gz.instructure.com/courses/42'};
    await updateRefresh(runId,value=>{value.discovery={status:'ok',selectedTerm:course.term};value.canvas=[{course,status:'pending'}];});
    let current='unreadable-error-page';const visits=[];
    const tab={goto:async url=>{visits.push(url);if(url===course.url+'/assignments')throw new Error('UI network error.');current=url;},
      url:async()=>{assert.notEqual(current,'unreadable-error-page','Must navigate to the API before inspecting URL.');return current;},
      playwright:{evaluate:async()=>[]}};
    const result=await captureNextCanvasCourse(tab,runId);
    assert.equal(visits.length,2);assert.ok(visits[1].includes('/api/v1/courses/42/assignments?'));
    assert.equal(result.tasks,0);assert.equal(result.uiCrossCheck.status,'unavailable');
    assert.equal((await loadRefresh(runId)).canvas[0].status,'ok');
  }finally{assert.ok(resolve(home).startsWith(resolve(tmpdir())+sep+'hkustgz-ui-fallback-'));await rm(home,{recursive:true,force:true});}
});
