import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {ROOT,fileHash,writeJSON} from '../src/common.mjs';
const out=path.resolve(ROOT,'../atled-engergy-mvp.tgz');
const include=['README.md','package.json','package-lock.json','tsconfig.json','.gitignore','snapreport.yaml','open-dashboard.config.ts','src','scripts','tests','dashboards','charts','databases','themes','theme-overrides','demos','adapters','docs','test-results','runs/index.html'];
for(const prefix of ['demo','atlas','meridian','helios'])for(const item of ['input','build','rill','generation.json','quality.json'])include.push(`runs/${prefix}-2026-q3-v3/${item}`);
const result=spawnSync('tar',['-czf',out,...include],{cwd:ROOT,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);
writeJSON(out+'.json',{file:path.basename(out),sha256:fileHash(out),bytes:fs.statSync(out).size,excludes:['node_modules','.runtime','.git','credentials','Docker volumes']});console.log(out);
