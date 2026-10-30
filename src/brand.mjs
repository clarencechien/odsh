import fs from 'node:fs';import path from 'node:path';
import {escapeHTML} from './common.mjs';
export function presentHtml(html,{workspace,report=false,editorial=true,dashboardHref='dashboard.html',reportHref='report.html'}={}){
 const base=path.join(workspace,'brand'),alternative=path.join(workspace,'report-brand');
 const dir=report&&editorial&&fs.existsSync(alternative)?alternative:base;
 const read=(folder,name)=>fs.existsSync(path.join(folder,name))?fs.readFileSync(path.join(folder,name),'utf8'):'';
 const chassis=report&&editorial?read(dir,'report.css'):'';
 const overrides=read(dir,'overrides.css'),extra=report&&editorial?read(dir,'report-overrides.css'):'';
 const styles=[['chassis',chassis],['overrides',overrides],['report',extra]].filter(([,css])=>css).map(([name,css])=>`<style data-report-brand="${name}">${css}</style>`).join('');
 const attrs=read(dir,report?'report-attributes.html':'dashboard-attributes.html').trim();
 const title=(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'Report').replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[entity]);
 const tokens={title,dashboardHref,reportHref,dashboardCurrent:report?'':'aria-current="page"',reportCurrent:report?'aria-current="page"':'',view:report?'report':'dashboard'};
 const masthead=read(dir,'masthead.html').replace(/\{\{(\w+)\}\}/g,(_,key)=>key.endsWith('Current')?tokens[key]||'':escapeHTML(tokens[key]||''));
 const controls=read(dir,'controls.js');
 const meta=report&&editorial?read(dir,'meta.html'):'';
 return html.replace('<head>',()=>'<head>'+meta).replace('</head>',()=>styles+'</head>').replace(/<body([^>]*)>/,(_,existing)=>`<body${existing}${attrs?' '+attrs:''}>${masthead}`).replace('</body>',()=>`${controls?`<script>${controls}</script>`:''}</body>`);
}
