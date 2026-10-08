import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {DuckDBInstance} from '@duckdb/node-api';
import {ROOT,runPath,readJSON,sqlString,writeJSON,hash,stableJSON} from '../src/common.mjs';
import {generate} from '../src/generate.mjs';import {validateData} from '../src/quality.mjs';import {prepareWorkspace,check} from '../src/build.mjs';
const id=`test-atlas-${process.pid}`;
test('generated tenant snapshot: physical invariants, installed assets, incident truth and stable seeded data',async()=>{
 try{
  await generate(id,{tenant:'Atlas Semiconductor',days:21});
  const dir=runPath(id),quality=await validateData(dir);assert.equal(quality.ok,true,JSON.stringify(quality));assert.equal(quality.checks.length,23);
  const inst=await DuckDBInstance.create(':memory:'),db=await inst.connect();
  try{
   const rows=async sql=>(await db.runAndReadAll(sql)).getRowObjectsJS();
   await db.run(`CREATE VIEW m AS SELECT * FROM '${dir}/input/meters.parquet'`);
   const unsupported=await rows("SELECT count(*) n FROM m WHERE site_id='ATL-2' AND (it_kw<>0 OR battery_charge_kw<>0 OR ev_kw<>0)");assert.equal(Number(unsupported[0].n),0);
   const pue=await rows("SELECT max(datacenter_kw/it_kw) pue FROM m WHERE site_id='ATL-1'");assert.ok(pue[0].pue>1 && pue[0].pue<1.6);
   const tenants=await rows('SELECT DISTINCT tenant FROM m');assert.deepEqual(tenants.map(t=>t.tenant),['Atlas Semiconductor']);
  }finally{db.closeSync();inst.closeSync();}
  const original=readJSON(path.join(dir,'generation.json'));assert.equal(original.site_profiles.length,2);
  await assert.rejects(generate(id,{tenant:'Atlas Semiconductor',days:21}),/Run exists/);
  const second=`${id}-repeat`;try{await generate(second,{tenant:'Atlas Semiconductor',days:21});
    // Parquet writer metadata is stable too: input bytes are deterministic for the pinned generator.
    for(const table of ['meters','telemetry','sites','assets','events'])assert.equal(hash(fs.readFileSync(path.join(dir,'input',table+'.parquet'))),hash(fs.readFileSync(path.join(runPath(second),'input',table+'.parquet'))));
  }finally{fs.rmSync(runPath(second),{recursive:true,force:true});}
 }finally{fs.rmSync(runPath(id),{recursive:true,force:true});}
});
test('renderer rejects a bad panel column; bounded lint check produces actionable findings',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atled-check-'));
 try{
  fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(tmp,'node_modules'),'dir');
  fs.mkdirSync(path.join(tmp,'dashboards/bad'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'open-dashboard.config.ts'),"export default {datasources:{energy:{type:'duckdb'}},defaultSource:'energy'}");
  fs.writeFileSync(path.join(tmp,'snapreport.yaml'),'lint:\n  allowLiterals: []\n');
  fs.writeFileSync(path.join(tmp,'dashboards/bad/queries.sql'),'-- name: q\nSELECT 42 AS actual;');
  fs.writeFileSync(path.join(tmp,'dashboards/bad/index.tsx'),"import {Dashboard,Stat} from '@open-dashboard/core'; export const meta={title:'Bad'}; export default function X(){return <Dashboard><Stat title='Broken' query='q' column='missing'/></Dashboard>}");
  const result=await check(tmp,tmp);assert.equal(result.ok,false);
  const report=readJSON(path.join(tmp,'check.json'));assert.ok(report[0].findings.some(f=>f.message.includes('missing')&&f.where.includes(':1')));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('actual renderer warns when filter enumeration exceeds maxRuns',async()=>{
 const {Workspace,loadConfig,snapshotDashboard}=await import('@open-dashboard/core/node');
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atled-trim-'));
 let ws;
 try{
  fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(tmp,'node_modules'),'dir');fs.mkdirSync(path.join(tmp,'dashboards/demo'),{recursive:true});
  fs.writeFileSync(path.join(tmp,'open-dashboard.config.ts'),"export default {datasources:{energy:{type:'duckdb'}},defaultSource:'energy'}");
  fs.writeFileSync(path.join(tmp,'dashboards/demo/index.tsx'),"import {Dashboard,Filters,Select,Stat} from '@open-dashboard/core';export const meta={title:'Trim test'};export default function X(){return <Dashboard><Filters><Select name='site' options={['a','b']}/></Filters><Stat title='X' query='q' column='n'/></Dashboard>}");
  fs.writeFileSync(path.join(tmp,'dashboards/demo/queries.sql'),'-- name: q\nSELECT coalesce(:site,\'all\') AS site, 42 AS n;');
  ws=new Workspace(await loadConfig(tmp));const snapshot=await snapshotDashboard(ws,'demo',{maxRuns:1});assert.deepEqual(snapshot.trimmed,['q']);assert.equal(snapshot.runs,1);
 }finally{await ws?.close();fs.rmSync(tmp,{recursive:true,force:true});}
});
