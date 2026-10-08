import { parse } from '@babel/parser';
const formats = new Set(['number','integer','decimal','compact','currency','currencyCompact','percent','text','date','month']);
export function lintSource(code, queries, {allowLiterals=[]}={}) {
  const findings=[]; let ast;
  try {ast=parse(code,{sourceType:'module',plugins:['jsx','typescript']});} catch(e){return [{severity:'error',message:e.message,line:e.loc?.line||1}];}
  const names=new Map([['Prose','Prose'],['Text','Text']]);
  for(const n of ast.program.body) if(n.type==='ImportDeclaration') for(const s of n.specifiers) {
    if(s.type==='ImportSpecifier'&&s.imported.name==='Text') names.set(s.local.name,'Text');
    if(s.type==='ImportDefaultSpecifier'&&/prose(?:\/index)?$/.test(n.source.value)) names.set(s.local.name,'Prose');
  }
  const literal=n=>n?.type==='StringLiteral'||n?.type==='NumericLiteral'?String(n.value):n?.type==='JSXExpressionContainer'?literal(n.expression):n?.type==='TemplateLiteral'&&!n.expressions.length?n.quasis[0].value.cooked:undefined;
  function walk(n,fn){if(!n||typeof n!=='object')return;fn(n); for(const [k,v] of Object.entries(n)){if(['loc','extra','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,fn));else if(v&&typeof v==='object')walk(v,fn);}}
  walk(ast,n=>{
    if(n.type!=='JSXElement')return;
    const opening=n.openingElement,kind=names.get(opening.name.name);if(!kind)return;
    const attrs=new Map(opening.attributes.filter(a=>a.type==='JSXAttribute').map(a=>[a.name.name,literal(a.value)]));
    const add=message=>findings.push({severity:'error',message,line:n.loc.start.line});
    if(opening.attributes.some(a=>a.type==='JSXSpreadAttribute'))add(`${kind}: spread props cannot be verified`);
    const checkNumbers=text=>{
      let residual=text.replace(/\{\{\s*\w+(?::\w+)?\s*\}\}/g,'');
      for(const allowed of allowLiterals) {if(allowed)residual=residual.split(allowed).join('');}
      if(/[\p{Nd}]/u.test(residual))add(`${kind}: bare number in narrative; use SQL-backed Prose placeholders`);
    };
    if(kind==='Prose'){
      const query=attrs.get('query'),text=attrs.get('text');
      if(typeof query!=='string'||typeof text!=='string'){add('Prose requires literal query and text');return;}
      const columns=queries[query];if(!columns)add(`Unknown query: ${query}`);
      for(const match of text.matchAll(/\{\{\s*(\w+)(?::(\w+))?\s*\}\}/g)){
        if(columns&&!columns.includes(match[1]))add(`Unknown placeholder ${query}.${match[1]}`);
        if(match[2]&&!formats.has(match[2]))add(`Unknown format ${match[2]}`);
      }
      if(/[{}]/.test(text.replace(/\{\{\s*\w+(?::\w+)?\s*\}\}/g,'')))add('Malformed placeholder');
      checkNumbers(text);
      // No children or HTML props: visible narrative must live in the verified literal.
      if(n.children.some(c=>c.type!=='JSXText'||c.value.trim()))add('Prose children cannot be verified');
    }else{
      const inspect=child=>{
        if(child.type==='JSXText')checkNumbers(child.value);
        else if(child.type==='JSXExpressionContainer'){const value=literal(child);if(value===undefined)add('Text dynamic expression cannot be verified');else {checkNumbers(value);if(value.includes('{{'))add('Text cannot contain placeholders');}}
        else if(child.type==='JSXElement')child.children.forEach(inspect);
        if(child.type==='JSXText'&&child.value.includes('{{'))add('Text cannot contain placeholders');
      };n.children.forEach(inspect);
      if(attrs.has('children')||attrs.has('dangerouslySetInnerHTML'))add('Text must use literal JSX children');
    }
    if(attrs.has('title'))checkNumbers(attrs.get('title')||'');
  });
  return findings;
}
export async function boundedValidation(validate, repair, maxAttempts=3) {
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3) throw Error('maxAttempts must be 1..3');
  const attempts=[];
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const result=await validate(attempt);attempts.push(result);
    if(result.ok)return {ok:true,attempts};
    if(!repair||attempt===maxAttempts)break;
    const changed=await repair(result,attempt);if(!changed)break;
  }
  return {ok:false,attempts};
}
