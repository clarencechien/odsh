import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {ROOT,runPath,readJSON,writeJSON} from '../src/common.mjs';import {build} from '../src/run.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-s1-final',ids=[...['demo','atlas','meridian','helios'].map(n=>`${n}-2026-q3${suffix}`),process.env.ODSH_O11Y_RUN||'o11y-2026-10-s1-final'],checks=[];
for(const id of ids){const before=readJSON(path.join(runPath(id),'build/manifest.json')),after=await build(id);assert.equal(after.data_hash,before.data_hash,id);const verify=spawnSync(process.execPath,['src/cli.mjs','verify',id],{cwd:ROOT,encoding:'utf8'});assert.equal(verify.status,0,verify.stderr);checks.push({run:id,data_hash:after.data_hash,pass:true,inputs:after.inputs,quality:after.quality});console.log('PASS',id,after.data_hash);}
writeJSON(path.join(ROOT,'test-results/reproducibility.json'),{ok:true,checks});
