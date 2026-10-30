import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {chromium} from 'playwright';import {generateRun} from '../src/pack.mjs';import {build} from '../src/run.mjs';
import {ROOT,runPath,readJSON,fileHash,writeJSON} from '../src/common.mjs';
test('imitator chassis bytes and real browser light/dark/print mapping',{timeout:180000},async()=>{
 const id=`test-brand-${process.pid}`,dir=runPath(id),file=path.join(ROOT,'packs/imitator-brand/brand/report.css');
 const provenance=readJSON(path.join(ROOT,'packs/imitator-brand/brand/provenance.json'));
 assert.equal(fs.statSync(file).size,22857);assert.equal(fileHash(file),provenance.sha256);
 let browser;const checks=[];
 try{
  await generateRun(id,{pack:'o11y',days:2});await build(id,{brand:'imitator-brand'});
  const html=fs.readFileSync(path.join(dir,'build/report.html'),'utf8');
  assert.ok(html.includes(`<style data-report-brand="chassis">${fs.readFileSync(file,'utf8')}</style>`));
  assert.ok(!/<link[^>]+report\.css/.test(html));assert.ok(html.indexOf('imitator-style')<8192);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  for(const scheme of ['light','dark']){
   const context=await browser.newContext({offline:true,colorScheme:scheme,viewport:{width:1440,height:1000}}),page=await context.newPage(),requests=[],errors=[];
   page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(html);await page.getByRole('heading',{name:'觀測範圍',exact:true}).waitFor();
   const styles=await page.evaluate(()=>({background:getComputedStyle(document.body).backgroundColor,font:getComputedStyle(document.querySelector('.report-title')).fontFamily,border:getComputedStyle(document.querySelector('.odd-panel')).borderTopColor}));
   assert.equal(styles.background,scheme==='light'?'rgb(251, 251, 250)':'rgb(25, 25, 23)');
   assert.match(styles.font,/Serif|serif/);assert.equal(styles.border,scheme==='light'?'rgb(230, 230, 227)':'rgb(51, 51, 49)');
   assert.equal(await page.locator('.odd-header').isVisible(),false);
   assert.equal(await page.getByRole('heading',{level:1}).count(),1);
   await page.screenshot({path:path.join(ROOT,`test-results/imitator-${scheme}.png`),fullPage:true});
   await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-theme'),scheme==='light'?'dark':'light');
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
   await page.emulateMedia({media:'print'});assert.ok(!(await page.locator('#theme-toggle').isVisible()));
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);checks.push({scheme,...styles,mobile:true,offline:true,print:true});await context.close();
  }
  writeJSON(path.join(ROOT,'test-results/brand.json'),{ok:true,provenance,checks});
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
