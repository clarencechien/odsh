import fs from 'node:fs';import path from 'node:path';import {parse} from 'yaml';import {DuckDBInstance} from '@duckdb/node-api';
import {sqlString} from './common.mjs';
export const sqlIdentifier=value=>'"'+String(value).replaceAll('"','""')+'"';
export function readMetrics(file,fallback){
 const definition=parse(fs.readFileSync(file,'utf8')),name=definition.name||fallback;
 if(!/^[a-zA-Z][\w-]*$/.test(name||'')||typeof definition.model!=='string'||!Array.isArray(definition.measures)||!definition.measures.length)throw Error('Invalid metrics view');
 const names=new Set();for(const m of definition.measures){if(!/^[a-zA-Z][\w]*$/.test(m.name||'')||!m.expression||names.has(m.name.toLowerCase()))throw Error('Invalid or duplicate measure');names.add(m.name.toLowerCase());}
 return {name,definition};
}
export async function openInputs(inputDir){
 const instance=await DuckDBInstance.create(':memory:'),db=await instance.connect();
 try{
  await db.run('SET threads = 1');
  for(const file of fs.readdirSync(inputDir).filter(f=>f.endsWith('.parquet')).sort())await db.run(`CREATE VIEW ${sqlIdentifier(path.basename(file,'.parquet'))} AS SELECT * FROM read_parquet(${sqlString(path.join(inputDir,file))})`);
  return {db,close(){db.closeSync();instance.closeSync();}};
 }catch(error){db.closeSync();instance.closeSync();throw error;}
}
// Only metric expressions are authored SQL. There is no SQL generator for dashboards here.
// Parameterized macros substitute explicit inputs, including derived aggregates, so an
// unbound column in a zero-argument macro cannot silently use the wrong relation.
export async function measureExpressions(db,definition){
 const columns=(await db.runAndReadAll(`DESCRIBE SELECT * FROM ${sqlIdentifier(definition.model)}`)).getRowObjectsJS().map(r=>r.column_name);
 const measures=new Map(definition.measures.map(m=>[m.name.toLowerCase(),m])),compiled=new Map(),visiting=new Set();
 const columnMap=new Map(columns.map(c=>[c.toLowerCase(),c]));
 const compile=async key=>{
  if(compiled.has(key))return compiled.get(key);
  if(visiting.has(key))throw Error(`Cyclic derived measure: ${key}`);visiting.add(key);
  const measure=measures.get(key);if(!measure)throw Error(`Unknown measure: ${key}`);
  const tokens=measure.expression.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z0-9_]*|\s+|./g)||[];
  const bindings=new Map();let body='';
  for(let i=0;i<tokens.length;i++){
   const token=tokens[i],quoted=token.startsWith('"'),identifier=quoted?token.slice(1,-1).replaceAll('""','"'):/^[A-Za-z_][\w]*$/.test(token)?token:null;
   const following=tokens.slice(i+1).find(t=>t.trim());
   if(identifier&&(quoted||following!=='(')){
    const lower=identifier.toLowerCase(),dependency=measure.type==='derived'&&measures.has(lower);
    if(dependency||columnMap.has(lower)){
     const binding=(dependency?'measure:':'column:')+lower;
     if(!bindings.has(binding))bindings.set(binding,{parameter:`__arg_${bindings.size}`,value:dependency?await compile(lower):sqlIdentifier(columnMap.get(lower))});
     body+=sqlIdentifier(bindings.get(binding).parameter);continue;
    }
   }
   body+=token;
  }
  const macro='__odsh_metric_'+definition.measures.indexOf(measure),args=[...bindings.values()];
  await db.run(`CREATE MACRO ${sqlIdentifier(macro)}(${args.map(a=>sqlIdentifier(a.parameter)).join(',')}) AS (${body})`);
  const expression=`${sqlIdentifier(macro)}(${args.map(a=>a.value).join(',')})`;
  compiled.set(key,expression);visiting.delete(key);return expression;
 };
 for(const key of measures.keys())await compile(key);
 return Object.fromEntries(definition.measures.map(m=>[m.name,compiled.get(m.name.toLowerCase())]));
}
export async function calculateMeasures(db,definition){
 const expressions=await measureExpressions(db,definition),select=Object.entries(expressions).map(([name,sql])=>`${sql} AS ${sqlIdentifier(name)}`).join(',');
 return (await db.runAndReadAll(`SELECT ${select} FROM ${sqlIdentifier(definition.model)}`)).getRowObjectsJS()[0];
}
