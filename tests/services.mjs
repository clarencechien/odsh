import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {DuckDBInstance} from '@duckdb/node-api';import {parse} from 'yaml';
import {ROOT,RUNS,readJSON,writeJSON,sqlString} from '../src/common.mjs';
import {siloClient,serveSilo,publishSilo} from '../src/silo.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-v2';
const checks=[];const record=name=>{checks.push({name,pass:true});console.log('PASS',name);};
// Re-execute exported semantic expressions directly over the Rill source Parquet.
const rill=path.join(RUNS,'demo-2026-q3'+suffix,'rill'),view=parse(fs.readFileSync(path.join(rill,'metrics/energy.yaml'),'utf8'));
const inst=await DuckDBInstance.create(':memory:'),db=await inst.connect();
try{
 await db.run(`CREATE VIEW meters AS SELECT * FROM read_parquet(${sqlString(path.join(rill,'data/meters.parquet'))})`);
 for(const measure of view.measures){const rows=(await db.runAndReadAll(`SELECT ${measure.expression} AS value FROM meters`)).getRowObjectsJS();assert.ok(Number.isFinite(Number(rows[0].value)),measure.name);}
 record('all seven Rill interval metric expressions execute on exported Parquet');
 for(const file of fs.readdirSync(path.join(rill,'sources'))){const source=parse(fs.readFileSync(path.join(rill,'sources',file),'utf8'));assert.ok(fs.existsSync(path.join(rill,source.path)));}
 record('all Rill source YAML files resolve to portable copied Parquet');
}finally{db.closeSync();inst.closeSync();}
const client=siloClient();
for(const scope of ['atlas','meridian','helios']){
 const id=scope+'-2026-q3'+suffix;
 const result=await publishSilo(id);assert.ok(result.objects_verified>100);
 const anonymous=await fetch(`http://127.0.0.1:9000/atled-${scope}/${id}/build/report.html`);assert.equal(anonymous.status,403);
 record(scope+' Silo immutable republish/read-back and anonymous access denied');
}
const gateway=await serveSilo('atlas',{port:0}),port=gateway.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/atlas-2026-q3${suffix}/build/site/d/site-atl-1/`);
 await page.getByRole('heading',{name:'整合方案 / 已安裝子系統',exact:true}).waitFor();await page.locator('.odd-filters select').selectOption('previous');
 await page.waitForFunction(()=>document.body.innerText.includes('Sep 17')||document.body.innerText.includes('2026-09-17'));
 assert.deepEqual(errors,[]);record('Silo serves static site assets/data and working week filter');
 await page.goto(`http://127.0.0.1:${port}/atlas-2026-q3${suffix}/build/report.html`);await page.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();assert.equal(await page.locator('select').count(),0);record('Silo fixed weekly report renders');
 const denied=await fetch(`http://127.0.0.1:${port}/meridian-2026-q3${suffix}/build/report.html`);assert.equal(denied.status,404);record('customer gateway cannot read another tenant bucket');
}finally{await browser.close();await new Promise(r=>gateway.close(r));}
// Start an isolated, actual DuckDB-backed developer API for this check.
const {dev}=await import('@open-dashboard/core/node');
const live=await dev({root:path.join(RUNS,'demo-2026-q3'+suffix,'workspace'),port:5475,host:'127.0.0.1'});
try {
for(const site of ['ATL-1','ATL-2']){
 const params=new URLSearchParams({id:'energy',name:'kpis',params:JSON.stringify({site,window:'current'})});
 const response=await fetch('http://127.0.0.1:5475/__odd/api/query?'+params);assert.equal(response.status,200);
 const json=await response.json();assert.ok(json.result.rows[0].load_kwh>0);assert.equal(json.result.rows[0].site_count,1);
}
} finally {await live.close();}
record('live developer API runs DuckDB queries for distinct site parameters');
writeJSON(path.join(ROOT,'test-results/services.json'),{ok:true,checks,rill_runtime:'not installed; YAML/source paths and SQL expressions validated',silo_backend:'pgsty/silo'});
