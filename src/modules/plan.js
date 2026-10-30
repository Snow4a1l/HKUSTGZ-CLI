import {dailyAgenda} from './daily.js';
import {shanghaiDate} from '../parsers/week.js';
import {CliError} from '../lib/errors.js';

// A proposed work block is an estimate, never an inferred duration or calendar booking.
export function planAgenda(agenda,{minutes=90,window='19:00-21:00',now=Date.now()}={}){
  const match=/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(window);
  if(!match||!Number.isInteger(minutes)||minutes<15||minutes>240)throw new CliError('INVALID_ARGUMENT','Use --minutes 15..240 and --window HH:MM-HH:MM (same day).');
  const startMinute=Number(match[1])*60+Number(match[2]),endMinute=Number(match[3])*60+Number(match[4]);
  if(endMinute<=startMinute||minutes>endMinute-startMinute)throw new CliError('INVALID_ARGUMENT','The daily window must contain one estimated work block.');
  if(agenda.stale)throw new CliError('REFRESH_REQUIRED','Refresh before making a current work plan.');
  const occupied=(agenda.classes??[]).filter(c=>c.startTime&&c.endTime).map(c=>({
    start:Date.parse(`${c.date}T${c.startTime}:00+08:00`),end:Date.parse(`${c.date}T${c.endTime}:00+08:00`)}));
  const blocks=[],unscheduled=[],skipped=[];
  const tasks=[...agenda.upcomingTasks].sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.courseId-b.courseId||a.id-b.id);
  for(const task of tasks){
    if(['submitted','graded','pending_review'].includes(task.submissionState)){skipped.push({courseId:task.courseId,id:task.id,reason:'Canvas records submission; no work estimate assigned.'});continue;}
    let block;
    for(let day=0;day<=agenda.taskWindow.days&&!block;day++){
      const date=shanghaiDate(new Date(now+day*86400000));
      const midnight=Date.parse(`${date}T00:00:00+08:00`);
      const available=Math.max(now,task.unlockAt?Date.parse(task.unlockAt):now);
      let start=Math.max(midnight+startMinute*60000,Math.ceil(available/900000)*900000);
      const boundary=Math.min(midnight+endMinute*60000,Date.parse(task.dueAt),task.lockAt?Date.parse(task.lockAt):Infinity);
      while(start+minutes*60000<=boundary){
        const end=start+minutes*60000;
        const conflict=occupied.filter(item=>item.start<end&&item.end>start).sort((a,b)=>a.end-b.end)[0];
        if(conflict){start=Math.ceil(conflict.end/900000)*900000;continue;}
        block={courseId:task.courseId,id:task.id,title:task.title,courseTitle:task.courseTitle,url:task.url,
          start:new Date(start).toISOString(),end:new Date(end).toISOString(),dueAt:task.dueAt,
          estimatedMinutes:minutes,completionNeedsConfirmation:task.submissionState==='unknown'||task.reminderOnly||task.submissionTypes.some(t=>['none','on_paper','external_tool'].includes(t))};
        occupied.push({start,end});break;
      }
    }
    if(block)blocks.push(block);else unscheduled.push({courseId:task.courseId,id:task.id,title:task.title,dueAt:task.dueAt,reason:'No estimated block fits the selected daily window before the deadline.'});
  }
  return{timezone:'Asia/Shanghai',runId:agenda.runId,queriedAt:agenda.queriedAt,coverage:agenda.coverage,
    assumptions:{dailyWindow:window,minutesPerTask:minutes,durationIsEstimate:true,freeTimeConfirmed:false},
    blocks:blocks.sort((a,b)=>a.start.localeCompare(b.start)),unscheduled,skipped,undatedTasks:agenda.undatedTasks,
    overdueUnsubmittedTasks:agenda.overdueUnsubmittedTasks,
    warnings:[...agenda.warnings,'Draft plan only: confirm actual completion, workload and free time. Only captured dated classes are avoided; future classes and personal events are not fully known. No calendar was changed.']};
}
export async function dailyPlan(options={}){return planAgenda(await dailyAgenda(options),options);}
