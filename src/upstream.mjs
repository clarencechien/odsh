import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {ROOT} from './common.mjs';
// Temporary export-only exception: 0.12 has no export-html CLI, and exportHtml
// requires these two constructors. Keep all three here, pin patch, never emulate Workspace.
import {exportHtml, Workspace, loadConfig} from '@open-dashboard/core/node';
export const executable=path.join(ROOT,'node_modules/.bin/open-dashboard');
export function upstream(args,{root=ROOT,timeout=240000}={}){
 const result=spawnSync(executable,[...args,'--root',root],{cwd:root,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
 if(result.error)throw result.error;
 return {status:result.status,stdout:result.stdout,stderr:result.stderr};
}
export function upstreamJSON(args,options){
 const result=upstream([...args,'--json'],options);
 try{return {...result,data:JSON.parse(result.stdout)};}
 catch{throw Error(`Upstream ${args[0]} did not return JSON: ${result.stderr||result.stdout}`);}
}
export async function singleHtml(root,id,{maxRuns=100}={}){
 const workspace=new Workspace(await loadConfig(root));
 try{return await exportHtml(workspace,id,'',{maxRuns});}
 finally{await workspace.close();}
}
export function startUpstream(command,root,{port=5473,mcp=command==='dev',stdio='inherit'}={}){
 if(!['dev','serve','mcp'].includes(command))throw Error('Unsupported runtime command');
 const args=[command,'--root',root];
 if(command!=='mcp')args.push('--port',String(port),'--host','127.0.0.1');
 if(mcp&&command==='dev')args.push('--mcp');
 return spawn(executable,args,{cwd:root,stdio});
}
