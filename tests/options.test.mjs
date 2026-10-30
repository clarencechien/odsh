import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {parse,stringify} from 'yaml';
import {optionSlot,generateOptions} from '../td/options.mjs';import {generateRun,prepareWorkspace} from '../src/pack.mjs';import {ROOT,runPath} from '../src/common.mjs';
test('letters survive additions, removals and narrowing without reuse',()=>{
 const first=optionSlot(['beta','gamma']);const second=optionSlot(['alpha','gamma'],first);assert.equal(second.choices.find(x=>x.value==='gamma').letter,'B');assert.equal(second.choices.find(x=>x.value==='alpha').letter,'C');
 const third=optionSlot(['beta','gamma','alpha'],second);assert.equal(third.choices.find(x=>x.value==='beta').letter,'A');
 const wide=optionSlot(Array.from({length:27},(_,i)=>i));assert.equal(wide.needs_narrowing,true);assert.deepEqual(wide.choices,[]);
});
test('options follow metrics edits, native widgets and actual dimension cardinalities',async()=>{
 const id=`test-options-${process.pid}`,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'odsh-options-')),out=path.join(tmp,'options.json'),metricsFile=path.join(tmp,'metrics.yaml');
 try{
  await generateRun(id,{pack:'o11y',days:2});await prepareWorkspace(id);
  fs.copyFileSync(path.join(ROOT,'packs/o11y/rill/metrics.yaml'),metricsFile);
  const args={pack:'o11y',run:id,out,metricsFile},first=await generateOptions(args),repeat=await generateOptions(args);assert.equal(first.options_version,repeat.options_version);
  assert.equal(first.slots['value:path'].count,40);assert.equal(first.slots['value:path'].needs_narrowing,true);assert.deepEqual(first.slots['value:path'].choices,[]);assert.equal(first.slots['value:service'].choices.length,3);
  assert.equal(first.slots.widget.needs_narrowing,true);assert.equal(first.slots.widget_group.needs_narrowing,false);assert.ok(first.slots.widget_group.choices.length>1);assert.ok(first.slots['widget:Basics'].choices.some(x=>x.value==='Stat'));
  const metrics=parse(fs.readFileSync(metricsFile,'utf8'));metrics.measures.push({name:'aaa_count',expression:'count(*)'});fs.writeFileSync(metricsFile,stringify(metrics));
  const second=await generateOptions(args);assert.notEqual(second.options_version,first.options_version);assert.equal(second.slots.measure.choices.length,4);
  for(const choice of first.slots.measure.choices)assert.equal(second.slots.measure.choices.find(x=>x.value===choice.value).letter,choice.letter);
 }finally{fs.rmSync(runPath(id),{recursive:true,force:true});fs.rmSync(tmp,{recursive:true,force:true});}
});
