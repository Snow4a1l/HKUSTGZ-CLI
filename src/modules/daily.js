import { loadRefresh } from '../lib/daily-store.js';
import { CliError } from '../lib/errors.js';
import { parseSisnWeek,shanghaiDate,validDate } from '../parsers/week.js';
import { parseCanvasAssignments,canvasDate,validateCanvasPageUrl } from '../parsers/canvas.js';

function age(timestamp,now){
  const normalized=canvasDate(timestamp);
  if(!normalized||Date.parse(normalized)>now+300000)throw new CliError('SNAPSHOT_INVALID','Refresh timestamp is invalid.');
  return Math.max(0,Math.floor((now-Date.parse(normalized))/1000));
}
export async function dailyStatus({root,runId}={}){
  let run;
  try{run=await loadRefresh(runId,root);}catch(error){if(error.code==='REFRESH_REQUIRED')return{available:false,refreshRequired:true};throw error;}
  return{available:true,runId:run.runId,date:run.date,captureState:run.captureState,startedAt:run.startedAt,finishedAt:run.finishedAt??null,
    calendar:run.calendar.status,discovery:run.discovery.status,
    courses:run.canvas.map(entry=>({id:entry.course.id,title:entry.course.title,status:entry.status,capturedAt:entry.snapshot?.capturedAt??null})),
    nextAction:run.captureState==='collecting'?'resume-browser-capture':'query-or-refresh',transport:'supported-browser'};
}
export async function dailyAgenda({root,runId,date,days=14,maxAgeMinutes=60,allowStale=false,now=Date.now()}={}){
  if(!Number.isInteger(days)||days<1||days>90||!Number.isInteger(maxAgeMinutes)||maxAgeMinutes<1||maxAgeMinutes>1440){
    throw new CliError('INVALID_ARGUMENT','Days must be 1..90 and max-age-minutes 1..1440.');
  }
  const today=shanghaiDate(new Date(now)); date??=today;
  if(!validDate(date))throw new CliError('INVALID_ARGUMENT','Date must be a valid YYYY-MM-DD date.');
  const run=await loadRefresh(runId,root);
  if(run.captureState==='collecting')throw new CliError('CAPTURE_IN_PROGRESS','The latest refresh is still collecting.','Resume this batch or begin a new one; an older batch is not substituted.');
  const timestamps=[run.startedAt];
  if(run.calendar.status==='ok')timestamps.push(run.calendar.snapshot.capturedAt);
  if(run.discovery.status==='ok')timestamps.push(run.discovery.capturedAt);
  for(const entry of run.canvas)if(entry.status==='ok')timestamps.push(entry.snapshot.capturedAt);
  const oldestAgeSeconds=Math.max(...timestamps.map(timestamp=>age(timestamp,now)));
  const stale=run.date!==today||oldestAgeSeconds>maxAgeMinutes*60;
  if(stale&&!allowStale)throw new CliError('REFRESH_REQUIRED','Daily sources are stale or belong to a previous local day.','Refresh through Browser. --allow-stale is an explicit historical preview, not a fresh query.');
  let classes=null,calendarCoverage={status:run.calendar.status};
  if(run.calendar.status==='ok'){
    const parsed=parseSisnWeek(run.calendar.snapshot);
    if(date<parsed.weekStart||date>parsed.weekEnd)throw new CliError('DATE_NOT_CAPTURED','Requested date is outside the captured dated week.');
    classes=parsed.classes.filter(course=>course.date===date).sort((a,b)=>(a.startTime??'99:99').localeCompare(b.startTime??'99:99'))
      .map(course=>({...course,status:!course.startTime||!course.endTime?'unknown':
        Date.parse(`${date}T${course.endTime}:00+08:00`)<=now?'ended':Date.parse(`${date}T${course.startTime}:00+08:00`)>now?'upcoming':'in-progress'}));
    calendarCoverage={status:'ok',sourceUrl:run.calendar.snapshot.sourceUrl,term:run.calendar.snapshot.term,
      weekStart:parsed.weekStart,weekEnd:parsed.weekEnd,capturedAt:run.calendar.snapshot.capturedAt,
      ageSeconds:age(run.calendar.snapshot.capturedAt,now),includeWaitlisted:run.calendar.snapshot.includeWaitlisted,
      detailsExpandedFor:run.calendar.expandedDate,exceptionsIndependentlyVerified:false};
  }
  const tasks=[],coverage=[];
  for(const entry of run.canvas){
    const item={courseId:entry.course.id,title:entry.course.title,code:entry.course.code,term:entry.course.term,status:entry.status,
      ...(entry.status==='error'?{errorCode:entry.code??'CAPTURE_FAILED'}:{})};
    if(entry.status==='ok'){
      const snapshot=entry.snapshot;
      if(snapshot.source!=='canvas'||snapshot.kind!=='assignments-api'||snapshot.courseId!==entry.course.id||
          snapshot.pagination?.page!==1||snapshot.pagination.perPage!==100||snapshot.pagination.complete!==false||
          !Array.isArray(snapshot.assignments)||snapshot.assignments.length>100){throw new CliError('SNAPSHOT_INVALID','Captured Canvas page metadata is invalid.');}
      validateCanvasPageUrl(snapshot.sourceUrl,entry.course.id);
      const parsed=parseCanvasAssignments(snapshot.assignments,entry.course.id);
      item.capturedAt=snapshot.capturedAt;item.ageSeconds=age(snapshot.capturedAt,now);item.taskCount=parsed.length;item.pagination=snapshot.pagination;item.uiCrossCheck=snapshot.uiCrossCheck??null;
      tasks.push(...parsed.map(task=>({...task,courseTitle:entry.course.title,capturedAt:snapshot.capturedAt,
        dueAtLocal:task.dueAt?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(task.dueAt)):null})));
    }
    coverage.push(item);
  }
  const key=task=>`${task.courseId}:${task.id}`;
  if(new Set(tasks.map(key)).size!==tasks.length)throw new CliError('SNAPSHOT_INVALID','Duplicate course-task IDs in daily capture.');
  const upcoming=tasks.filter(task=>task.dueAt&&Date.parse(task.dueAt)>=now&&Date.parse(task.dueAt)<=now+days*86400000)
    .sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.courseId-b.courseId||a.id-b.id);
  const overdue=tasks.filter(task=>task.submissionState==='unsubmitted'&&task.dueAt&&Date.parse(task.dueAt)<now&&Date.parse(task.dueAt)>=now-7*86400000)
    .sort((a,b)=>b.dueAt.localeCompare(a.dueAt));
  const failed=coverage.filter(course=>course.status!=='ok');
  return{date,timezone:'Asia/Shanghai',queriedAt:new Date(now).toISOString(),runId:run.runId,transport:'supported-browser',
    retrieval:'local-browser-refresh-batch',liveChecked:false,refreshStartedAt:run.startedAt,refreshFinishedAt:run.finishedAt??null,
    stale,oldestAgeSeconds,maxAgeMinutes,classes,
    taskRetrievalStatus:run.discovery.status!=='ok'||!coverage.some(course=>course.status==='ok')?'unavailable':failed.length?'partial':'captured-with-limits',
    taskWindow:{from:new Date(now).toISOString(),through:new Date(now+days*86400000).toISOString(),days},
    upcomingTasks:upcoming,overdueUnsubmittedTasks:overdue,undatedTasks:tasks.filter(task=>task.dueAt===null),
    coverage:{calendar:calendarCoverage,canvas:{discoveryStatus:run.discovery.status,
      discoveryScope:run.discovery.scope??null,discoveredAt:run.discovery.capturedAt??null,
      discoverySourceUrl:run.discovery.sourceUrl??null,selectedTerm:run.discovery.selectedTerm??null,
      inventory:{visibleCount:run.discovery.visibleCount??null,excludedCount:run.discovery.excludedCount??null,
        pagination:run.discovery.inventoryPagination??null},
      accountWideComplete:false,allDiscoveredCoursesCaptured:run.discovery.status==='ok'&&failed.length===0&&coverage.length>0,
      paginationComplete:false,courses:coverage,taskCount:tasks.length}},
    warnings:[
      'Classes come from the displayed dated weekly calendar; holiday, cancellation and teacher notices are not independently reconciled. No ICS is inferred.',
      'Canvas coverage is the recorded term-course inventory, first page of up to 100 tasks per course. Visible assignment links are cross-checked where reported; account-wide and opaque Link-header pagination completeness remain unverified.',
      'The query reads a newly captured batch; this CLI command itself does not contact the sites.',
      ...(upcoming.some(task=>task.reminderOnly)?['Reminder-only items are Canvas notices; their Canvas submission state does not verify completion on external sites.']:[]),
      ...(upcoming.some(task=>task.submissionTypes.some(type=>['none','on_paper','external_tool'].includes(type)))?
        ['External-tool, offline and no-submission activities retain Canvas record state only; actual activity completion is not independently verified.']:[]),
      ...(stale?['Explicit stale preview: do not present these results as refreshed data.']:[]),
      ...(run.calendar.status!=='ok'?['Calendar refresh failed; today classes are unknown, not empty.']:[]),
      ...(run.discovery.status!=='ok'?['Canvas course discovery failed; deadlines are unknown, not an empty task list.']:[]),
      ...(failed.length?[`${failed.length} Canvas courses were not captured; missing results must not be interpreted as no tasks.`]:[]),
      ...(classes?.some(course=>!course.startTime||!course.endTime)?['Some displayed class cards still lack time details.']:[])
    ]};
}
