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
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);passed('zero browser errors or missing resources');
 writeJSON(path.join(ROOT,'test-results/pages.json'),{ok:true,base_path:prefix,checks});
}finally{await browser.close();await new Promise(r=>server.close(r));}
