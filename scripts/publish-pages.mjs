import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';
import {buildPages} from './build-pages.mjs';import {ROOT} from '../src/common.mjs';
const remote='https://github.com/clarencechien/odsh.git';
function git(args,cwd){const result=spawnSync('git',args,{cwd,encoding:'utf8'});if(result.status!==0)throw Error(result.stderr||result.stdout);return result.stdout.trim();}
const site=buildPages(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'atled-pages-'));
try{
 git(['init','--initial-branch=gh-pages'],temp);
 git(['config','user.name',git(['config','user.name'],ROOT)],temp);
 git(['config','user.email',git(['config','user.email'],ROOT)],temp);
 git(['remote','add','origin',remote],temp);
 if(git(['ls-remote','origin','refs/heads/gh-pages'],temp)){
   git(['fetch','--depth=1','origin','gh-pages'],temp);git(['checkout','-B','gh-pages','FETCH_HEAD'],temp);
   const managed=path.join(temp,'deployment.json');
   if(!fs.existsSync(managed)||JSON.parse(fs.readFileSync(managed,'utf8')).company!=='ATLED Engergy')throw Error('Existing gh-pages is not managed by this publisher; refusing to overwrite');
   for(const entry of fs.readdirSync(temp))if(entry!=='.git')fs.rmSync(path.join(temp,entry),{recursive:true,force:true});
 }
 fs.cpSync(site,temp,{recursive:true});
 git(['add','--all'],temp);
 if(!git(['status','--porcelain'],temp)){console.log('Published branch already matches generated site');process.exitCode=0;}
 else{
  const source=git(['rev-parse','--short','HEAD'],ROOT);
  git(['commit','-m',`Publish ATLED Engergy synthetic demo (${source})`],temp);
  console.log(git(['push','origin','HEAD:gh-pages'],temp));
  console.log('Static website pushed to gh-pages. Check the Pages deployment workflow for completion: https://github.com/clarencechien/odsh/actions');
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
