#!/usr/bin/env node
import path from 'node:path';import fs from 'node:fs';import {parseArgs} from 'node:util';
import {build,check,writeIndex} from './run.mjs';
import {generateRun,prepareWorkspace} from './pack.mjs';
import {runPath,fileHash,readJSON} from './common.mjs';
import {exportRill} from './export-rill.mjs';import {createPreview} from './server.mjs';
import {publishSilo,serveSilo} from './silo.mjs';import {startUpstream} from './upstream.mjs';
try{
 const {values,positionals}=parseArgs({allowPositionals:true,options:Object.fromEntries(['pack','brand','tenant','days','seed','port','input'].map(k=>[k,{type:'string'}]).concat([['internal',{type:'boolean'}],['all-params',{type:'boolean'}]]))});
 const [command,id]=positionals,options={...values};
 for(const key of ['days','seed','port'])if(options[key]!==undefined)options[key]=Number(options[key]);
 if(command==='generate')console.log(await generateRun(id,options));
 else if(command==='build'){const m=await build(id,options);console.log(JSON.stringify({run_id:id,pack:m.pack,data_hash:m.data_hash,queries:Object.keys(m.queries).length,warnings:m.warnings},null,2));}
 else if(command==='check'||command==='lint'){
  const result=await check(await prepareWorkspace(id,options),path.join(runPath(id),'validation'));
  console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
 }
 else if(command==='export-rill')console.log(await exportRill(id));
 else if(command==='publish-silo')console.log(await publishSilo(id,options));
 else if(command==='serve-silo'){await serveSilo(id,options);console.log('Scoped object preview listening on loopback');}
 else if(command==='index')writeIndex();
 else if(command==='serve'){writeIndex();await createPreview({port:options.port||4173});console.log('Snapshot preview listening on loopback');}
 else if(['dev','live','mcp'].includes(command)){
  const child=startUpstream(command==='live'?'serve':command,await prepareWorkspace(id,options),{port:options.port||5473});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));
 }
 else if(command==='verify'){
  const dir=runPath(id),m=readJSON(path.join(dir,'build/manifest.json'));
  for(const [group,entries] of [['build',m.artifacts],['input',m.inputs]])for(const [file,item]of Object.entries(entries))if(fileHash(path.join(dir,group,file))!==item.sha256)throw Error(`Checksum mismatch: ${group}/${file}`);
  console.log('All artifact and input checksums verified');
 }
 else{console.log('snapreport generate|build|check|lint|verify|dev|live|mcp|export-rill|publish-silo <run_id> [--pack name]\nsnapreport serve|index\ngenerate: --tenant name --days n --seed n --input file\nbuild: --brand name');if(command)process.exitCode=1;}
}catch(error){console.error(error.message);process.exitCode=1;}
