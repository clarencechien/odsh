import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { DuckDBInstance } from '@duckdb/node-api';
import { Workspace, exportHtml, loadConfig } from '@open-dashboard/core/node';
import { ROOT, RUNS, runPath, readJSON, writeJSON, fileHash, hash, stableJSON, canonical, filesUnder, sqlString, escapeHTML } from './common.mjs';
import { lintSource, boundedValidation } from './lint.mjs';
import { presentHtml } from './presentation.mjs';
import { buildDemos } from './demos.mjs';
import { writeLayouts } from './layouts.mjs';
import { validateData } from './quality.mjs';
const templateEntries=['open-dashboard.config.ts','dashboards','charts','themes','theme-overrides','databases','snapreport.yaml'];
export function templateFingerprint(root=ROOT){const out={};for(const entry of templateEntries){const p=path.join(root,entry);for(const f of fs.statSync(p).isDirectory()?filesUnder(p):[p])out[path.relative(root,f)]=fileHash(f);}return out;}
export function prepareWorkspace(id) {
  const dir=runPath(id), workspace=path.join(dir,'workspace');
  if(!fs.existsSync(path.join(dir,'input/meters.parquet')))throw Error('Generate or ingest input Parquet first');
  fs.mkdirSync(workspace,{recursive:true});
  for(const entry of templateEntries){const target=path.join(workspace,entry);fs.rmSync(target,{recursive:true,force:true});fs.cpSync(path.join(ROOT,entry),target,{recursive:true});}
  // Snapshot data belongs to this run; renderer never sees another customer's input.
  if(!fs.existsSync(path.join(workspace,'input')))fs.symlinkSync('../input',path.join(workspace,'input'),'dir');
  if(!fs.existsSync(path.join(workspace,'node_modules')))fs.symlinkSync(path.join(ROOT,'node_modules'),path.join(workspace,'node_modules'),'dir');
  writeLayouts(workspace,readJSON(path.join(dir,'generation.json')));
  return workspace;
}
export function check(workspace, outputDir, {repair}={}) {
  return boundedValidation(async()=>{
    const proc=spawnSync(process.execPath,[path.join(ROOT,'node_modules/@open-dashboard/core/bin.js'),'check','--json','--root',workspace],{encoding:'utf8',maxBuffer:10*1024*1024,timeout:120000});
    if(proc.error)throw proc.error;
    let reports;try{reports=JSON.parse(proc.stdout);}catch{throw Error(`Renderer check failed: ${proc.stderr||proc.stdout}`);}
    writeJSON(path.join(outputDir,'check.json'),reports);
    const config=parseYaml(fs.readFileSync(path.join(workspace,'snapreport.yaml'),'utf8'));
    const findings=reports.flatMap(r=>lintSource(fs.readFileSync(path.join(workspace,'dashboards',r.id,'index.tsx'),'utf8'),Object.fromEntries(r.queries.map(q=>[q.name,q.columns||[]])),config.lint).map(f=>({...f,where:`dashboards/${r.id}/index.tsx:${f.line}`})));
    for(const r of reports)for(const q of r.queries)if(q.error)findings.push({severity:'error',message:q.error});
    if(!reports.length)findings.push({severity:'error',message:'No dashboards checked'});
    const result={ok:proc.status===0&&findings.length===0,findings};writeJSON(path.join(outputDir,'lint.json'),result);return result;
  },repair,3);
}
export function inspectSnapshot(data, {maxRuns=100,trimmed=[]}={}) {
  const queries={},warnings=trimmed.map(query=>({code:'trimmed-filter',query,severity:'warning'}));
  for(const [name,q] of Object.entries(data))if(q?.results){
    const results=Object.values(q.results);
    if(results.some(r=>r.error))throw Error(`Snapshot query failed: ${name}: ${results.find(r=>r.error).error}`);
    if(results.some(r=>r.result?.truncated))throw Error(`Snapshot rows truncated: ${name}`);
    queries[name]={runs:results.length,rows_max:Math.max(0,...results.map(r=>r.result.rows.length)),trimmed:trimmed.some(t=>name.includes(t))};
    if(results.length>maxRuns)throw Error(`Snapshot exceeds maxRuns: ${name}`);
  }
  return {queries,warnings};
}
export function normalizeHtml(html) {
  const re=/(window\.__ODD_DATA__=)([\s\S]*?)(<\/script>)/;
  const match=html.match(re);if(!match)throw Error('Missing embedded snapshot data');
  const data=canonical(JSON.parse(match[2]));
  const safe=JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
  return {html:html.replace(re,()=>match[1]+safe+match[3]),data};
}
async function inputManifest(dir){
  const inst=await DuckDBInstance.create(':memory:'),db=await inst.connect(),inputs={};
  try{for(const file of fs.readdirSync(path.join(dir,'input')).filter(f=>f.endsWith('.parquet')).sort())inputs[file]={sha256:fileHash(path.join(dir,'input',file)),rows:Number((await db.runAndReadAll(`SELECT count(*) AS n FROM read_parquet(${sqlString(path.join(dir,'input',file))})`)).getRowObjectsJS()[0].n)};}finally{db.closeSync();inst.closeSync();}return inputs;
}
export async function build(id) {
  const dir=runPath(id), lock=path.join(dir,'.build-lock');fs.mkdirSync(lock);
  const stage=path.join(dir,'.build-staging');
  try{
    const workspace=prepareWorkspace(id), config=parseYaml(fs.readFileSync(path.join(workspace,'snapreport.yaml'),'utf8'));
    const quality=await validateData(dir);if(!quality.ok)throw Error('Data quality failed; see quality.json');
    config.dashboards=[...config.dashboards,...readJSON(path.join(workspace,'catalog.json')).map(c=>c.id)];
    const inputs=await inputManifest(dir),templateFiles=templateFingerprint(workspace);
    const old=path.join(dir,'build/manifest.json');
    if(fs.existsSync(old)){const prior=readJSON(old);if(stableJSON(inputs)!==stableJSON(prior.inputs)||hash(stableJSON(templateFiles))!==prior.template.sha256)throw Error('Frozen run inputs/template changed: create a new run_id');}
    fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
    const validation=await check(workspace,stage);
    if(!validation.ok){writeJSON(path.join(dir,'failure.json'),validation);throw Error('Check/lint failed; see failure.json and .build-staging');}
    const proc=spawnSync(process.execPath,[path.join(ROOT,'node_modules/@open-dashboard/core/bin.js'),'build',...config.dashboards,'--root',workspace,'--out',path.join(stage,'site'),'--max-runs',String(config.maxRuns)],{encoding:'utf8',timeout:240000,maxBuffer:10*1024*1024});
    fs.writeFileSync(path.join(stage,'build.log'),proc.stdout+'\n'+proc.stderr);
    if(proc.status!==0)throw Error(`Renderer build failed: ${proc.stderr}`);
    const data={};for(const file of filesUnder(path.join(stage,'site/data'))){if(!file.endsWith('.json'))continue;const normalized=canonical(readJSON(file));writeJSON(file,normalized);data[path.relative(path.join(stage,'site/data'),file)]=normalized;}
    const trimmed=[...proc.stdout.matchAll(/defaults kept for ([^\n]+)/g)].flatMap(m=>m[1].split(', '));
    const inspection=inspectSnapshot(data,{maxRuns:config.maxRuns,trimmed});
    if(inspection.warnings.length)console.warn('WARNING:',JSON.stringify(inspection.warnings));
    const ws=new Workspace(await loadConfig(workspace));
    try{
      for(const [dash,filename] of [[config.reportDashboard,'report.html'],[readJSON(path.join(dir,'generation.json')).tenant ? readJSON(path.join(workspace,'catalog.json')).find(c=>!c.site).id : 'energy','dashboard.html']]){
        const normalized=normalizeHtml(await exportHtml(ws,dash,'',{maxRuns:config.maxRuns}));
        for(const [key,value] of Object.entries(normalized.data))if(key.startsWith(`d/${dash}/`)&&stableJSON(value)!==stableJSON(data[key]))throw Error(`Site/single snapshot mismatch: ${key}`);
        fs.writeFileSync(path.join(stage,filename),presentHtml(normalized.html,{workspace,report:dash===config.reportDashboard}));
        if(dash===config.reportDashboard)fs.writeFileSync(path.join(stage,'report-native.html'),presentHtml(normalized.html,{workspace,report:true,editorial:false}));
      }
    }finally{await ws.close();}
    for(const file of filesUnder(path.join(stage,'site')).filter(p=>p.endsWith('.html'))){
      const report=file===path.join(stage,'site/d',config.reportDashboard,'index.html');
      fs.writeFileSync(file,presentHtml(fs.readFileSync(file,'utf8'),{workspace,report,
        dashboardHref:path.relative(path.dirname(file),path.join(stage,'dashboard.html')),
        reportHref:path.relative(path.dirname(file),path.join(stage,'report.html'))}));
    }
    if(stableJSON(inputs)!==stableJSON(await inputManifest(dir)))throw Error('Inputs changed during build');
    const git=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'});
    const generation=readJSON(path.join(dir,'generation.json'));
    await buildDemos(stage);
    const artifacts={};for(const f of filesUnder(stage))artifacts[path.relative(stage,f)]={sha256:fileHash(f),bytes:fs.statSync(f).size};
    writeJSON(path.join(stage,'manifest.json'),{schema_version:1,run_id:id,company:'ATLED Engergy',synthetic:true,scope:generation.scope,tenant:generation.tenant,template:{commit:git.stdout.trim()||null,sha256:hash(stableJSON(templateFiles)),files:templateFiles},open_dashboard:'0.7.0',built_at:new Date().toISOString(),inputs,catalog:readJSON(path.join(workspace,'catalog.json')),queries:inspection.queries,warnings:inspection.warnings,data_hash:hash(stableJSON(data)),check:'ok',quality:'ok',artifacts});
    const final=path.join(dir,'build'), backup=path.join(dir,'.build-previous');
    fs.rmSync(backup,{recursive:true,force:true});if(fs.existsSync(final))fs.renameSync(final,backup);
    try{fs.renameSync(stage,final);}catch(e){if(fs.existsSync(backup))fs.renameSync(backup,final);throw e;}
    fs.rmSync(backup,{recursive:true,force:true});fs.rmSync(path.join(dir,'failure.json'),{force:true});
    writeIndex();return readJSON(path.join(final,'manifest.json'));
  }catch(e){writeJSON(path.join(dir,'failure.json'),{...(fs.existsSync(path.join(dir,'failure.json'))?readJSON(path.join(dir,'failure.json')):{}),ok:false,error:e.message,at:new Date().toISOString()});throw e;}
  finally{fs.rmdirSync(lock);}
}
export function writeIndex(){
  fs.mkdirSync(RUNS,{recursive:true});
  const runs=fs.readdirSync(RUNS,{withFileTypes:true}).filter(e=>e.isDirectory()&&fs.existsSync(path.join(RUNS,e.name,'build/manifest.json'))).map(e=>readJSON(path.join(RUNS,e.name,'build/manifest.json'))).sort((a,b)=>a.run_id.localeCompare(b.run_id));
  const rows=runs.map(r=>`<article><p class="eyebrow">${r.tenant?escapeHTML(r.tenant):'內部跨客戶總覽'} · SYNTHETIC DATA</p><h2>${escapeHTML(r.run_id)}</h2><p>DuckDB snapshot · ${Object.values(r.inputs).reduce((n,i)=>n+i.rows,0).toLocaleString('en-US')} records</p><nav><a href="${r.run_id}/build/dashboard.html">營運 Dashboard ↗</a><a href="${r.run_id}/build/report.html">客戶週報 ↗</a><a href="${r.run_id}/build/site/d/energy/">靜態站 ↗</a><a href="${r.run_id}/build/manifest.json">稽核 Manifest</a></nav><details><summary>客戶與案場專屬 Dashboard</summary>${r.catalog.map(c=>`<p><a href="${r.run_id}/build/site/d/${c.id}/">${escapeHTML(c.title)}</a></p>`).join('')}</details><small>DATA HASH ${r.data_hash.slice(0,16)}</small></article>`).join('');
  fs.writeFileSync(path.join(RUNS,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLED Engergy — Energy intelligence</title><style>body{margin:0;background:#f2f7fc;color:#18344c;font-family:system-ui,sans-serif}header,main,footer{max-width:1100px;margin:auto;padding:40px 24px}header{border-bottom:1px solid #c6dfef}h1{font-size:clamp(32px,5vw,64px);font-weight:500;letter-spacing:-.05em;line-height:1.1}header p{max-width:680px;line-height:1.8}.eyebrow{font-size:12px;letter-spacing:.16em}main{display:grid;gap:24px}article{background:#fff;padding:28px;border-top:4px solid #0087dc;border-radius:8px}h2{font-weight:500}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}a{color:#0087dc;text-decoration:none;border:1px solid #c6dfef;padding:12px 16px;border-radius:6px}a:hover{background:#e7f4fc}small{font-family:monospace;color:#52738a}footer{font-size:13px}</style><header><p class="eyebrow">ATLED ENGERGY / INTEGRATED ENERGY SERVICES</p><h1>One portfolio.<br>Every energy decision.</h1><p>智慧樓宇・智慧電網・資料中心・儲能・太陽能・充電樁<br>可離線閱讀的能源週報與營運快照。數據可追溯，決策有依據。</p></header><main>${rows||'<p>尚無已建置報告。執行 npm run generate 與 npm run build。</p>'}</main><footer>虛構企業 / 合成資料 MVP · 模型估算不代表實際收益。此索引為內部展示，請勿作為跨客戶公開入口。</footer></html>`);
}
