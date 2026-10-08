#!/usr/bin/env node
import path from 'node:path';import fs from 'node:fs';
import { generate } from './generate.mjs';
import { build, check, prepareWorkspace, writeIndex } from './build.mjs';
import { runPath } from './common.mjs';
import { exportRill } from './export-rill.mjs';
import { createPreview } from './server.mjs';
import { publishSilo, serveSilo } from './silo.mjs';
import { validateData } from './quality.mjs';
const [command,id,...args]=process.argv.slice(2);
const option=name=>{const index=args.indexOf('--'+name);return index<0?undefined:args[index+1];};
try {
 if(command==='generate')console.log(await generate(id,{tenant:option('tenant'),...(option('days')?{days:Number(option('days'))}:{}),...(option('seed')?{seed:Number(option('seed'))}:{})}));
 else if(command==='build'){const m=await build(id);console.log(JSON.stringify({run_id:id,data_hash:m.data_hash,dashboards:m.catalog.length+2,queries:Object.keys(m.queries).length,warnings:m.warnings},null,2));}
 else if(command==='check'||command==='lint'){const workspace=prepareWorkspace(id);const result=await check(workspace,path.join(runPath(id),'validation'));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}
 else if(command==='validate-data'){const result=await validateData(runPath(id));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}
 else if(command==='export-rill')console.log(await exportRill(id));
 else if(command==='publish-silo')console.log(await publishSilo(id,{internal:args.includes('--internal')}));
 else if(command==='serve-silo'){if(!['atlas','meridian','helios','internal'].includes(id))throw Error('Choose silo: atlas|meridian|helios|internal');await serveSilo(id);console.log('Customer silo preview listening on port 4174');}
 else if(command==='index')writeIndex();
 else if(command==='serve'){writeIndex();await createPreview();console.log('ATLED Engergy preview listening on port 4173 (loopback only)');}
 else if(command==='dev'){const {dev}=await import('@open-dashboard/core/node');await dev({root:prepareWorkspace(id),port:5473,host:'127.0.0.1'});}
 else if(command==='verify'){const {fileHash,readJSON}=await import('./common.mjs');const dir=runPath(id),m=readJSON(path.join(dir,'build/manifest.json'));for(const [p,a]of Object.entries(m.artifacts))if(fileHash(path.join(dir,'build',p))!==a.sha256)throw Error(`Artifact altered: ${p}`);for(const [p,a]of Object.entries(m.inputs))if(fileHash(path.join(dir,'input',p))!==a.sha256)throw Error(`Input altered: ${p}`);console.log('All artifact and input checksums verified');}
 else {console.log('snapreport generate|build|check|lint|validate-data|verify|dev|export-rill|publish-silo <run_id>\nsnapreport serve|index\ngenerate options: --tenant "Atlas Semiconductor" --days 92 --seed 42');if(command)process.exitCode=1;}
}catch(e){console.error(e.message);process.exitCode=1;}
