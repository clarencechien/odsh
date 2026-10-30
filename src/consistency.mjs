import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {runPath,readJSON,writeJSON,filesUnder,fileHash} from './common.mjs';
import {queryMetadata} from './export-rill.mjs';import {readMetrics,openInputs,calculateMeasures} from './metrics.mjs';
export async function checkConsistency(id,{metricsFile}={}){
 const dir=runPath(id),manifest=readJSON(path.join(dir,'build/manifest.json')),workspace=path.join(dir,'workspace');
 for(const [file,input]of Object.entries(manifest.inputs))if(fileHash(path.join(dir,'input',file))!==input.sha256)throw Error(`Input changed: ${file}`);
 const file=metricsFile||path.join(workspace,'metrics.yaml'),{name,definition}=readMetrics(file,manifest.pack);
 if(!metricsFile&&fileHash(file)!==manifest.template.files['metrics.yaml'])throw Error('Metrics differ from built template');
 const input=await openInputs(path.join(dir,'input'));
 try{
  const expected=await calculateMeasures(input.db,definition),checks=[],seen=new Set();
  // Metadata is read only from the workspace that built this run, never from current templates.
  for(const sql of filesUnder(path.join(workspace,'dashboards')).filter(f=>f.endsWith('.sql'))){
   if(fileHash(sql)!==manifest.template.files[path.relative(workspace,sql)])throw Error('SQL differs from built template');
   const dashboard=path.basename(path.dirname(sql));
   for(const q of queryMetadata(fs.readFileSync(sql,'utf8'))){
    if(!q.metric?.startsWith(name+'.'))continue;
    const measure=q.metric.slice(name.length+1);
    if(!Object.hasOwn(expected,measure))throw Error(`Unknown metric reference: ${q.metric}`);
    const snapshot=path.join(dir,'build/site/data/d',dashboard,encodeURIComponent(q.name)+'.json');
    if(!fs.existsSync(snapshot))continue; // validation-only dashboards are deliberately not delivered
    const relative=path.relative(path.join(dir,'build'),snapshot);
    if(fileHash(snapshot)!==manifest.artifacts[relative]?.sha256)throw Error(`Snapshot changed: ${relative}`);
    const stored=readJSON(snapshot);let count=0;
    for(const run of Object.values(stored.results)){
     if(run.error||!run.result||run.result.rows.length!==1)throw Error(`Metric reference must be a scalar snapshot: ${dashboard}/${q.name}`);
     // Full-input references must not be filter-dependent. Filtered charts need an explicit scope contract in a later stage.
     if(stored.reads.length)throw Error(`Metric reference needs an explicit unfiltered scope: ${dashboard}/${q.name}`);
     const row=run.result.rows[0];if(!Object.hasOwn(row,measure))throw Error(`Missing result column ${measure}`);
     const actual=row[measure],wanted=expected[measure];
     const equal=actual===null||wanted===null?actual===wanted:Number.isFinite(Number(actual))&&Number.isFinite(Number(wanted))&&Math.abs(Number(actual)-Number(wanted))<=1e-9*Math.max(1,Math.abs(Number(wanted)));
     checks.push({metric:q.metric,dashboard,query:q.name,actual,expected:wanted,pass:equal});count++;
    }
    if(count)seen.add(measure);
   }
  }
  const missing=definition.measures.map(m=>m.name).filter(m=>!seen.has(m));
  const result={ok:missing.length===0&&checks.every(c=>c.pass),run_id:id,view:name,scope:'entire immutable input; declared scalar references',measures:seen.size,missing,checks};
  if(!metricsFile)writeJSON(path.join(dir,'consistency.json'),result);
  return result;
 }finally{input.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=await checkConsistency(process.argv[2]);console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}
}
