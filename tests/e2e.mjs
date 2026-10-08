import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {ROOT,RUNS,readJSON,writeJSON} from '../src/common.mjs';
import {createPreview} from '../src/server.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'';
const server=await createPreview({port:0}),port=server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[],errors=[];fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
const record=(name)=>{results.push({name,pass:true});console.log('PASS',name);};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${port}/demo-2026-q3${suffix}/build`;
 await page.goto(base+'/site/d/atlas/');await page.getByRole('heading',{name:'RESILIENCE / 供電韌性',exact:true}).waitFor();
 await page.locator('.odd-filters select').first().locator('option').nth(4).waitFor({state:'attached'});
 const atlas=await page.locator('body').innerText();assert.ok(atlas.includes('最小契約容量裕度'));assert.equal(await page.locator('.odd-filters select').first().locator('option').count(),5);record('Atlas layout and tenant-scoped site options');
 await page.screenshot({path:path.join(ROOT,'test-results/atlas.png'),fullPage:true});
 for(const [customer,text]of [['meridian','MOBILITY / 場站補能'],['helios','COMPUTE / 算力能效']]){
  await page.goto(`${base}/site/d/${customer}/`);await page.getByRole('heading',{name:text,exact:true}).waitFor();record(customer+' distinct layout');await page.screenshot({path:path.join(ROOT,'test-results',customer+'.png'),fullPage:true});
 }
 const catalog=readJSON(path.join(RUNS,'demo-2026-q3'+suffix+'/build/manifest.json')).catalog.filter(c=>c.site);
 for(const item of catalog){await page.goto(`${base}/site/d/${item.id}/`);await page.getByRole('heading',{name:'整合方案',exact:true}).waitFor();assert.equal(await page.locator('.odd-filters select').count(),1);if(!item.domains.includes('storage'))assert.equal(await page.getByRole('heading',{name:'STORAGE / 儲能管理',exact:true}).count(),0);assert.ok((await page.locator('.odd-dashboard-page').innerText()).includes(item.site));}
 record('all twelve site dashboards match installed solution and fixed site scope');
 // Open single files without a server and deny all HTTP(S) traffic.
 await context.setOffline(true);const requests=[];page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 for(const name of ['report.html','report-native.html','dashboard.html']){
  await page.goto('about:blank');await page.setContent(fs.readFileSync(path.join(RUNS,'demo-2026-q3'+suffix+'/build',name),'utf8'),{waitUntil:'load'});await page.locator('.odd-filters select').first().waitFor();
  const panel=page.locator('.odd-panel').filter({has:page.getByText('用電量 · kWh',{exact:true})}).first();
  await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>0);
  const before=await panel.innerText();await page.locator('.odd-filters select').first().selectOption('ATL-1');
  await page.waitForFunction(before=>[...document.querySelectorAll('.odd-panel')].find(p=>p.textContent.includes('用電量 · kWh'))?.innerText!==before,before);
  const after=await panel.innerText();assert.notEqual(before,after);
  const period=page.locator('select').nth(1);await period.selectOption('previous');await page.waitForFunction(()=>document.body.innerText.includes('Sep 17')||document.body.innerText.includes('2026-09-17'));
  record(name+' offline site and week filtering');
  if(name==='report.html')await page.screenshot({path:path.join(ROOT,'test-results/report.png'),fullPage:true});
 }
 assert.deepEqual(requests,[]);record('single-file reports make zero network requests');
 await context.setOffline(false);
 for(const framework of ['react','vue']){
  await page.goto(base+`/demos/${framework}/`);const frame=page.frameLocator('iframe');await frame.locator('.odd-filters select').first().waitFor();await frame.locator('.odd-filters select').first().selectOption('ATL-1');await frame.getByText('Chiller efficiency degradation',{exact:true}).waitFor();record(framework+' iframe renders and filters');
 }
 // Customer releases contain only one customer's data, in every precomputed filter combination.
 for(const [slug,others]of [['atlas',['Meridian Logistics','Helios Cloud']],['meridian',['Atlas Semiconductor','Helios Cloud']],['helios',['Atlas Semiconductor','Meridian Logistics']]]){
  const dir=path.join(RUNS,slug+'-2026-q3'+suffix+'/build');
  for(const file of ['report.html','dashboard.html']){const html=fs.readFileSync(path.join(dir,file),'utf8');for(const other of others)assert.ok(!html.includes(other),`${slug} leaked ${other}`);}
  await page.goto(`http://127.0.0.1:${port}/${slug}-2026-q3${suffix}/build/dashboard.html`);await page.locator('.odd-filters select').first().locator('option').nth(4).waitFor({state:'attached'});assert.equal(await page.locator('.odd-filters select').first().locator('option').count(),5);
 }
 record('three customer exports exclude other tenant names and filter options');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/report.html');await page.locator('.odd-filters select').first().waitFor();
 const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(width.scroll<=width.client+2,JSON.stringify(width));await page.screenshot({path:path.join(ROOT,'test-results/mobile.png'),fullPage:true});record('mobile report fits viewport');
 const response=await fetch(`http://127.0.0.1:${port}/demo-2026-q3${suffix}/input/meters.parquet`);assert.equal(response.status,404);record('preview does not expose source Parquet');
 assert.deepEqual(errors,[]);record('zero browser runtime errors');
 writeJSON(path.join(ROOT,'test-results/e2e.json'),{ok:true,checks:results});
} catch(e){writeJSON(path.join(ROOT,'test-results/e2e.json'),{ok:false,checks:results,error:e.message,browserErrors:errors});throw e;}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
