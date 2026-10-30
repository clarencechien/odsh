import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {parse,stringify} from 'yaml';
import {ROOT,runPath,readJSON,writeJSON} from '../src/common.mjs';import {checkConsistency} from '../src/consistency.mjs';import {exportRill} from '../src/export-rill.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-s1-final';const checks=[];const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'odsh-consistency-'));
try{
 for(const [pack,id]of [['energy',`demo-2026-q3${suffix}`],['o11y',process.env.ODSH_O11Y_RUN||'o11y-2026-10-s1-final']]){
  const valid=await checkConsistency(id);assert.equal(valid.ok,true,JSON.stringify(valid));assert.equal(valid.measures,pack==='energy'?7:3);
  const metrics=parse(fs.readFileSync(path.join(runPath(id),'workspace/metrics.yaml'),'utf8')),changed=metrics.measures[0].name;
  metrics.measures[0].expression=`(${metrics.measures[0].expression}) + 1`;const file=path.join(tmp,pack+'.yaml');fs.writeFileSync(file,stringify(metrics));
  const invalid=await checkConsistency(id,{metricsFile:file});assert.equal(invalid.ok,false);assert.ok(invalid.checks.some(c=>c.metric===`${pack}.${changed}`&&!c.pass));
  const exported=await exportRill(id);assert.equal(fs.existsSync(path.join(exported.out,'drafts')),false);assert.equal(readJSON(path.join(exported.out,'export-manifest.json')).run_id,id);
  checks.push({pack,run:id,measures:valid.measures,comparisons:valid.checks.length,pass:true,tampered_measure:changed,tamper_rejected:true,no_drafts:true});console.log('PASS',pack,valid.measures,'measures;',valid.checks.length,'snapshots; expression tamper rejected');
 }
 writeJSON(path.join(ROOT,'test-results/consistency.json'),{ok:true,scope:'Full-input scalar references declared by -- metric; not arbitrary filtered chart formulas',checks});
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
