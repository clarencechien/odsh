import assert from 'node:assert/strict';import path from 'node:path';
import {chromium} from 'playwright';import {createPreview} from '../src/server.mjs';import {ROOT,writeJSON} from '../src/common.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-v4';
const server=await createPreview({port:0}),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const checks=[],errors=[];const pass=name=>{checks.push({name,pass:true});console.log('PASS',name)};
const base=`http://127.0.0.1:${server.address().port}`;
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const go=async(slug,view='dashboard.html')=>{await page.goto(`${base}/${slug}-2026-q3${suffix}/build/${view}`);await page.waitForFunction(()=>document.querySelectorAll('.odd-panel svg').length>=2)};
 await go('atlas');const theme=page.getByLabel('外觀主題');await theme.selectOption('dark');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await page.reload();await page.getByRole('button',{name:'編輯版面',exact:true}).waitFor();assert.equal(await theme.inputValue(),'dark');await theme.selectOption('light');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await theme.selectOption('system');assert.equal(await page.locator('html').getAttribute('data-theme'),null);await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches),true);pass('theme controls switch light/dark/system and persist');
 for(const slug of ['atlas','meridian','helios']){
  await go(slug);await page.getByRole('button',{name:'編輯版面',exact:true}).click();const widgets=page.locator('.loop-personal-widget');const count=await widgets.count();assert.ok(count>=10);
  const firstTitle=await widgets.nth(1).getAttribute('data-widget-title'),lastTitle=await widgets.last().getAttribute('data-widget-title');
  await page.getByRole('button',{name:`拖曳 ${lastTitle}`,exact:true}).dragTo(widgets.first());
  await page.waitForFunction(title=>document.querySelector('.loop-personal-widget')?.dataset.widgetTitle===title,lastTitle);
  await page.getByLabel(`${lastTitle} 寬度`,{exact:true}).selectOption('6');await page.getByLabel(`${lastTitle} 高度`,{exact:true}).fill('260');
  assert.equal(await widgets.first().locator('.odd-panel').evaluate(el=>getComputedStyle(el).height),'260px');
  await page.getByRole('button',{name:`隱藏 ${firstTitle}`,exact:true}).click();assert.equal(await widgets.count(),count-1);
  await page.getByRole('button',{name:'完成編輯',exact:true}).click();await page.reload();await widgets.first().waitFor();assert.equal(await widgets.first().getAttribute('data-widget-title'),lastTitle);assert.equal(await widgets.count(),count-1);assert.equal(await widgets.first().locator('.odd-panel').evaluate(el=>getComputedStyle(el).height),'260px');
  await page.locator('.odd-filters select').first().selectOption(slug==='atlas'?'ATL-1':slug==='meridian'?'MER-1':'HEL-1');await page.waitForFunction(()=>document.body.innerText.includes('1 座案場'));await page.locator('.odd-filters select').nth(1).selectOption('previous');await page.waitForFunction(()=>document.body.innerText.includes('2026-09-17'));
  await page.getByRole('button',{name:'編輯版面',exact:true}).click();await page.getByRole('checkbox',{name:firstTitle,exact:true}).check();assert.equal(await widgets.count(),count);
  await page.getByRole('button',{name:`後移 ${lastTitle}`,exact:true}).click();assert.notEqual(await widgets.first().getAttribute('data-widget-title'),lastTitle);
  await page.screenshot({path:path.join(ROOT,`test-results/edit-${slug}.png`),fullPage:true});
  await go(slug,'report.html');assert.equal(await page.locator('.loop-layout-toolbar').count(),0);assert.equal(await page.locator('.loop-personal-widget').count(),0);await page.getByRole('heading',{name:'本週結論 / What changed',exact:true}).waitFor();
  pass(`${slug}: drag, resize, hide/show, reload, keyboard move, filters and report isolation`);
 }
 await go('atlas','site/d/site-atl-1/');assert.equal(await page.locator('.loop-personal-widget').count(),0);await page.getByRole('button',{name:'編輯版面',exact:true}).click();await page.getByRole('button',{name:'完成編輯',exact:true}).click();await go('atlas','site/d/site-atl-2/');assert.equal(await page.locator('.loop-personal-widget').count(),0);pass('site layouts are separate from customer and other site layouts');
 await go('atlas','site/d/atlas/');assert.ok(await page.locator('.loop-personal-widget').count()>0);pass('static and single-file routes share the same customer preference');
 await page.getByRole('button',{name:'還原預設',exact:true}).click();assert.equal(await page.locator('.loop-personal-widget').count(),0);await page.reload();await page.getByRole('button',{name:'編輯版面',exact:true}).waitFor();assert.equal(await page.locator('.loop-personal-widget').count(),0);pass('reset removes saved layout and restores authored sections');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'編輯版面',exact:true}).click();const bounds=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(bounds.scroll<=bounds.client+2,JSON.stringify(bounds));pass('mobile editor fits viewport');
 const checkboxes=page.locator('.loop-widget-library input[type=checkbox]');for(let i=0;i<await checkboxes.count();i++)await checkboxes.nth(i).uncheck();await page.getByText('目前沒有顯示的 widget。',{exact:false}).waitFor();await page.getByRole('button',{name:'還原預設',exact:true}).click();assert.ok(await page.locator('.odd-panel').count()>0);pass('all-hidden layout remains recoverable');
 await page.evaluate(()=>localStorage.setItem('atled:layout:v1:atlas','{"version":1,"order":null}'));await page.reload();await page.getByRole('button',{name:'編輯版面',exact:true}).waitFor();assert.equal(await page.locator('.loop-personal-widget').count(),0);pass('malformed saved settings fall back to defaults');
 const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('disabled')};Storage.prototype.getItem=()=>{throw Error('disabled')};});const restricted=await blocked.newPage();await restricted.goto(`${base}/atlas-2026-q3${suffix}/build/dashboard.html`);await restricted.getByRole('button',{name:'編輯版面',exact:true}).click();await restricted.getByText('瀏覽器無法儲存；變更僅保留在本次頁面',{exact:true}).waitFor();assert.ok(await restricted.locator('.loop-personal-widget').count()>0);await blocked.close();pass('blocked browser storage keeps session editing usable');
 assert.deepEqual(errors,[]);pass('zero runtime errors');writeJSON(path.join(ROOT,'test-results/personalization.json'),{ok:true,checks});
}finally{await browser.close();await new Promise(r=>server.close(r));}
