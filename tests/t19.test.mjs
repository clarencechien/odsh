import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {ROOT,filesUnder} from '../src/common.mjs';
test('T19 core and TD contain no domain vocabulary or direct pack imports',()=>{
 const forbidden=/energy|ATLED|Engergy|meters|solar|battery|kwh|tariff|site_id|atlas|meridian|helios/i;
 for(const dir of ['src','td'])if(fs.existsSync(path.join(ROOT,dir)))for(const file of filesUnder(path.join(ROOT,dir)).filter(f=>f.endsWith('.mjs'))){
  const source=fs.readFileSync(file,'utf8');assert.ok(!forbidden.test(source),path.relative(ROOT,file));
  assert.ok(!/(?:from\s*|import\s*\()["'][^"']*packs\//.test(source),`Direct pack import: ${file}`);
 }
});
