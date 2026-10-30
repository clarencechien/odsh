import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {parse} from 'yaml';
import {ROOT,runPath,readJSON,writeJSON,filesUnder,fileHash} from './common.mjs';
const identifier=/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
export function packFile(pack,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative))throw Error('Pack path must be relative');
 const file=path.resolve(pack.root,relative);
 if(!file.startsWith(pack.root+path.sep))throw Error('Pack path escapes its root');
 if(fs.existsSync(file)&&!fs.realpathSync(file).startsWith(fs.realpathSync(pack.root)+path.sep))throw Error('Pack symlink escapes its root');
 return file;
}
export function loadPack(name){
 const defaults=parse(fs.readFileSync(path.join(ROOT,'snapreport.yaml'),'utf8'));
 name??=defaults.pack;
 if(!identifier.test(name||''))throw Error('Invalid pack name');
 const root=path.join(ROOT,'packs',name),file=path.join(root,'pack.yaml');
 const config=parse(fs.readFileSync(file,'utf8'));
 if(config.name!==name)throw Error('Pack name mismatch');
 const pack={...config,root,limits:{maxRuns:defaults.maxRuns??100,...config.limits},timeZone:config.timeZone||defaults.timeZone||'UTC'};
 if(!config.brand_only){
  if(!Array.isArray(config.inputs)||!config.inputs.length||!config.inputs.every(f=>/^[\w-]+\.parquet$/.test(f)))throw Error('Pack must declare required Parquet inputs');
  if(!Array.isArray(config.dashboards)||!config.dashboards.length||!config.dashboards.every(id=>identifier.test(id)))throw Error('Invalid dashboard list');
  for(const key of ['report','default_dashboard'])if(!config.dashboards.includes(config[key]))throw Error(`Pack ${key} must name a declared dashboard`);
  if(typeof config.manifest?.company!=='string'||typeof config.manifest?.synthetic!=='boolean')throw Error('Pack needs explicit company and synthetic metadata');
 }
 return pack;
}
export function runPack(id,name){
 const generation=readJSON(path.join(runPath(id),'generation.json'));
 if(name&&generation.pack&&name!==generation.pack)throw Error('Run belongs to a different pack');
 return loadPack(generation.pack||name);
}
export async function generateRun(id,options={}){
 const pack=loadPack(options.pack);
 if(!pack.ingest)throw Error('This pack has no ingestion hook');
 const {generate}=await import(pathToFileURL(packFile(pack,pack.ingest)).href);
 const result=await generate(id,options);
 const file=path.join(runPath(id),'generation.json'),generation=readJSON(file);
 if(typeof generation.synthetic!=='boolean')throw Error('Ingestion must declare synthetic or real provenance');
 writeJSON(file,{...generation,pack:pack.name});
 return result;
}
export async function prepareWorkspace(id,options={}){
 const dir=runPath(id),pack=runPack(id,options.pack),workspace=path.join(dir,'workspace'),generation=readJSON(path.join(dir,'generation.json'));
 for(const file of pack.inputs)if(!fs.existsSync(path.join(dir,'input',file)))throw Error(`Missing required input: ${file}`);
 fs.mkdirSync(workspace,{recursive:true});
 // Only source directories managed by this preparation are replaced. Inputs remain immutable.
 for(const entry of ['dashboards','charts','themes','databases','queries','brand','report-brand','open-dashboard.config.ts']){
  fs.rmSync(path.join(workspace,entry),{recursive:true,force:true});
  const source=packFile(pack,entry);
  if(fs.existsSync(source))fs.cpSync(source,path.join(workspace,entry),{recursive:true});
 }
 fs.cpSync(path.join(ROOT,'charts'),path.join(workspace,'charts'),{recursive:true});
 if(fs.existsSync(packFile(pack,'charts')))fs.cpSync(packFile(pack,'charts'),path.join(workspace,'charts'),{recursive:true});
 for(const [name,target] of [['input',path.join(dir,'input')],['node_modules',path.join(ROOT,'node_modules')]]){
  if(!fs.existsSync(path.join(workspace,name)))fs.symlinkSync(target,path.join(workspace,name),'dir');
 }
 writeJSON(path.join(workspace,'generation.json'),generation);
 if(pack.rill)fs.copyFileSync(packFile(pack,pack.rill),path.join(workspace,'metrics.yaml'));
 let layout={catalog:[]};
 if(pack.hooks?.layouts){
  const hook=await import(pathToFileURL(packFile(pack,pack.hooks.layouts)).href);
  layout=await hook.prepare(workspace,generation);
 }
 const brand=loadPack(options.brand||pack.brand||pack.name);
 if(brand.name!==pack.name)fs.cpSync(packFile(brand,'brand'),path.join(workspace,'report-brand'),{recursive:true});
 const effective={...pack,root:undefined,brand:brand.name,brandFingerprint:brandFingerprint(brand),...layout};
 const release=pack.release||{},scope=generation.tenant?release.scopes?.[generation.tenant]:release.internal_scope;
 effective.release={...release,scope};
 writeJSON(path.join(workspace,'pack.json'),effective);
 writeJSON(path.join(workspace,'catalog.json'),layout.catalog||[]);
 return workspace;
}
export function brandFingerprint(pack){
 const dir=packFile(pack,'brand');return fs.existsSync(dir)?Object.fromEntries(filesUnder(dir).map(f=>[path.relative(dir,f),fileHash(f)])):{};
}

export async function runHook(pack,key,...args){
 const file=pack.hooks?.[key];if(!file)return undefined;
 const module=await import(pathToFileURL(packFile(pack,file)).href);
 const run=module.default||module.buildDemos;
 if(typeof run!=='function')throw Error(`Invalid ${key} hook`);
 return run(...args);
}
