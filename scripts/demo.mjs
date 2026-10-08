import fs from 'node:fs';import {generate} from '../src/generate.mjs';import {build} from '../src/build.mjs';import {runPath} from '../src/common.mjs';import {exportRill} from '../src/export-rill.mjs';
const suffix=process.env.ATLED_RUN_SUFFIX||'-v1';
for(const [prefix,tenant]of [['demo',undefined],['atlas','Atlas Semiconductor'],['meridian','Meridian Logistics'],['helios','Helios Cloud']]){
 const id=prefix+'-2026-q3'+suffix;
 if(!fs.existsSync(runPath(id)))console.log(await generate(id,{tenant}));
 const manifest=await build(id);console.log(id,manifest.data_hash);
 await exportRill(id);
}
