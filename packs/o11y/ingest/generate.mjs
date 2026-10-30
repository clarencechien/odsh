import fs from 'node:fs';import path from 'node:path';import {DuckDBInstance} from '@duckdb/node-api';
import {runPath,writeJSON,fileHash,sqlString} from '../../../src/common.mjs';
export async function generate(id,{input,days=14,seed=73}={}){
 if(!Number.isInteger(days)||days<2||days>92)throw Error('days must be 2..92');
 const dir=runPath(id);if(fs.existsSync(dir))throw Error('Run exists; choose a new run_id');
 fs.mkdirSync(path.join(dir,'input'),{recursive:true});const target=path.join(dir,'input/http_requests.parquet');
 const instance=await DuckDBInstance.create(':memory:'),db=await instance.connect();
 let source;
 try{
  await db.run('SET threads = 1');
  if(input){
   const file=path.resolve(input);if(!fs.statSync(file).isFile())throw Error('Input must be a Parquet file');
   await db.run(`SELECT ts,service,path,status,latency_ms FROM read_parquet(${sqlString(file)}) LIMIT 1`);
   fs.copyFileSync(file,target);source={kind:'provided-parquet',file:path.basename(file),sha256:fileHash(file)};
  }else{
   // Three services, a full fortnight, seeded load and an injected checkout incident.
   // Integer hash sampling avoids a global random state and is stable for a fixed seed.
   await db.run(`COPY (
    WITH requests AS (
     SELECT TIMESTAMP '2026-10-16 00:00:00' + (i*30)*INTERVAL 1 SECOND AS ts,
      CASE s WHEN 0 THEN 'gateway' WHEN 1 THEN 'checkout' ELSE 'inventory' END AS service,
      '/api/resource/' || ((i+s)%40)::VARCHAR AS path,
      (hash(i,s,${Number(seed)})%10000)::DOUBLE/10000 AS sample,
      s FROM range(${days}*24*120) t(i) CROSS JOIN range(3) services(s)
    ), signals AS (
     SELECT *,service='checkout' AND ts BETWEEN TIMESTAMP '2026-10-28 09:00:00' AND TIMESTAMP '2026-10-28 10:30:00' AS incident FROM requests
    ) SELECT ts,service,path,
     CASE WHEN sample < CASE WHEN incident THEN .28 ELSE .007 END THEN 503 ELSE 200 END AS status,
     round(35+s*18+sample*120+CASE WHEN incident THEN 700+sample*1100 ELSE 0 END,3) AS latency_ms
    FROM signals ORDER BY ts,service
   ) TO ${sqlString(target)} (FORMAT PARQUET, COMPRESSION ZSTD)`);
   source={kind:'synthetic',generator:'o11y-seeded-v1',seed,days,incident:'checkout latency / 5xx spike; injected, not a measured outage'};
  }
  const info=(await db.runAndReadAll(`SELECT count(*) AS rows, min(ts)::VARCHAR AS start, max(ts)::VARCHAR AS end FROM read_parquet(${sqlString(target)})`)).getRowObjectsJS()[0];
  if(Number(info.rows)===0)throw Error('Empty request input');
  writeJSON(path.join(dir,'generation.json'),{pack:'o11y',synthetic:!input,scope:'single-workspace',tenant:null,timezone:'Asia/Taipei',source,rows:Number(info.rows),start:info.start,end:info.end,limitations:input?['User-provided dataset; source identity requires owner verification']:['Synthetic fixture; not a real customer incident']});
  return {dir,synthetic:!input,rows:Number(info.rows)};
 }finally{db.closeSync();instance.closeSync();}
}
