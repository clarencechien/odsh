import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {parseArgs} from 'node:util';
import {ROOT,runPath,readJSON,writeJSON,hash,stableJSON,fileHash} from '../src/common.mjs';
import {loadPack,packFile,runPack} from '../src/pack.mjs';import {readMetrics,openInputs,sqlIdentifier} from '../src/metrics.mjs';import {upstreamJSON} from '../src/upstream.mjs';
const key=value=>JSON.stringify(value);
const ordered=values=>[...new Map(values.map(v=>[key(v),v])).values()].sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
// Letters are never reassigned, including removed values. An exhausted slot must be narrowed.
export function optionSlot(values,previous={},total){
 const entries=ordered(values),old=[...(previous.choices||[]),...(previous.retired||[])],assigned=new Map(old.map(x=>[key(x.value),x]));
 total??=entries.length;
 const occupied=new Set(old.map(x=>x.letter)),next=[];
 if(total>26)return {count:total,needs_narrowing:true,choices:[],retired:old};
 for(const value of entries){
  const existing=assigned.get(key(value));if(existing){next.push(existing);continue;}
  const letter=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find(x=>!occupied.has(x));
  if(!letter)return {count:total,needs_narrowing:true,reason:'letter history exhausted; narrow or explicitly reset the slot',choices:[],retired:old};
  occupied.add(letter);next.push({letter,value});
 }
 const active=new Set(next.map(x=>key(x.value)));return {count:total,needs_narrowing:false,choices:next.sort((a,b)=>a.letter.localeCompare(b.letter)),retired:old.filter(x=>!active.has(key(x.value))).sort((a,b)=>a.letter.localeCompare(b.letter))};
}
export async function generateOptions({pack:name,run,metricsFile,out}={}){
 if(!run)throw Error('--run is required for distinct values and the native chart catalog');
 const pack=loadPack(name);if(runPack(run).name!==pack.name)throw Error('Run belongs to a different pack');
 const file=metricsFile||packFile(pack,pack.rill),{name:view,definition}=readMetrics(file,pack.name);
 out??=packFile(pack,'td/options.json');const previous=fs.existsSync(out)?readJSON(out):{slots:{}};
 if(previous.pack&&previous.pack!==pack.name)throw Error('Options belong to a different pack');
 const dir=runPath(run),catalog=upstreamJSON(['charts'],{root:path.join(dir,'workspace')});if(catalog.status!==0)throw Error(catalog.stderr);
 const widgets=catalog.data.map(c=>({name:c.name,group:c.kind==='custom'?'Custom':c.group||'Other'})).sort((a,b)=>a.name.localeCompare(b.name));
 const slots={},put=(name,values,total)=>slots[name]=optionSlot(values,previous.slots[name],total);
 put('view',[view]);put('measure',definition.measures.map(m=>m.name));put('dimension',(definition.dimensions||[]).map(d=>d.name));put('grain',definition.smallest_time_grain?[definition.smallest_time_grain]:[]);
 put('widget',widgets.map(w=>w.name));put('widget_group',widgets.map(w=>w.group));
 for(const group of new Set(widgets.map(w=>w.group)))put('widget:'+group,widgets.filter(w=>w.group===group).map(w=>w.name));
 const input=await openInputs(path.join(dir,'input'));
 try{
  for(const dimension of definition.dimensions||[]){
   if(typeof dimension.column!=='string')throw Error(`Dimension needs a reviewed column mapping: ${dimension.name}`);
   const query=`SELECT DISTINCT ${sqlIdentifier(dimension.column)} AS value FROM ${sqlIdentifier(definition.model)}`;
   const count=Number((await input.db.runAndReadAll(`SELECT count(*) n FROM (${query})`)).getRowObjectsJS()[0].n);
   const values=count<=26?(await input.db.runAndReadAll(`${query} ORDER BY value NULLS FIRST`)).getRowObjectsJS().map(r=>r.value):[];
   if(values.some(v=>v!==null&&!['string','number','boolean'].includes(typeof v)))throw Error(`Unsupported dimension value type: ${dimension.name}`);
   put('value:'+dimension.name,values,count);
  }
 }finally{input.close();}
 // Keep removed slots inactive so reintroducing a dimension cannot silently change its letters.
 for(const [name,prior]of Object.entries(previous.slots))if(!Object.hasOwn(slots,name))slots[name]={...optionSlot([],prior),inactive:true};
 const content={schema_version:1,pack:pack.name,metrics_sha256:fileHash(file),catalog_sha256:hash(stableJSON(widgets)),slots};
 const result={...content,options_version:hash(stableJSON(content))};writeJSON(out,result);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const {values}=parseArgs({options:{pack:{type:'string'},run:{type:'string'},out:{type:'string'}}});const result=await generateOptions(values);console.log(JSON.stringify({pack:result.pack,options_version:result.options_version,slots:Object.keys(result.slots).length}));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
