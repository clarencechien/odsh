import test from 'node:test';import assert from 'node:assert/strict';import {DuckDBInstance} from '@duckdb/node-api';
import {calculateMeasures} from '../src/metrics.mjs';
test('derived metric macros bind aggregates, quoted identifiers, nulls and cycles',async()=>{
 const instance=await DuckDBInstance.create(':memory:'),db=await instance.connect();
 try{
  await db.run('CREATE TABLE requests (duration DOUBLE, failed BOOLEAN); INSERT INTO requests VALUES (10,false),(30,true),(20,false)');
  const definition={model:'requests',measures:[{name:'count_all',expression:'count(*)'},{name:'sum_duration',expression:'sum("duration")'},{name:'mean_duration',type:'derived',expression:'sum_duration / count_all'},{name:'double_mean',type:'derived',expression:'mean_duration * 2'},{name:'empty_result',expression:'sum(duration) FILTER (WHERE duration < 0)'}]};
  const row=await calculateMeasures(db,definition);assert.equal(Number(row.count_all),3);assert.equal(row.mean_duration,20);assert.equal(row.double_mean,40);assert.equal(row.empty_result,null);
  await assert.rejects(calculateMeasures(db,{model:'requests',measures:[{name:'first',type:'derived',expression:'second + 1'},{name:'second',type:'derived',expression:'first + 1'}]}),/Cyclic derived measure/);
 }finally{db.closeSync();instance.closeSync();}
});
