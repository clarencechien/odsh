import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import {parseEnv} from 'node:util';import {Client} from 'minio';
import {ROOT,readJSON,stableJSON,hash,writeJSON} from './common.mjs';import {stageRelease,STAGING} from './release.mjs';
export function siloClient(){
 const localFile=path.join(ROOT,'.runtime/silo.env'),local=fs.existsSync(localFile)?parseEnv(fs.readFileSync(localFile,'utf8')):{};
 const endpoint=new URL(process.env.SILO_ENDPOINT||'http://127.0.0.1:9000');
 const isLocal=['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname);
 if(!isLocal&&endpoint.protocol!=='https:')throw Error('Remote Silo requires HTTPS');
 const accessKey=process.env.SILO_ACCESS_KEY||(isLocal?local.MINIO_ROOT_USER:undefined),secretKey=process.env.SILO_SECRET_KEY||(isLocal?local.MINIO_ROOT_PASSWORD:undefined);
 if(!accessKey||!secretKey)throw Error('Configure SILO_ACCESS_KEY and SILO_SECRET_KEY securely, or start scripts/silo-dev.mjs');
 return new Client({endPoint:endpoint.hostname,port:Number(endpoint.port||(endpoint.protocol==='https:'?443:80)),useSSL:endpoint.protocol==='https:',accessKey,secretKey,region:'us-east-1'});
}
const contentType=file=>({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'}[path.extname(file)]||'application/octet-stream');
async function bytes(stream){const chunks=[];for await(const chunk of stream)chunks.push(chunk);return Buffer.concat(chunks);}
async function maybeObject(client,bucket,key){try{return await bytes(await client.getObject(bucket,key));}catch(e){if(['NoSuchKey','NoSuchObject','NotFound','NoSuchBucket'].includes(e.code))return null;throw e;}}
export async function publishSilo(id,options={}){
 const staged=stageRelease(id,options),release=readJSON(path.join(staged.destination,'release.json')),bucket=`atled-${staged.scope}`,client=siloClient();
 if(!await client.bucketExists(bucket))await client.makeBucket(bucket,'us-east-1');
 const releaseKey=`${id}/release.json`,existing=await maybeObject(client,bucket,releaseKey);
 if(existing&&stableJSON(JSON.parse(existing))!==stableJSON(release))throw Error('Silo release is immutable; use a new run_id');
 let verified=0;
 for(const [file,sha256]of Object.entries(release.artifacts)){
  const key=`${id}/${file}`,buffer=fs.readFileSync(path.join(staged.destination,file));
  if(!existing)await client.putObject(bucket,key,buffer,buffer.length,{'Content-Type':contentType(file),'x-amz-meta-sha256':sha256});
  const downloaded=await maybeObject(client,bucket,key);if(!downloaded||hash(downloaded)!==sha256)throw Error(`Silo read-back checksum failed: ${key}`);verified++;
 }
 // Commit marker is written only once all reader artifacts passed read-back verification.
 if(!existing){const buffer=Buffer.from(JSON.stringify(release,null,2));await client.putObject(bucket,releaseKey,buffer,buffer.length,{'Content-Type':'application/json'});}
 const index=fs.readFileSync(path.join(STAGING,staged.scope,'index.html'));await client.putObject(bucket,'index.html',index,index.length,{'Content-Type':'text/html; charset=utf-8'});
 const evidence={run_id:id,bucket,objects_verified:verified,data_hash:release.data_hash,private_bucket:true,backend:'pgsty/silo',verified_at:new Date().toISOString()};
 writeJSON(path.join(ROOT,'test-results',`silo-${id}.json`),evidence);return evidence;
}
export async function serveSilo(scope,{port=4174}={}){
 if(!['atlas','meridian','helios','internal'].includes(scope))throw Error('Choose silo scope: atlas|meridian|helios|internal');
 const client=siloClient(),bucket=`atled-${scope}`;
 const server=http.createServer(async(req,res)=>{
  let key;try{key=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');}catch{res.writeHead(400).end();return;}
  if(key.split('/').includes('..')||key.includes('\\')||!['GET','HEAD'].includes(req.method)){res.writeHead(400).end();return;}
  if(!key||key.endsWith('/'))key+='index.html';
  // Source tables/workspaces are never uploaded, and only completed releases can be read.
  if(key!=='index.html'){
   const run=key.split('/')[0];const release=await maybeObject(client,bucket,`${run}/release.json`).catch(()=>null);
   if(!release){res.writeHead(404).end();return;}
   const relative=key.slice(run.length+1);if(!JSON.parse(release).artifacts[relative]){res.writeHead(404).end();return;}
  }
  try{const object=await client.getObject(bucket,key);res.writeHead(200,{'Content-Type':contentType(key),'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});if(req.method==='HEAD'){object.destroy();res.end();}else{object.on('error',()=>res.destroy());object.pipe(res);}}
  catch{res.writeHead(404).end();}
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
