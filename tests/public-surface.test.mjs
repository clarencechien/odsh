import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';
import {parse} from '@babel/parser';import {ROOT,filesUnder} from '../src/common.mjs';
test('all non-public imports are the explicit three-symbol single-export adapter',()=>{
 const imports=[];
 for(const dir of ['src','td'])if(fs.existsSync(path.join(ROOT,dir)))for(const file of filesUnder(path.join(ROOT,dir)).filter(f=>f.endsWith('.mjs'))){
  const ast=parse(fs.readFileSync(file,'utf8'),{sourceType:'module'});
  const visit=node=>{
   if(!node||typeof node!=='object')return;
   if(node.type==='ImportDeclaration'&&node.source.value.startsWith('@open-dashboard/core/'))imports.push({file:path.relative(ROOT,file),symbols:node.specifiers.map(s=>s.imported?.name||'*')});
   if(node.type==='ImportExpression'&&node.source.type==='StringLiteral')assert.ok(!node.source.value.startsWith('@open-dashboard/core/'),'No hidden dynamic imports');
   for(const [key,value]of Object.entries(node))if(!['loc','extra'].includes(key)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  };visit(ast);
 }
 assert.deepEqual(imports,[{file:'src/upstream.mjs',symbols:['exportHtml','Workspace','loadConfig']}]);
 // Strict handoff <=1 remains an explicitly reported upstream gap, not a passing claim.
});
