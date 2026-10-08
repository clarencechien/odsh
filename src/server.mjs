import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
import {RUNS} from './common.mjs';
// Preview publishes only built assets, never input Parquet, SQL, or workspaces.
export function createPreview({root=RUNS,port=4173}={}) {
 const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
  const parts=pathname.split('/').filter(Boolean);
  if(parts.includes('..')||parts.includes('.')||pathname.includes('\\')||(parts.length&&!(parts.length===1&&parts[0]==='index.html')&&parts[1]!=='build')){res.writeHead(404).end();return;}
  let file=path.resolve(root,'.'+pathname);if(!file.startsWith(path.resolve(root)+path.sep)&&file!==path.resolve(root)){res.writeHead(404).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  if(!fs.realpathSync(file).startsWith(fs.realpathSync(root)+path.sep)){res.writeHead(404).end();return;}
  const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);
 });
 return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));
}
