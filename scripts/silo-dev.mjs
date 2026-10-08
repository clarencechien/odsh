import fs from 'node:fs';import path from 'node:path';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';import {ROOT,writeJSON} from '../src/common.mjs';
const runtime=path.join(ROOT,'.runtime');fs.mkdirSync(runtime,{recursive:true});
const file=path.join(runtime,'silo.env');
if(!fs.existsSync(file))fs.writeFileSync(file,`MINIO_ROOT_USER=atledlocal\nMINIO_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\n`,{mode:0o600});
const name='atled-silo-dev',image='pgsty/silo@sha256:b616a0cf8cb281e7e6bb3c9b1fb53875b4016a2878223925541c18f82d6c5ca3';
const inspect=spawnSync('docker',['inspect',name],{encoding:'utf8'});
let result;
if(inspect.status===0){const info=JSON.parse(inspect.stdout)[0];if(info.Config.Labels?.['atled.project']!=='snapreport')throw Error('Container name belongs to another project');result=spawnSync('docker',['start',name],{encoding:'utf8'});}
else result=spawnSync('docker',['run','-d','--name',name,'--label','atled.project=snapreport','-p','127.0.0.1:9000:9000','-p','127.0.0.1:9001:9001','--env-file',file,'-v','atled-silo-data:/data',image,'server','/data','--console-address',':9001'],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr);
let ready=false;for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:9000/minio/health/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
if(!ready)throw Error('Silo did not become ready on port 9000');
writeJSON(path.join(runtime,'silo-runtime.json'),{image,container:name,endpoint:'http://127.0.0.1:9000',ready:true});console.log('PGSTY Silo ready on port 9000; credentials stored only in ignored .runtime/silo.env');
