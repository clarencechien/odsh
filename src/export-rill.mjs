import fs from 'node:fs';import path from 'node:path';import {parse,stringify} from 'yaml';
import {runPath,readJSON,writeJSON,fileHash,filesUnder} from './common.mjs';
export function queryMetadata(text){
 return text.split(/(?=^-- name:)/m).filter(s=>/^-- name:/m.test(s)).map(block=>({name:block.match(/^-- name:\s*(.+)$/m)[1].trim(),description:block.match(/^-- description:\s*(.+)$/m)?.[1].trim(),metric:block.match(/^-- metric:\s*(.+)$/m)?.[1].trim()}));
}
export async function exportRill(id){
 const dir=runPath(id),build=path.join(dir,'build'),manifest=readJSON(path.join(build,'manifest.json'));
 const workspace=path.join(dir,'workspace'),source=path.join(workspace,'metrics.yaml');
 if(!fs.existsSync(source))throw Error('Pack has no metrics definition');
 const metrics=parse(fs.readFileSync(source,'utf8')),out=path.join(dir,'rill'),stage=path.join(dir,'.rill-staging');
 fs.rmSync(stage,{recursive:true,force:true});for(const folder of ['data','sources','metrics'])fs.mkdirSync(path.join(stage,folder),{recursive:true});
 const yaml=(file,value)=>fs.writeFileSync(path.join(stage,file),stringify(value));
 yaml('rill.yaml',{compiler:'rillv1',title:manifest.company});
 for(const [file,input]of Object.entries(manifest.inputs)){
  if(fileHash(path.join(dir,'input',file))!==input.sha256)throw Error(`Input changed: ${file}`);
  fs.copyFileSync(path.join(dir,'input',file),path.join(stage,'data',file));
  yaml(`sources/${path.basename(file,'.parquet')}.yaml`,{type:'source',connector:'local_file',path:`data/${file}`});
 }
 const view=metrics.name||manifest.pack;const {name,...definition}=metrics;
 yaml(`metrics/${view}.yaml`,definition);
 fs.writeFileSync(path.join(stage,'.rillignore'),'README.md\nexport-manifest.json\n');
 fs.writeFileSync(path.join(stage,'README.md'),'# Snapshot exploration\n\nRun `rill start .`. Source Parquet and reviewed metrics are portable. No generated MAX-of-aggregate drafts. Runtime / Cloud operation is a separate integration.\n');
 writeJSON(path.join(stage,'export-manifest.json'),{run_id:id,pack:manifest.pack,data_hash:manifest.data_hash,metrics_sha256:fileHash(source),files:Object.fromEntries(filesUnder(stage).map(f=>[path.relative(stage,f),fileHash(f)]))});
 fs.rmSync(out,{recursive:true,force:true});fs.renameSync(stage,out);
 return {out,measures:metrics.measures.length};
}
