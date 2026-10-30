import {mkdir,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {APP_ROOT,stateHome} from '../lib/state.js';

export async function setup(){
  const home=stateHome();await mkdir(home,{recursive:true});await access(home,constants.R_OK|constants.W_OK);
  return{ready:true,stateDirectory:home,appDirectory:APP_ROOT,nodeSupported:Number(process.versions.node.split('.')[0])>=20,
    browserWorkflowModule:pathToFileURL(join(APP_ROOT,'scripts/agent-workflow.mjs')).href,
    docs:{userGuide:join(APP_ROOT,'README.md'),daily:join(APP_ROOT,'docs/DAILY.md')},
    requirements:['AI can execute local Node.js commands','Host-supported Browser tool with normal school login'],
    loginUrls:{sisn:'https://sisn.hkust-gz.edu.cn/',canvas:'https://hkust-gz.instructure.com/'},
    next:'The AI loads browserWorkflowModule, calls configure({stateDirectory}) using this output, then start() and separate step(browser) calls until finished. The user only completes normal school login when required.',
    authenticated:null};
}
