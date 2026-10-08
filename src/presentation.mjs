import fs from 'node:fs';import path from 'node:path';
export function presentHtml(html,{workspace,report=false,editorial=true,dashboardHref='dashboard.html',reportHref='report.html'}={}){
 const base=fs.readFileSync(path.join(workspace,'theme-overrides/energy-loop.css'),'utf8');
 const extra=report&&editorial?fs.readFileSync(path.join(workspace,'theme-overrides/imitator.css'),'utf8'):'';
 const style=`<style data-energy-loop="base">${base}</style>${extra?`<style data-snapreport-theme="imitator">${extra}</style>`:''}`;
 const nav=`<header class="loop-masthead"><div class="loop-wordmark"><span class="loop-brand-mark" aria-hidden="true"></span><span>ATLED <strong>Engergy</strong><small>ENERGY LOOP</small></span></div><nav aria-label="呈現模式"><a ${!report?'aria-current="page"':''} href="${dashboardHref}">營運 Dashboard</a><a ${report?'aria-current="page"':''} href="${reportHref}">決策週報 Report</a></nav><span class="loop-snapshot-label">${report?'固定週期 · 決策文件':'互動快照 · 設備探索'}</span></header>`;
 return html.replace('</head>',()=>style+'</head>').replace(/<body([^>]*)>/,(_,attrs)=>`<body${attrs} data-energy-view="${report?'report':'dashboard'}">${nav}`);
}
