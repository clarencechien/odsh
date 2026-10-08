import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {buildPages} from '../scripts/build-pages.mjs';import {ROOT,filesUnder,writeJSON} from '../src/common.mjs';
const root=buildPages(),prefix='/odsh/';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix)){res.writeHead(404).end();return;}
 const relative=decodeURIComponent(url.pathname.slice(prefix.length));let file=path.resolve(root,relative);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(404).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
async function guideContrast(page){
 const failures=await page.evaluate(()=>{
  const rgb=s=>s.match(/[\d.]+/g).map(Number);
  const luminance=rgb=>rgb.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const bg=n=>{for(;n;n=n.parentElement){const color=getComputedStyle(n).backgroundColor,parts=rgb(color);if(parts.length===3||parts[3]===1)return luminance(parts);}return 1;};
  return [...document.querySelectorAll('p,h1,h2,h3,a,button,small,td,th,summary,.arch-node,.arch-arrow,.artifact li,.artifact code,.badge')].filter(n=>n.getBoundingClientRect().height&&n.textContent.trim()).map(n=>{const a=luminance(rgb(getComputedStyle(n).color)),b=bg(n);return {text:n.textContent.slice(0,60),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};}).filter(r=>r.ratio<4.5);
 });
 assert.deepEqual(failures,[],'guide rendered text contrast >= 4.5:1');
}
const checks=[];const passed=name=>{checks.push({name,pass:true});console.log('PASS',name);};
try{
 assert.ok(filesUnder(root).every(f=>!f.endsWith('.parquet')&&!f.endsWith('.sql')&&!f.endsWith('.log')&&!f.includes('/workspace/odsh/.runtime/pages-site/.runtime/')));
 passed('public bundle contains only reader artifacts');
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],failed=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
 await page.goto(base);await page.getByRole('heading',{name:'Atlas Semiconductor',exact:true}).waitFor();
 const hrefs=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(a=>a.href));
 for(const href of hrefs.filter(h=>h.startsWith(base))){const response=await fetch(href);assert.equal(response.status,200,href);}
 passed('every landing-page link resolves beneath /odsh/');
 for(const slug of ['atlas','meridian','helios']){
  await page.goto(base+slug+'/dashboard.html');const select=page.locator('.odd-filters select').first();await select.locator('option').nth(2).waitFor({state:'attached'});
  const value=await select.locator('option').nth(1).getAttribute('value');await select.selectOption(value);
  await page.waitForFunction(()=>[...document.querySelectorAll('.odd-text')].some(n=>n.textContent.includes('1 座案場')));
 }
 passed('all customer dashboards render and filter at project URL');
 await page.goto(base+'atlas/site/d/site-atl-2/');await page.getByRole('heading',{name:'整合方案 / 已安裝子系統',exact:true}).waitFor();
 await page.locator('.odd-filters select').selectOption('previous');await page.waitForFunction(()=>document.body.innerText.includes('Sep 17')||document.body.innerText.includes('2026-09-17'));
 passed('nested site assets, JSON and week filters work under project path');
 for(const framework of ['react','vue']){
  await page.goto(base+'atlas/demos/'+framework+'/');const frame=page.frameLocator('iframe');await frame.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();
 }
 passed('React and Vue iframe paths work under project path');
 await page.goto(base+'guide.html');
 const guideLinks=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(a=>({href:a.href,hash:a.hash})));
 for(const {href,hash} of guideLinks.filter(l=>l.href.startsWith(base))){
  if(hash)assert.ok(await page.locator(hash).count(),href);
  else assert.equal((await fetch(href)).status,200,href);
 }
 passed('guide chapter anchors and demo links resolve under /odsh/');
 const expected=['資料包','模板','驗證','建置','交付','探索'];
 for(let i=0;i<6;i++){
  await page.locator(`[data-step="${i}"]`).click();
  assert.ok((await page.locator('#step-title').innerText()).startsWith(expected[i]));
  assert.equal(await page.locator('[data-step][aria-pressed="true"]').count(),1);
  assert.equal(await page.locator('#step-files li').count(),3);
 }
 await page.locator('[data-step="0"]').click();
 passed('six pipeline steps display their artifact contracts');
 await page.locator('[data-route="customer"]').click();
 assert.ok(await page.locator('#route-customer').isVisible());assert.ok(!(await page.locator('#route-dev').isVisible()));
 assert.ok((await page.locator('#route-customer').innerText()).includes('同一份草稿規格'));
 await page.locator('[data-route="dev"]').click();
 assert.ok(await page.locator('#route-dev').isVisible());assert.ok(!(await page.locator('#route-customer').isVisible()));
 passed('developer and customer paths switch with clear planned status');
 for(const [system,choice,resolved] of [['dark','auto','dark'],['dark','light','light'],['light','dark','dark'],['light','auto','light']]){
  await page.emulateMedia({colorScheme:system});await page.locator('#theme').selectOption(choice);
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),resolved);
  assert.equal(await page.locator('#theme').inputValue(),choice);await guideContrast(page);
 }
 await page.screenshot({path:path.join(ROOT,'test-results/guide-desktop.png'),fullPage:true});
 await page.locator('#theme').selectOption('dark');await page.screenshot({path:path.join(ROOT,'test-results/guide-dark.png'),fullPage:true});
 passed('guide light/dark/system preferences persist with readable text');
 await page.emulateMedia({media:'print'});await guideContrast(page);assert.ok(await page.locator('#route-customer').isVisible());
 assert.equal(await page.locator('body').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
 await page.emulateMedia({media:'screen'});passed('printing uses light paper and includes both generation paths');
 await page.setViewportSize({width:390,height:844});await page.locator('#theme').selectOption('light');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile viewport overflow');
 await page.locator('[data-route="customer"]').click();await page.locator('[data-step="5"]').click();await guideContrast(page);
 await page.screenshot({path:path.join(ROOT,'test-results/guide-mobile.png'),fullPage:true});
 passed('guide works at 390px without page overflow');
 const noJS=await browser.newContext({javaScriptEnabled:false});
 const staticPage=await noJS.newPage();await staticPage.goto(base+'guide.html');
 assert.ok(await staticPage.locator('#route-dev').isVisible());assert.ok(await staticPage.locator('#route-customer').isVisible());
 assert.ok((await staticPage.locator('body').innerText()).includes('完整流程：'));
 await noJS.close();passed('guide content remains readable without JavaScript');
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);passed('zero browser errors or missing resources');
 writeJSON(path.join(ROOT,'test-results/pages.json'),{ok:true,base_path:prefix,checks});
}finally{await browser.close();await new Promise(r=>server.close(r));}
