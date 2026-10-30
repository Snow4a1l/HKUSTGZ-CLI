import { mkdir,writeFile,rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { stateHome } from './state.js';
import { readSnapshot } from './snapshot.js';
import { CliError } from './errors.js';
import { shanghaiDate,validDate } from '../parsers/week.js';

const dailyRoot=()=>join(stateHome(),'daily');
const validId=id=>typeof id==='string'&&/^\d{8}T\d{6}Z-[a-f0-9]{8}$/.test(id);
async function atomicJson(path,value){
  const text=JSON.stringify(value,null,2)+'\n';
  if(Buffer.byteLength(text)>1024*1024)throw new CliError('CAPTURE_FAILED','Refresh batch exceeded the 1 MiB private storage limit.');
  const temporary=`${path}.${randomUUID()}.tmp`;
  await writeFile(temporary,text,{flag:'wx',mode:0o600});
  await rename(temporary,path);
}
export async function beginRefresh(root=dailyRoot()){
  await mkdir(join(root,'runs'),{recursive:true});
  const startedAt=new Date().toISOString();
  const runId=startedAt.replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')+'-'+randomUUID().slice(0,8);
  const run={schemaVersion:1,runId,date:shanghaiDate(),startedAt,captureState:'collecting',transport:'supported-browser',
    calendar:{status:'pending'},discovery:{status:'pending'},canvas:[]};
  await atomicJson(join(root,'runs',`${runId}.json`),run);
  // Point at the new attempt immediately. Failed refreshes never silently expose an older successful batch.
  await atomicJson(join(root,'latest.json'),{schemaVersion:1,runId});
  return{runId,startedAt,date:run.date};
}
export async function loadRefresh(runId,root=dailyRoot()){
  if(runId===undefined){
    try{const pointer=await readSnapshot(join(root,'latest.json'));runId=pointer.runId;}
    catch{throw new CliError('REFRESH_REQUIRED','No daily browser refresh is available.','Run the supported Browser refresh workflow in docs/DAILY.md.');}
  }
  if(!validId(runId))throw new CliError('SNAPSHOT_INVALID','Invalid daily refresh ID.');
  const run=await readSnapshot(join(root,'runs',`${runId}.json`));
  const states=['pending','ok','error'];
  if(run.schemaVersion!==1||run.runId!==runId||run.transport!=='supported-browser'||
      !['collecting','complete','partial'].includes(run.captureState)||!validDate(run.date)||
      !states.includes(run.calendar?.status)||!states.includes(run.discovery?.status)||!Array.isArray(run.canvas)||run.canvas.length>12||
      (run.discovery.status==='ok'&&run.canvas.length===0)){
    throw new CliError('SNAPSHOT_INVALID','Daily refresh metadata is invalid.');
  }
  const ids=new Set();
  for(const entry of run.canvas){
    const course=entry?.course;
    if(!states.includes(entry?.status)||!course||!Number.isSafeInteger(course.id)||course.id<1||ids.has(course.id)||
        typeof course.title!=='string'||!course.title.trim()||course.title.length>1000||typeof course.code!=='string'||
        course.term!==run.discovery.selectedTerm||course.url!==`https://hkust-gz.instructure.com/courses/${course.id}`||
        (entry.status==='ok'&&!entry.snapshot))throw new CliError('SNAPSHOT_INVALID','Canvas discovery metadata is invalid.');
    ids.add(course.id);
  }
  return run;
}
export async function updateRefresh(runId,update,root=dailyRoot()){
  const run=await loadRefresh(runId,root);
  await update(run);
  await atomicJson(join(root,'runs',`${runId}.json`),run);
  return run;
}
export async function finishRefresh(runId,root=dailyRoot()){
  const run=await updateRefresh(runId,value=>{
    if(value.calendar.status==='pending'||value.discovery.status==='pending'||value.canvas.some(course=>course.status==='pending')){
      throw new CliError('CAPTURE_IN_PROGRESS','Refresh still has pending sources.');
    }
    value.finishedAt=new Date().toISOString();
    value.captureState=value.calendar.status==='ok'&&value.discovery.status==='ok'&&value.canvas.every(course=>course.status==='ok')?'complete':'partial';
  },root);
  return{runId,state:run.captureState,calendar:run.calendar.status,courses:run.canvas.length,captured:run.canvas.filter(course=>course.status==='ok').length};
}
