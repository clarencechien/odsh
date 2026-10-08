import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {ROOT,writeJSON} from '../src/common.mjs';import {createPreview} from '../src/server.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-v3';
const server=await createPreview({port:0}),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const checks=[];
// Check actual rendered foregrounds against their painted background, including old gradients.
async function contrast(page){return page.evaluate(()=>{
 const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
 const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
 const lum=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
 const background=node=>{for(let n=node;n;n=n.parentElement){const s=getComputedStyle(n),gradient=s.backgroundImage.match(/rgba?\([^)]+\)/);if(gradient)return rgb(gradient[0]);const c=rgb(s.backgroundColor);if(c[3]===255)return c;}return [255,255,255,255];};
 const nodes=[...document.querySelectorAll('.odd-panel h3,.odd-panel-titles p,.odd-dashboard-head p,.odd-panel-stat .odd-stat-value,.odd-panel-prose .odd-text,.odd-panel-prose strong,.odd-panel-text .odd-text,.odd-dashboard-page h1,.odd-section h2,.loop-integration strong,.loop-integration small,.loop-integration-count')];
 return nodes.filter(n=>n.textContent.trim()&&n.getBoundingClientRect().height).map(n=>{const s=getComputedStyle(n),a=lum(rgb(s.color)),b=lum(background(n));return {text:n.textContent.trim().slice(0,55),ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),color:s.color};});
});}
try{
 for(const [system,saved]of [['dark',null],['light',null],['light','dark'],['dark','light']]){
  const context=await browser.newContext({colorScheme:system,viewport:{width:1440,height:1000}});
  if(saved)await context.addInitScript(value=>localStorage.setItem('odd:theme',value),saved);
  const page=await context.newPage();
  for(const slug of ['atlas','meridian','helios'])for(const view of ['dashboard.html','report.html','report-native.html',`site/d/${slug}/`]){
   await page.goto(`http://127.0.0.1:${server.address().port}/${slug}-2026-q3${suffix}/build/${view}`);
   await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>=2&&document.body.innerText.includes('2026-09-24'));
   const measured=await contrast(page);assert.ok(measured.length>=10,`${slug}/${view} missing text samples`);
   const failures=measured.filter(r=>r.ratio<4.5);assert.deepEqual(failures,[],`${slug}/${view}, system=${system}, saved=${saved}`);
   checks.push({slug,view,system,saved,min_contrast:Math.min(...measured.map(r=>r.ratio)),pass:true});
   if(system==='dark'&&!saved&&slug==='atlas'&&['dashboard.html','report.html'].includes(view))await page.screenshot({path:path.join(ROOT,`test-results/dark-${view}.png`),fullPage:true});
   if(view==='report.html'){
    await page.emulateMedia({media:'print'});const printed=await contrast(page);assert.deepEqual(printed.filter(r=>r.ratio<4.5),[],`${slug} print contrast`);await page.emulateMedia({media:'screen'});
   }
  }
  await context.close();console.log('PASS',system,saved||'system','all clients, dashboards, reports and print');
 }
 writeJSON(path.join(ROOT,'test-results/themes.json'),{ok:true,checks});
}finally{await browser.close();await new Promise(r=>server.close(r));}
