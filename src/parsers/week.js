import { CliError } from '../lib/errors.js';
import { parseSisnOverview } from './sisn.js';

const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const invalid=()=>{throw new CliError('SNAPSHOT_INVALID','SISN dated weekly calendar has an unsupported shape.');};
export function validDate(value){
  return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
}
export function addDays(date,number){return new Date(Date.parse(`${date}T00:00:00Z`)+number*86400000).toISOString().slice(0,10);}
export function shanghaiDate(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function parseSisnWeek(snapshot){
  if (!snapshot||snapshot.schemaVersion!==1||snapshot.source!=='sisn'||snapshot.view!=='weekly-calendar'||
      typeof snapshot.weekLabel!=='string'||!Array.isArray(snapshot.days)||snapshot.days.length!==7) invalid();
  const match=/^Week of (\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})$/.exec(snapshot.weekLabel);
  if(!match||!validDate(match[1])||!validDate(match[2])||new Date(match[1]).getUTCDay()!==1||addDays(match[1],6)!==match[2])invalid();
  const days=snapshot.days.map((day,index)=>{
    if(!day||typeof day.heading!=='string')invalid();
    const date=addDays(match[1],index);
    const heading=(day.heading??'').split(/\s+/).filter(Boolean);
    if(heading.length!==2||Number(heading[0])!==Number(date.slice(-2))||heading[1]!==weekdays[index]||!Array.isArray(day.cards))invalid();
    const cards=day.cards.map(card=>{
      if(typeof card!=='string'||card.length>10000)invalid();
      const lines=card.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
      if(lines.length>1){const slot=/^\d\d:\d\d - \d\d:\d\d$/.test(lines[1])?1:2;lines.splice(slot,0,`${date} - ${date}`);}
      return lines.join('\n');
    });
    return{heading:weekdays[index],cards};
  });
  const parsed=parseSisnOverview({...snapshot,view:'time-slots-overview',days});
  return{weekStart:match[1],weekEnd:match[2],classes:parsed.map(course=>({...course,date:addDays(match[1],course.day-1),
    missingFields:course.missingFields.filter(field=>field!=='dateRange')}))};
}
