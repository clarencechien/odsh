import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DuckDBInstance } from '@duckdb/node-api';
import {upstream,upstreamJSON,singleHtml} from './upstream.mjs';
import { ROOT, RUNS, runPath, readJSON, writeJSON, fileHash, hash, stableJSON, canonical, filesUnder, sqlString, escapeHTML } from './common.mjs';
import { lintSource } from './lint-prose.mjs';
import { presentHtml } from './brand.mjs';
import {prepareWorkspace,runPack,runHook} from './pack.mjs';
export {prepareWorkspace} from './pack.mjs';
export function templateFingerprint(root){
 const entries=['open-dashboard.config.ts','dashboards','charts','themes','databases','queries','brand','report-brand','pack.json','metrics.yaml'];
 const out={};for(const entry of entries){const p=path.join(root,entry);if(fs.existsSync(p))for(const f of fs.statSync(p).isDirectory()?filesUnder(p):[p])out[path.relative(root,f)]=fileHash(f);}return out;
}
export async function check(workspace, outputDir) {
    const file=path.join(workspace,'pack.json');const config=fs.existsSync(file)?readJSON(file):{lint:{}};
    const proc=upstreamJSON(['check','--all-params','--max-runs',String(config.limits?.maxRuns??100)],{root:workspace});
    const reports=proc.data;
    const native=upstreamJSON(['lint'],{root:workspace});
    writeJSON(path.join(outputDir,'native-lint.json'),native.data);
    writeJSON(path.join(outputDir,'check.json'),reports);
    const findings=reports.flatMap(r=>lintSource(fs.readFileSync(path.join(workspace,'dashboards',r.id,'index.tsx'),'utf8'),Object.fromEntries(r.queries.map(q=>[q.name,q.columns||[]])),config.lint).map(f=>({...f,where:`dashboards/${r.id}/index.tsx:${f.line}`})));
    for(const r of reports)for(const finding of r.findings)if(finding.severity==='error'||(finding.severity==='warning'&&/truncated|trimmed|more filter combinations/.test(finding.message)))findings.push(finding);
    for(const r of native.data)for(const finding of r.findings)if(finding.rule==='missing-expectations')findings.push({...finding,severity:'error'});
    if(!reports.length)findings.push({severity:'error',message:'No dashboards checked'});
    const result={ok:proc.status===0&&native.status===0&&findings.length===0,findings};writeJSON(path.join(outputDir,'lint.json'),result);return result;
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
export async function build(id,options={}) {
  const dir=runPath(id), lock=path.join(dir,'.build-lock');fs.mkdirSync(lock);
  const stage=path.join(dir,'.build-staging');
  try{
    const workspace=await prepareWorkspace(id,options), config=readJSON(path.join(workspace,'pack.json')),pack=runPack(id,options.pack);
    config.dashboards=[...config.dashboards,...readJSON(path.join(workspace,'catalog.json')).map(c=>c.id)];
    const inputs=await inputManifest(dir),templateFiles=templateFingerprint(workspace);
    const old=path.join(dir,'build/manifest.json');
    if(fs.existsSync(old)){const prior=readJSON(old);if(stableJSON(inputs)!==stableJSON(prior.inputs)||hash(stableJSON(templateFiles))!==prior.template.sha256)throw Error('Frozen run inputs/template changed: create a new run_id');}
    fs.rmSync(stage,{recursive:true,force:true});fs.mkdirSync(stage,{recursive:true});
    const validation=await check(workspace,stage);
    if(!validation.ok){writeJSON(path.join(dir,'failure.json'),validation);throw Error('Check/lint failed; see failure.json and .build-staging');}
    const proc=upstream(['build',...config.dashboards,'--out',path.join(stage,'site'),'--max-runs',String(config.limits.maxRuns)],{root:workspace});
    fs.writeFileSync(path.join(stage,'build.log'),proc.stdout+'\n'+proc.stderr);
    if(proc.status!==0)throw Error(`Renderer build failed: ${proc.stderr}`);
    const data={};for(const file of filesUnder(path.join(stage,'site/data'))){if(!file.endsWith('.json'))continue;const normalized=canonical(readJSON(file));writeJSON(file,normalized);const key=path.relative(path.join(stage,'site/data'),file);data[key]=key==='dashboards.json'?Object.fromEntries(Object.entries(normalized).filter(([k])=>k!=='builtAt')):normalized;}
    const trimmed=[...proc.stdout.matchAll(/defaults kept for ([^\n]+)/g)].flatMap(m=>m[1].split(', '));
    const inspection=inspectSnapshot(data,{maxRuns:config.limits.maxRuns,trimmed});
    if(inspection.warnings.length)console.warn('WARNING:',JSON.stringify(inspection.warnings));
    {
      for(const [dash,filename] of [[config.report,'report.html'],[config.default_dashboard,'dashboard.html']]){
        const normalized=normalizeHtml(await singleHtml(workspace,dash,{maxRuns:config.limits.maxRuns}));
        for(const [key,value] of Object.entries(normalized.data))if(key.startsWith(`d/${dash}/`)&&stableJSON(value)!==stableJSON(data[key]))throw Error(`Site/single snapshot mismatch: ${key}`);
        fs.writeFileSync(path.join(stage,filename),presentHtml(normalized.html,{workspace,report:filename==='report.html'}));
        if(filename==='report.html')fs.writeFileSync(path.join(stage,'report-native.html'),presentHtml(normalized.html,{workspace,report:true,editorial:false}));
      }
    }
    for(const file of filesUnder(path.join(stage,'site')).filter(p=>p.endsWith('.html'))){
      const report=file===path.join(stage,'site/d',config.report,'index.html');
      fs.writeFileSync(file,presentHtml(fs.readFileSync(file,'utf8'),{workspace,report,
        dashboardHref:path.relative(path.dirname(file),path.join(stage,'dashboard.html')),
        reportHref:path.relative(path.dirname(file),path.join(stage,'report.html'))}));
    }
    if(stableJSON(inputs)!==stableJSON(await inputManifest(dir)))throw Error('Inputs changed during build');
    const git=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'});
    const dirty=spawnSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:ROOT,encoding:'utf8'}).stdout.trim().length>0;
    const generation=readJSON(path.join(dir,'generation.json'));
    await runHook(pack,'delivery',stage);
    const artifacts={};for(const f of filesUnder(stage))artifacts[path.relative(stage,f)]={sha256:fileHash(f),bytes:fs.statSync(f).size};
    writeJSON(path.join(stage,'manifest.json'),{schema_version:2,run_id:id,pack:pack.name,brand:config.brand,company:config.manifest.company,synthetic:generation.synthetic,release:config.release,default_dashboard:config.default_dashboard,scope:generation.scope,tenant:generation.tenant,template:{commit:git.stdout.trim()||null,dirty,sha256:hash(stableJSON(templateFiles)),files:templateFiles},open_dashboard:readJSON(path.join(ROOT,'package.json')).openDashboard.version,built_at:new Date().toISOString(),inputs,catalog:readJSON(path.join(workspace,'catalog.json')),queries:inspection.queries,warnings:inspection.warnings,data_hash:hash(stableJSON(data)),check:'ok',quality:{engine:'upstream-expect',passed:readJSON(path.join(stage,'check.json')).flatMap(r=>r.queries).flatMap(q=>q.expectations||[]).filter(e=>e.ok).length},artifacts});
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
 const rows=runs.map(r=>`<article><p>${escapeHTML(r.company)} · ${r.synthetic?'SYNTHETIC':'SOURCE DATA'}</p><h2>${escapeHTML(r.run_id)}</h2><nav><a href="${r.run_id}/build/dashboard.html">Dashboard</a> · <a href="${r.run_id}/build/report.html">Report</a> · <a href="${r.run_id}/build/site/">Site</a> · <a href="${r.run_id}/build/manifest.json">Manifest</a></nav><small>${r.data_hash}</small></article>`).join('');
 fs.writeFileSync(path.join(RUNS,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Snapshot runs</title><style>body{font:16px/1.8 system-ui;max-width:1000px;margin:40px auto;padding:20px;background:#f2f7fc;color:#18344c}article{background:white;padding:24px;margin:20px 0;border-top:4px solid #0087dc}a{color:#0072bc}small{overflow-wrap:anywhere}</style><h1>Snapshot runs</h1><p>Internal index. Share only the scoped release intended for its recipient.</p>${rows||'<p>No built runs.</p>'}</html>`);
}
