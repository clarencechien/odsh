import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT,RUNS,readJSON,writeJSON} from '../src/common.mjs';
import {createPreview} from '../src/server.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-v2';
const server=await createPreview({port:0}),port=server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[],errors=[];fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
const record=(name)=>{results.push({name,pass:true});console.log('PASS',name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${port}/demo-2026-q3${suffix}/build`;
 await page.goto(base+'/site/d/atlas/');await page.getByRole('heading',{name:'ENERGY LOOP / 供需與韌性',exact:true}).waitFor();
 await page.locator('.odd-filters select').first().locator('option').nth(2).waitFor({state:'attached'});
 const atlas=await page.locator('body').innerText();assert.ok(atlas.includes('最小契約容量裕度'));assert.equal(await page.locator('.odd-filters select').first().locator('option').count(),3);record('Atlas layout and tenant-scoped site options');
 await page.screenshot({path:path.join(ROOT,'test-results/atlas.png'),fullPage:true});
 for(const [customer,text]of [['meridian','MOBILITY / 補能服務'],['helios','COMPUTE / 冷卻診斷']]){
  await page.goto(`${base}/site/d/${customer}/`);await page.getByRole('heading',{name:text,exact:true}).waitFor();record(customer+' distinct layout');await page.screenshot({path:path.join(ROOT,'test-results',customer+'.png'),fullPage:true});
 }
 const catalog=readJSON(path.join(RUNS,'demo-2026-q3'+suffix+'/build/manifest.json')).catalog.filter(c=>c.site);
 for(const item of catalog){await page.goto(`${base}/site/d/${item.id}/`);await page.getByRole('heading',{name:'整合方案 / 已安裝子系統',exact:true}).waitFor();assert.equal(await page.locator('.odd-filters select').count(),1);if(!item.domains.includes('storage'))assert.equal(await page.getByRole('heading',{name:'STORAGE / 儲能管理',exact:true}).count(),0);await page.waitForFunction(site=>document.querySelector('.odd-dashboard-page').innerText.includes(site),item.site);}
 record('all six site dashboards match installed solution and fixed site scope');
 // Open single files without a server and deny all HTTP(S) traffic.
 await context.setOffline(true);const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 for(const name of ['report.html','report-native.html','dashboard.html']){
  await page.goto('about:blank');await page.setContent(fs.readFileSync(path.join(RUNS,'demo-2026-q3'+suffix+'/build',name),'utf8'),{waitUntil:'load'});await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>0);
  if(name==='dashboard.html'){
   await page.locator('.odd-filters select').first().selectOption('ATL-1');
   await page.waitForFunction(()=>document.body.innerText.includes('1 座'));
   await page.locator('select').nth(1).selectOption('previous');
   await page.waitForFunction(()=>document.body.innerText.includes('2026-09-17'));
   record('dashboard offline site and week filtering');
  }else{
   assert.equal(await page.locator('.odd-filters select').count(),0);
   await page.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();
   assert.ok(await page.locator('.odd-panel-waterfall svg').count()>0);
   assert.ok(await page.locator('.odd-panel-dumbbell svg').count()>0);
   record(name+' fixed weekly brief renders offline');
  }
  if(name==='report.html')await page.screenshot({path:path.join(ROOT,'test-results/report.png'),fullPage:true});
 }
 assert.deepEqual(requests,[]);record('single-file reports make zero network requests');
 await context.setOffline(false);
 for(const framework of ['react','vue']){
  await page.goto(base+`/demos/${framework}/`);const frame=page.frameLocator('iframe');await frame.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();assert.equal(await frame.locator('select').count(),0);record(framework+' iframe renders fixed report');
 }
 // Customer releases contain only one customer's data, in every precomputed filter combination.
 for(const [slug,others]of [['atlas',['Meridian Logistics','Helios Cloud']],['meridian',['Atlas Semiconductor','Helios Cloud']],['helios',['Atlas Semiconductor','Meridian Logistics']]]){
  const dir=path.join(RUNS,slug+'-2026-q3'+suffix+'/build');
  for(const file of ['report.html','dashboard.html']){const html=fs.readFileSync(path.join(dir,file),'utf8');for(const other of others)assert.ok(!html.includes(other),`${slug} leaked ${other}`);}
  await page.goto(`http://127.0.0.1:${port}/${slug}-2026-q3${suffix}/build/dashboard.html`);await page.locator('.odd-filters select').first().locator('option').nth(2).waitFor({state:'attached'});assert.equal(await page.locator('.odd-filters select').first().locator('option').count(),3);
 }
 record('three customer exports exclude other tenant names and filter options');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/report.html');await page.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(width.scroll<=width.client+2,JSON.stringify(width));await page.screenshot({path:path.join(ROOT,'test-results/mobile.png'),fullPage:true});record('mobile report fits viewport');
 for(const slug of ['atlas','meridian','helios']){
  await page.goto(`http://127.0.0.1:${port}/${slug}-2026-q3${suffix}/build/dashboard.html`);
  await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>2);
  const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(bounds.scroll<=bounds.client+2,slug+JSON.stringify(bounds));
 }
 record('all customer dashboards fit mobile viewport');
 const response=await fetch(`http://127.0.0.1:${port}/demo-2026-q3${suffix}/input/meters.parquet`);assert.equal(response.status,404);record('preview does not expose source Parquet');
 assert.deepEqual(errors,[]);record('zero browser runtime errors');
 writeJSON(path.join(ROOT,'test-results/e2e.json'),{ok:true,checks:results});
} catch(e){writeJSON(path.join(ROOT,'test-results/e2e.json'),{ok:false,checks:results,error:e.message,browserErrors:errors});throw e;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
