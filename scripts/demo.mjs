import fs from 'node:fs';import {parseArgs} from 'node:util';
import {generateRun,loadPack} from '../src/pack.mjs';import {build} from '../src/run.mjs';
import {runPath} from '../src/common.mjs';import {exportRill} from '../src/export-rill.mjs';
const {values}=parseArgs({options:{pack:{type:'string'},suffix:{type:'string'}}});
const pack=loadPack(values.pack),suffix=values.suffix||process.env.ATLED_RUN_SUFFIX||pack.demo.suffix;
for(const {prefix,period,tenant,...settings}of pack.demo.runs){
 const id=`${prefix}-${period}${suffix}`;
 if(!fs.existsSync(runPath(id)))console.log(await generateRun(id,{pack:pack.name,tenant,...settings}));
 const manifest=await build(id,{pack:pack.name});console.log(id,manifest.data_hash);
 await exportRill(id);
}
