import fs from 'node:fs';
import path from 'node:path';
import { stringify } from 'yaml';
import { DuckDBInstance } from '@duckdb/node-api';
import { runPath, readJSON, writeJSON, sqlString, fileHash } from './common.mjs';
export function queryMetadata(text){
  return text.split(/(?=^-- name:)/m).filter(s=>/^-- name:/m.test(s)).map(block=>({name:block.match(/^-- name:\s*(.+)$/m)[1].trim(),description:block.match(/^-- description:\s*(.+)$/m)?.[1].trim(),metric:block.match(/^-- metric:\s*(.+)$/m)?.[1].trim()}));
}
export async function exportRill(id){
  const dir=runPath(id),out=path.join(dir,'rill'),build=path.join(dir,'build');
  if(!fs.existsSync(path.join(build,'manifest.json')))throw Error('Build this run before export-rill');
  for(const folder of ['data','sources','metrics','drafts'])fs.mkdirSync(path.join(out,folder),{recursive:true});
  const writeYaml=(file,value)=>fs.writeFileSync(path.join(out,file),stringify(value));
  writeYaml('rill.yaml',{compiler:'rillv1',title:'ATLED Engergy · Energy exploration'});
  for(const file of fs.readdirSync(path.join(dir,'input')).filter(f=>f.endsWith('.parquet'))){
    fs.copyFileSync(path.join(dir,'input',file),path.join(out,'data',file));
    writeYaml(`sources/${path.basename(file,'.parquet')}.yaml`,{type:'source',connector:'local_file',path:`data/${file}`});
  }
  writeYaml('metrics/energy.yaml',{version:1,type:'metrics_view',display_name:'ATLED Engergy · Interval energy',model:'meters',timeseries:'ts',dimensions:['tenant','site_id','site_name','quality'].map(column=>({name:column,column})),measures:[
    {name:'load_kwh',expression:'SUM(load_kw) * 0.25',description:'Fifteen-minute load energy',format_preset:'humanize'},
    {name:'solar_kwh',expression:'SUM(solar_kw) * 0.25',description:'PV generation; no battery energy double-counting',format_preset:'humanize'},
    {name:'cost_twd',expression:'SUM(energy_cost_twd)',description:'Illustrative energy-only bill; includes export credits',format_preset:'humanize'},
    {name:'modeled_savings_twd',expression:'SUM(baseline_cost_twd) - SUM(energy_cost_twd)',description:'Counterfactual model; not guaranteed savings',format_preset:'humanize'},
    {name:'pue',expression:'SUM(datacenter_kw) / NULLIF(SUM(it_kw), 0)',description:'Energy-weighted PUE; never average site ratios',format_preset:'humanize'},
    {name:'charger_availability',expression:'SUM(available_ports)::DOUBLE / NULLIF(SUM(total_ports), 0)',description:'Time-weighted available connector share',format_preset:'percentage'},
    {name:'grid_co2_tonnes',expression:'SUM(grid_co2_kg) / 1000',description:'Location-based imported electricity only; illustrative factor',format_preset:'humanize'}
  ]});
  const metadata=queryMetadata(fs.readFileSync(path.join(dir,'workspace/dashboards/energy/queries.sql'),'utf8'));
  const reports=readJSON(path.join(build,'check.json')),energy=reports.find(r=>r.id==='energy');
  const inst=await DuckDBInstance.create(':memory:'),db=await inst.connect();
  try{
    for(const query of metadata){
      if(!query.description||!query.metric)throw Error(`Missing semantic comments: ${query.name}`);
      const snapshot=readJSON(path.join(build,'site/data/d/energy',query.name+'.json'));
      const results=Object.values(snapshot.results);
      const result=results.find(r=>r.params.site===null&&r.params.window==='current')||results.find(r=>Object.values(r.params).every(v=>v===null))||results[0];
      const rows=result.result.rows;if(!rows.length)continue;
      const name=`query_${query.name}`,json=path.join(out,'data',name+'.json');
      fs.writeFileSync(json,JSON.stringify(rows));
      await db.run(`COPY (SELECT * FROM read_json_auto(${sqlString(json)})) TO ${sqlString(path.join(out,'data',name+'.parquet'))} (FORMAT PARQUET)`);fs.unlinkSync(json);
      writeYaml(`sources/${name}.yaml`,{type:'source',connector:'local_file',path:`data/${name}.parquet`});
      const numeric=result.result.columns.filter(c=>rows.some(r=>typeof r[c.name]==='number')).map(c=>c.name);
      const dims=result.result.columns.filter(c=>!numeric.includes(c.name)).map(c=>({name:c.name,column:c.name}));
      // Each source is already aggregated. MAX is intentionally a review-only draft,
      // not an assertion that ratios or peaks can be added across groups.
      if(numeric.length)writeYaml(`drafts/${name}.yaml`,{version:1,type:'metrics_view',model:name,display_name:query.name,description:`DRAFT: ${query.description}. ${query.metric}. Fixed default window and portfolio; MAX is not an additive total. Review before moving into metrics/.`,dimensions:dims,measures:numeric.map(c=>({name:c,expression:`MAX("${c}")`,description:query.description}))});
      query.columns=energy.queries.find(q=>q.name===query.name)?.columns||[];
    }
  }finally{db.closeSync();inst.closeSync();}
  writeJSON(path.join(out,'query-contracts.json'),metadata);
  fs.writeFileSync(path.join(out,'.rillignore'),'drafts/\nREADME.md\nquery-contracts.json\nexport-manifest.json\n');
  writeJSON(path.join(out,'export-manifest.json'),{run_id:id,data_hash:readJSON(path.join(build,'manifest.json')).data_hash,parquet:Object.fromEntries(fs.readdirSync(path.join(out,'data')).map(f=>[f,fileHash(path.join(out,'data',f))]))});
  fs.writeFileSync(path.join(out,'README.md'),'# ATLED Engergy / Rill\n\nRun `rill start .` here. Parquet is copied, so this project is portable. `metrics/energy.yaml` uses the reviewed interval-level definitions. `drafts/` contains query-comment-derived pre-aggregated metrics_view drafts excluded via `.rillignore`; review grouping and aggregation before enabling them. The source snapshot contains only the run scope. This export does not connect to a Rill Cloud account.\n');
  return {out,queries:metadata.length};
}
