import {homedir} from 'node:os';
import {resolve,join,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CliError} from './errors.js';

export const APP_ROOT=fileURLToPath(new URL('../../',import.meta.url));
let configuredHome;
export function configureStateHome(value){
  if(typeof value!=='string'||!isAbsolute(value))throw new CliError('INVALID_ARGUMENT','State directory must be absolute.');
  configuredHome=resolve(value);
}
export function stateHome(){
  const value=configuredHome??(typeof process==='undefined'?undefined:process.env.HKUSTGZ_HOME);
  if(value&&!isAbsolute(value))throw new CliError('INVALID_ARGUMENT','HKUSTGZ_HOME must be an absolute directory.');
  return value?resolve(value):join(homedir(),'.hkustgz-cli');
}
