import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {ROOT,fileHash,writeJSON} from '../src/common.mjs';
const out=path.resolve(ROOT,'../atled-engergy-mvp.tgz');
const include=['README.md','handoff.md','package.json','package-lock.json','tsconfig.json','.gitignore','snapreport.yaml','src','scripts','tests','packs','td','charts','adapters','docs','test-results','runs/index.html'];
for(const prefix of ['demo','atlas','meridian','helios'])for(const item of ['input','build','rill','generation.json'])include.push(`runs/${prefix}-2026-q3${process.env.ATLED_RUN_SUFFIX||'-s1-final'}/${item}`);
const o11y=process.env.ODSH_O11Y_RUN||'o11y-2026-10-s1-final';
for(const item of ['input','build','rill','generation.json','consistency.json'])include.push(`runs/${o11y}/${item}`);
const result=spawnSync('tar',['-czf',out,...include],{cwd:ROOT,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);
writeJSON(out+'.json',{file:path.basename(out),sha256:fileHash(out),bytes:fs.statSync(out).size,excludes:['node_modules','.runtime','.git','credentials','Docker volumes']});console.log(out);
