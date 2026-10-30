// Host entry point: requires only the Browser handle supplied by the current host, never old chat variables/tab IDs.
import {beginRefresh,loadRefresh,finishRefresh,updateRefresh} from '../src/lib/daily-store.js';
import {dailyStatus} from '../src/modules/daily.js';
import {configureStateHome} from '../src/lib/state.js';
import {captureSisnWeek,discoverCanvasCourses,captureNextCanvasCourse} from './browser-refresh.mjs';

async function siteTab(browser,origin,preferredPath){
  const tabs=await browser.tabs.list();
  const candidates=tabs.filter(tab=>{try{return new URL(tab.url).origin===origin;}catch{return false;}});
  const match=candidates.find(tab=>new URL(tab.url).pathname===preferredPath)??candidates.find(tab=>!new URL(tab.url).pathname.startsWith('/api/'));
  return match?browser.tabs.get(match.id):browser.tabs.new();
}
export function configure({stateDirectory}){configureStateHome(stateDirectory);return{configured:true};}
export async function start(){return beginRefresh();}
export async function status(){return dailyStatus();}
export async function finishPartial(){
  const current=await dailyStatus();
  if(!current.available)return{action:'start-required'};
  const run=await loadRefresh(current.runId);
  if(run.captureState!=='collecting')return{action:'finished',runId:run.runId,state:run.captureState};
  await updateRefresh(run.runId,value=>{
    for(const source of [value.calendar,value.discovery,...value.canvas]){
      if(source.status==='pending'){source.status='error';source.code='NOT_CAPTURED';}
    }
  });
  return{action:'finished',...await finishRefresh(run.runId)};
}
export async function step(browser){
  let current=await dailyStatus();
  if(!current.available)return{action:'start-required',message:'Start a new refresh before collecting.'};
  const run=await loadRefresh(current.runId);
  if(run.captureState!=='collecting')return{action:'finished',runId:run.runId,state:run.captureState};
  if(run.calendar.status==='error'&&run.discovery.status==='pending'){
    await updateRefresh(run.runId,value=>{value.discovery={status:'error',code:'TERM_SOURCE_UNAVAILABLE'};});
    return{action:'finished',...await finishRefresh(run.runId)};
  }
  let tab,stage;
  try{
    if(run.calendar.status==='pending'){
      stage='sisn-calendar';
      tab=await siteTab(browser,'https://sisn.hkust-gz.edu.cn','/system/my-calendar');
      const result=await captureSisnWeek(tab,run.runId);
      await tab.markHandoff();return{action:'calendar-captured',runId:run.runId,...result};
    }
    if(run.discovery.status==='pending'){
      stage='canvas-course-inventory';
      tab=await siteTab(browser,'https://hkust-gz.instructure.com','/');
      const result=await discoverCanvasCourses(tab,run.runId);
      await tab.markHandoff();return{action:'courses-discovered',runId:run.runId,...result};
    }
    if(run.canvas.some(item=>item.status==='pending')){
      stage='canvas-assignments';
      // Re-discover the temporary interface tab from the current browser inventory on every step.
      const tabs=await browser.tabs.list();
      const match=tabs.find(item=>{try{const u=new URL(item.url);return u.origin==='https://hkust-gz.instructure.com'&&/^\/api\/v1\/courses\/\d+\/assignments$/.test(u.pathname);}catch{return false;}});
      tab=match?await browser.tabs.get(match.id):await browser.tabs.new();
      const result=await captureNextCanvasCourse(tab,run.runId);
      await tab.markHandoff();return{action:'course-captured',runId:run.runId,...result};
    }
    return{action:'finished',...await finishRefresh(run.runId)};
  }catch{
    if(tab)await tab.markHandoff();
    return{action:'needs-attention',runId:run.runId,stage,tabId:tab?.id,
      message:'Check the current site in Browser. If sign-in is required, complete the normal school login there, then start a new attempt. No password/token is requested.'};
  }
}
