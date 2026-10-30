#!/usr/bin/env node
import {cp,mkdir,readFile,writeFile,rename,lstat,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {resolve,join,dirname,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';

export async function install({codexHome=process.env.CODEX_HOME||join(homedir(),'.codex')}={}){
  const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const packageInfo=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
  const skills=resolve(codexHome,'skills'),target=join(skills,'hkustgz-cli');
  const relation=relative(target,source);
  const reverse=relative(source,target);
  if(relation===''||(!relation.startsWith('..'+sep)&&!isAbsolute(relation))||(!reverse.startsWith('..'+sep)&&!isAbsolute(reverse)))throw new Error('Installation source and destination must not contain one another.');
  await mkdir(skills,{recursive:true});
  const stage=join(skills,`.hkustgz-cli-stage-${randomUUID()}`),backup=join(skills,`.hkustgz-cli-backup-${randomUUID()}`);
  let exists=false;
  try{await lstat(target);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  if(exists){
    const info=JSON.parse(await readFile(join(target,'installation.json'),'utf8').catch(()=>'{"managed":false}'));
    if(info.managed!==true||info.package!=='hkustgz-cli')throw new Error('INSTALL_CONFLICT: destination is not a managed hkustgz-cli installation; it was not overwritten.');
  }
  const inside=path=>resolve(path).startsWith(skills+sep)&&/^\.hkustgz-cli-(stage|backup)-/.test(relative(skills,path));
  let moved=false;
  try{
    await mkdir(stage);
    await cp(join(source,'skills','hkustgz-cli-skill'),stage,{recursive:true,filter:async path=>!(await lstat(path)).isSymbolicLink()});
    const runtime=join(stage,'runtime');await mkdir(runtime);
    for(const item of ['src','data','scripts','docs','package.json','README.md','INSTALL.md','HANDOFF.md']){
      await cp(join(source,item),join(runtime,item),{recursive:true,filter:async path=>!(await lstat(path)).isSymbolicLink()});
    }
    await writeFile(join(stage,'installation.json'),JSON.stringify({managed:true,package:'hkustgz-cli',version:packageInfo.version,installedAt:new Date().toISOString()},null,2)+'\n');
    if(exists){await rename(target,backup);moved=true;}
    await rename(stage,target);
    let cleanupWarning=false;
    if(moved&&inside(backup))await rm(backup,{recursive:true,force:true}).catch(()=>{cleanupWarning=true;});
    return{installed:true,version:packageInfo.version,skillDirectory:target,cli:join(target,'scripts','run.mjs'),
      next:'Let the AI read the installed SKILL.md. Complete school sign-in only when Browser asks.',
      ...(cleanupWarning?{warning:'Installation succeeded; an old managed backup remains in the skills directory.'}:{})};
  }catch(error){
    if(moved){try{await rename(backup,target);}catch{}}
    if(inside(stage))await rm(stage,{recursive:true,force:true});
    throw error;
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const{values}=parseArgs({options:{'codex-home':{type:'string'}},strict:true});console.log(JSON.stringify({ok:true,data:await install({codexHome:values['codex-home']})}));}
  catch(error){console.error(JSON.stringify({ok:false,error:{code:'INSTALL_FAILED',message:error.message}}));process.exitCode=1;}
}
