import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';import {spawnSync} from 'node:child_process';
import {ROOT,runPath,readJSON,writeJSON,fileHash,filesUnder} from '../src/common.mjs';
const id=process.env.ODSH_O11Y_RUN||'o11y-2026-10-s1-final',dir=runPath(id),checks=[];
const passed=name=>{checks.push({name,pass:true});console.log('PASS',name);};
const manifest=readJSON(path.join(dir,'build/manifest.json'));
assert.equal(manifest.pack,'o11y');assert.equal(manifest.synthetic,true);passed('report explicitly identifies synthetic provenance');
const verified=spawnSync(process.execPath,['src/cli.mjs','verify',id],{cwd:ROOT,encoding:'utf8'});assert.equal(verified.status,0,verified.stderr);passed('input and output checksums verified');
assert.ok(readJSON(path.join(dir,'build/check.json')).every(r=>r.sweep.failedRuns===0));passed('native check covered all filter combinations');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
let transport='file://';const requests=[],errors=[];
try{
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});let page=await context.newPage();
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 try{await page.goto(pathToFileURL(path.join(dir,'build/report.html')).href);}catch(error){
  if(!/ERR_BLOCKED_BY_ADMINISTRATOR/.test(error.message))throw error;
  transport='offline setContent (file navigation blocked by managed browser)';await page.close();page=await context.newPage();page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));await page.setContent(fs.readFileSync(path.join(dir,'build/report.html'),'utf8'));
 }
 await page.getByRole('heading',{name:'觀測範圍',exact:true}).waitFor();
 await page.waitForFunction(()=>document.body.innerText.includes('合成資料 / SYNTHETIC'));
 const select=page.locator('.odd-filters select');await select.locator('option').nth(3).waitFor({state:'attached'});
 await select.selectOption('checkout');await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>=2);
 await page.waitForFunction(()=>document.querySelector('.odd-panel-prose').textContent.includes('SYNTHETIC'));
 const table=page.locator('.odd-panel-table');await page.waitForFunction(()=>[...document.querySelectorAll('.odd-panel-table tbody tr')].every(r=>r.textContent.includes('checkout')));
 assert.ok(await table.locator('tbody tr').count()>0);passed('offline report renders and service filter changes endpoint rows');
 await page.screenshot({path:path.join(ROOT,'test-results/o11y-report.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));passed('report fits mobile viewport');
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);passed('zero external requests and browser errors');
}finally{await browser.close();}
const before=path.join(ROOT,'test-results/w4-core-before.json');let sourceUnchanged;
if(fs.existsSync(before)){sourceUnchanged=JSON.stringify(readJSON(before))===JSON.stringify(Object.fromEntries(filesUnder(path.join(ROOT,'src')).map(f=>[path.relative(ROOT,f),fileHash(f)])));}
writeJSON(path.join(ROOT,'test-results/o11y.json'),{ok:true,run:id,source:manifest.synthetic?'synthetic':'provided',transport,sourceUnchanged,checks});
