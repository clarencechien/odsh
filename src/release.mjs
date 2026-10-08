import fs from 'node:fs';import path from 'node:path';
import {ROOT,runPath,readJSON,writeJSON,fileHash,filesUnder,stableJSON,escapeHTML} from './common.mjs';
import {CUSTOMERS} from './customers.mjs';
export const STAGING=path.join(ROOT,'.runtime/releases');
export function stageRelease(id,{internal=false}={}){
 const dir=runPath(id),source=path.join(dir,'build'),manifest=readJSON(path.join(source,'manifest.json'));
 if(manifest.scope==='internal-portfolio'&&!internal)throw Error('Internal portfolio contains all tenants; use customer runs or explicit --internal');
 for(const [file,entry] of Object.entries(manifest.artifacts))if(fileHash(path.join(source,file))!==entry.sha256)throw Error(`Artifact checksum mismatch: ${file}`);
 for(const [file,entry] of Object.entries(manifest.inputs))if(fileHash(path.join(dir,'input',file))!==entry.sha256)throw Error(`Input checksum mismatch: ${file}`);
 const scope=manifest.tenant?Object.values(CUSTOMERS).find(c=>c.name===manifest.tenant)?.slug:'internal';
 if(!scope)throw Error('Unknown tenant scope');
 const root=path.join(STAGING,scope),destination=path.join(root,id),stage=path.join(root,`.${id}-${process.pid}`);
 fs.mkdirSync(root,{recursive:true});if(fs.existsSync(stage))throw Error('Publication staging already exists');fs.mkdirSync(path.join(stage,'build'),{recursive:true});
 try{
   for(const entry of ['site','report.html','report-native.html','dashboard.html','demos','manifest.json'])if(fs.existsSync(path.join(source,entry)))fs.cpSync(path.join(source,entry),path.join(stage,'build',entry),{recursive:true});
   const artifacts=Object.fromEntries(filesUnder(stage).map(f=>[path.relative(stage,f),fileHash(f)]));
   const release={run_id:id,scope,tenant:manifest.tenant,data_hash:manifest.data_hash,artifacts};
   if(fs.existsSync(destination)){
     const existing=readJSON(path.join(destination,'release.json'));
     if(stableJSON(existing)!==stableJSON(release))throw Error('Staged release is immutable; publish a new run_id');
     for(const [file,sha]of Object.entries(existing.artifacts))if(fileHash(path.join(destination,file))!==sha)throw Error(`Published artifact altered: ${file}`);
   }else{writeJSON(path.join(stage,'release.json'),release);fs.renameSync(stage,destination);}
   const releases=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.name.startsWith('.')&&fs.existsSync(path.join(root,e.name,'release.json'))).map(e=>readJSON(path.join(root,e.name,'release.json')));
   fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLED Engergy · ${escapeHTML(scope)} silo</title><style>body{font:16px system-ui;background:#edf3ef;color:#174a3c;max-width:960px;margin:60px auto;padding:24px}article{background:white;padding:24px;margin:16px 0;border-top:3px solid #007d78}a{color:#007d78;margin-right:20px}</style><h1>ATLED Engergy / ${escapeHTML(scope)} silo</h1><p>客戶獨立靜態產物 · 合成資料</p>${releases.sort((a,b)=>a.run_id.localeCompare(b.run_id)).map(r=>`<article><h2>${escapeHTML(r.run_id)}</h2><a href="${r.run_id}/build/dashboard.html">Dashboard</a><a href="${r.run_id}/build/report.html">週報</a><a href="${r.run_id}/build/site/">全部案場</a></article>`).join('')}</html>`);
   return {destination,scope,data_hash:manifest.data_hash};
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
