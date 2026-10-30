// Invoke from the host's supported Browser JavaScript session, with already-connected tab handles.
// No browser discovery, raw HTTP, browser storage, hidden application state, or credentials are accessed here.
import { beginRefresh,updateRefresh,loadRefresh,finishRefresh } from '../src/lib/daily-store.js';
import { parseSisnWeek } from '../src/parsers/week.js';
import { parseCanvasAssignments,CANVAS_ORIGIN } from '../src/parsers/canvas.js';
import { readSisnOverview } from './read-sisn-overview.mjs';
import { readCanvasAssignments } from './read-canvas-assignments.mjs';

export { beginRefresh,finishRefresh };
async function reloadOrNavigate(tab,url){if(await tab.url()===url)await tab.reload();else await tab.goto(url);}
function readAllCourseRows(content){
  const rows=[...content.querySelectorAll('table tbody tr')].map(row=>{
    const link=row.querySelector('a[href]');
    const cells=[...row.children].map(cell=>cell.innerText.trim());
    return link?{url:link.href,title:link.innerText.trim(),term:cells[3],role:cells[4]}:null;
  }).filter(Boolean);
  const next=[...content.querySelectorAll('a[rel="next"],.pagination a')].some(link=>
    link.getAttribute('rel')==='next'||/^(next|›|»)/i.test(link.innerText.trim()));
  return{rows,hasNext:next};
}
function readAssignmentLinks(content){
  const links=[...content.querySelectorAll('a[href]')].map(link=>link.href)
    .filter(href=>/^https:\/\/hkust-gz\.instructure\.com\/courses\/\d+\/assignments\/\d+$/.test(href));
  return{links:[...new Set(links)],collapsed:[...content.querySelectorAll('button[aria-expanded="false"]')].length};
}
function readWeekMetadata(){
  const terms=[...document.querySelectorAll('input[placeholder="Select"]')].map(input=>input.value)
    .filter(value=>/^\d{4}-\d{2} (Fall|Winter|Spring|Summer)$/.test(value));
  const weekLabels=document.body.innerText.split('\n').map(line=>line.trim())
    .filter(line=>/^Week of \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}$/.test(line));
  const labels=[...document.querySelectorAll('label.el-checkbox')];
  const checked=text=>labels.find(label=>label.innerText.trim()===text)?.querySelector('input')?.checked;
  return{term:terms.length===1?terms[0]:null,weekLabel:weekLabels.length===1?weekLabels[0]:null,
    weeklySelected:document.querySelector('input[type="radio"][value="weekly"]')?.checked,
    includeWaitlisted:checked('Include Waitlisted Class'),showFinalExam:checked('Show Final Exam'),
    colorNoClassSlots:checked('Color Weekly No Class Time Slots')};
}
export async function captureSisnWeek(tab,runId){
  try{
    const run=await loadRefresh(runId);
    await reloadOrNavigate(tab,'https://sisn.hkust-gz.edu.cn/system/my-calendar');
    await tab.playwright.getByRole('radio',{name:'Weekly Calendar',exact:true}).click();
    const metadata=await tab.playwright.evaluate(readWeekMetadata);
    if(!metadata.weeklySelected||!metadata.term||!metadata.weekLabel||typeof metadata.includeWaitlisted!=='boolean')throw new Error('Weekly metadata changed.');
    const {term,weekLabel,includeWaitlisted,showFinalExam,colorNoClassSlots}=metadata;
    let days=await tab.playwright.evaluate(readSisnOverview);
    const makeSnapshot=()=>({schemaVersion:1,source:'sisn',sourceUrl:'https://sisn.hkust-gz.edu.cn/system/my-calendar',
      view:'weekly-calendar',term,weekLabel,includeWaitlisted,showFinalExam,colorNoClassSlots,capturedAt:new Date().toISOString(),days});
    const initial=parseSisnWeek(makeSnapshot());
    if(run.date<initial.weekStart||run.date>initial.weekEnd)throw new Error('Displayed week does not include refresh date.');
    const index=Math.round((Date.parse(run.date)-Date.parse(initial.weekStart))/86400000);
    if(days[index].cards.length>12)throw new Error('Daily card bound exceeded.');
    const columns=await tab.playwright.locator('.table-list-main').all();
    for(let cardIndex=0;cardIndex<days[index].cards.length;cardIndex++){
      const identity=days[index].cards[cardIndex].split('\n')[0].trim();
      await columns[index].getByText(identity,{exact:true}).click();
      const visible=await tab.playwright.evaluate(readSisnOverview); // State check after each UI expansion.
      if(visible[index]?.cards[cardIndex]?.split('\n')[0].trim()!==identity)throw new Error('Calendar changed during capture.');
      days[index].cards[cardIndex]=visible[index].cards[cardIndex];
    }
    const snapshot=makeSnapshot();
    const parsed=parseSisnWeek(snapshot);
    if(parsed.classes.some(course=>course.date===run.date&&(!course.startTime||!course.endTime)))throw new Error('Daily details remain incomplete.');
    await updateRefresh(runId,value=>{value.calendar={status:'ok',snapshot,expandedDate:run.date};});
    return{source:'sisn',date:run.date,week:weekLabel,capturedAt:snapshot.capturedAt,todayClasses:parsed.classes.filter(course=>course.date===run.date).length};
  }catch{
    await updateRefresh(runId,value=>{value.calendar={status:'error',code:'BROWSER_CAPTURE_FAILED'};});
    throw new Error('SISN refresh failed. Check the current login, weekly date range and visible calendar; old data was not substituted.');
  }
}
export async function discoverCanvasCourses(tab,runId){
  try{
    const run=await loadRefresh(runId);
    if(run.calendar.status!=='ok')throw new Error('Capture SISN term first.');
    // The complete visible enrollment table works with both classic and new dashboard preferences.
    await reloadOrNavigate(tab,CANVAS_ORIGIN+'/courses');
    const term=run.calendar.snapshot.term;
    await tab.playwright.getByRole('heading',{name:'All Courses',exact:true}).innerText();
    const inventory=await tab.playwright.getByRole('main').evaluate(readAllCourseRows);
    if(inventory.hasNext||inventory.rows.length>200)throw new Error('Course inventory has unsupported pagination.');
    const selected=inventory.rows.filter(row=>row.term===term&&row.role==='Student').map(row=>{
      const url=new URL(row.url),match=/^\/courses\/([1-9]\d*)$/.exec(url.pathname);
      if(url.origin!==CANVAS_ORIGIN||!match||url.search||url.hash||!row.title)throw new Error('Course inventory changed.');
      return{id:Number(match[1]),title:row.title,code:row.title.split(' - ')[0],term,url:url.href};
    });
    if(new Set(selected.map(course=>course.id)).size!==selected.length)throw new Error('Duplicate inventory course.');
    if(!selected.length||selected.length>12)throw new Error('No term courses, or course bound exceeded.');
    const capturedAt=new Date().toISOString();
    await updateRefresh(runId,value=>{
      value.discovery={status:'ok',sourceUrl:CANVAS_ORIGIN+'/courses',capturedAt,scope:'all-courses-visible-tables',accountWideComplete:false,
        selectedTerm:term,visibleCount:inventory.rows.length,
        inventoryPagination:{nextLinkObserved:false,accountWideComplete:false},excludedCount:inventory.rows.length-selected.length};
      value.canvas=selected.map(course=>({course,status:'pending'}));
    });
    return{source:'canvas',term,discoveredAt:capturedAt,courses:selected.map(course=>({id:course.id,title:course.title})),accountWideComplete:false};
  }catch{
    await updateRefresh(runId,value=>{value.discovery={status:'error',code:'BROWSER_DISCOVERY_FAILED'};});
    throw new Error('Canvas course discovery failed. Check the signed-in All Courses table; no cached course IDs were used.');
  }
}
export async function captureNextCanvasCourse(tab,runId){
  const run=await loadRefresh(runId);
  const entry=run.canvas.find(course=>course.status==='pending');
  if(!entry)return{done:true,captured:run.canvas.filter(course=>course.status==='ok').length};
  const courseId=entry.course.id;
  const sourceUrl=`${CANVAS_ORIGIN}/api/v1/courses/${courseId}/assignments?per_page=100&include%5B%5D=submission`;
  try{
    let visible=null;
    try{
      await tab.goto(entry.course.url+'/assignments');
      await tab.playwright.getByRole('heading',{name:'Assignments',exact:true}).innerText();
      const page=await tab.playwright.getByRole('main').evaluate(readAssignmentLinks);
      if(!page.collapsed)visible=page;
    }catch{/* Some courses hide the Assignments UI. Report this check as unavailable and still query the read-only endpoint. */}
    // Navigate explicitly after the optional UI check, including from browser network-error pages.
    await tab.goto(sourceUrl);
    if(await tab.url()!==sourceUrl)throw new Error('Canvas login or redirection required.');
    const assignments=await tab.playwright.evaluate(readCanvasAssignments); // Read only the current rendered JSON page, immediately whitelist.
    parseCanvasAssignments(assignments,courseId);
    const visibleIds=(visible?.links??[]).filter(url=>url.startsWith(entry.course.url+'/assignments/')).map(url=>Number(url.split('/').at(-1)));
    const missingIds=visibleIds.filter(id=>!assignments.some(item=>item.id===id));
    if(missingIds.length)throw new Error('Visible assignments are missing from the first API page.');
    const snapshot={schemaVersion:1,source:'canvas',kind:'assignments-api',sourceUrl,courseId,capturedAt:new Date().toISOString(),
      pagination:{page:1,perPage:100,complete:false,reason:'Browser does not expose the required opaque Link header.'},
      uiCrossCheck:{status:visible?'checked':'unavailable',sourceUrl:entry.course.url+'/assignments',visibleAssignmentCount:visible?visibleIds.length:null,missingIds,
        allVisibleAssignmentsCaptured:visible?true:null,provesPaginationComplete:false},assignments};
    await updateRefresh(runId,value=>{const target=value.canvas.find(course=>course.course.id===courseId);target.status='ok';target.snapshot=snapshot;});
    return{courseId,title:entry.course.title,tasks:assignments.length,capturedAt:snapshot.capturedAt,paginationVerified:false,uiCrossCheck:snapshot.uiCrossCheck};
  }catch{
    await updateRefresh(runId,value=>{const target=value.canvas.find(course=>course.course.id===courseId);target.status='error';target.code='BROWSER_CAPTURE_FAILED';});
    throw new Error(`Canvas course ${courseId} refresh failed. Inspect the current login or page; old task data was not substituted.`);
  }
}
