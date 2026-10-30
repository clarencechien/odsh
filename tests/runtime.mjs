import assert from 'node:assert/strict';import path from 'node:path';import {createInterface} from 'node:readline';import {once} from 'node:events';import net from 'node:net';
import {chromium} from 'playwright';import {ROOT,runPath,writeJSON,stableJSON} from '../src/common.mjs';import {templateFingerprint} from '../src/run.mjs';import {startUpstream} from '../src/upstream.mjs';
const id=process.env.ODSH_O11Y_RUN||'o11y-2026-10-s1-final',root=path.join(runPath(id),'workspace'),before=stableJSON(templateFingerprint(root)),checks=[];
async function stop(child){if(child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),4000);await exited;clearTimeout(timer);}
const mcp=startUpstream('mcp',root,{stdio:['pipe','pipe','pipe']}),pending=new Map();let serial=0,stderr='';mcp.stderr.on('data',b=>stderr+=b);
const lines=createInterface({input:mcp.stdout});lines.on('line',line=>{try{const reply=JSON.parse(line),entry=pending.get(reply.id);if(entry){pending.delete(reply.id);clearTimeout(entry.timer);reply.error?entry.reject(Error(JSON.stringify(reply.error))):entry.resolve(reply.result);}}catch{}});
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error(`MCP timeout ${method}: ${stderr}`));},30000);pending.set(id,{resolve,reject,timer});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
try{
 await call('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'odsh-smoke',version:'1'}});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const listed=await call('tools/list');assert.ok(listed.tools.length>=26);for(const name of ['list_dashboards','read_dashboard','write_dashboard_file','check_dashboard','render_panel'])assert.ok(listed.tools.some(t=>t.name===name));assert.ok(!listed.tools.some(t=>t.name==='run_sql'));checks.push({name:'native stdio MCP tool catalog',tools:listed.tools.length,pass:true});
 for(const [name,args]of [['list_dashboards',{}],['read_dashboard',{id:'rca'}],['check_dashboard',{id:'rca',all_params:true}]]){
  const result=await call('tools/call',{name,arguments:args});assert.ok(!result.isError,JSON.stringify(result));const data=JSON.parse(result.content.find(c=>c.type==='text').text);
  if(name==='check_dashboard'){assert.ok(data.length>0);assert.ok(data.every(r=>!r.findings.some(f=>f.severity==='error')&&r.sweep.failedRuns===0));}
  checks.push({name,pass:true});
 }
}finally{for(const p of pending.values())clearTimeout(p.timer);await stop(mcp);lines.close();}
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const runtime=startUpstream('serve',root,{port,stdio:['ignore','pipe','pipe']});let logs='';runtime.stdout.on('data',b=>logs+=b);runtime.stderr.on('data',b=>logs+=b);let browser;
try{
 const url=`http://127.0.0.1:${port}/d/rca/`;let ready=false;
 for(let i=0;i<100;i++){if(runtime.exitCode!==null)throw Error(logs);try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,logs);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.getByRole('heading',{name:'觀測範圍',exact:true}).waitFor();await page.locator('.odd-filters select').selectOption('checkout');
 await page.waitForFunction(()=>{const rows=[...document.querySelectorAll('.odd-panel-table tbody tr')];return rows.length>0&&rows.every(r=>r.textContent.includes('checkout'));});
 assert.equal(await page.getByRole('button',{name:/^Edit$|編輯版面/}).count(),0);assert.deepEqual(errors,[]);checks.push({name:'native serve executes DuckDB filter and exposes no edit button',pass:true});
 assert.equal(stableJSON(templateFingerprint(root)),before);checks.push({name:'read-only smoke leaves authored workspace unchanged',pass:true});
}finally{await browser?.close();await stop(runtime);}
writeJSON(path.join(ROOT,'test-results/runtime.json'),{ok:true,run:id,checks,render_panel:'not executed: bundled browser download blocked by environment network policy'});console.log(checks);
