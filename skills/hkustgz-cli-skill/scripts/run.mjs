#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const installed=resolve(here,'../runtime');
const runtime=existsSync(join(installed,'package.json'))?installed:resolve(here,'../../..');
const packageInfo=JSON.parse(await readFile(join(runtime,'package.json'),'utf8'));
if(packageInfo.name!=='hkustgz-cli')throw new Error('Cannot locate hkustgz-cli runtime. Reinstall from its release source.');
const {run}=await import(pathToFileURL(join(runtime,'src/main.js')).href);
const result=await run(process.argv.slice(2));
process.stdout.write(JSON.stringify(result.payload)+'\n');process.exitCode=result.exitCode;
