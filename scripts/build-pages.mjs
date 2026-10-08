import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, RUNS, readJSON, fileHash, filesUnder, escapeHTML, writeJSON } from '../src/common.mjs';

export const PAGES = path.join(ROOT, '.runtime/pages-site');
const clients = [
  {slug:'atlas',name:'Atlas Semiconductor',focus:'供電韌性 · 契約需量 · 儲能',description:'半導體園區，優先追蹤供電裕度、尖峰需量與儲能調度。'},
  {slug:'meridian',name:'Meridian Logistics',focus:'車隊補能 · 場站光電 · 電費',description:'物流場站，優先追蹤充電可用率、補能服務與光電利用。'},
  {slug:'helios',name:'Helios Cloud',focus:'算力能效 · PUE · 排放',description:'資料中心，優先追蹤冷卻效率、IT 負載與購電排放。'},
];

export function buildPages({suffix=process.env.ATLED_RUN_SUFFIX||'-v1'}={}) {
  if(!/^-[A-Za-z0-9_-]+$/.test(suffix))throw Error('Invalid demo suffix');
  const selected=[...clients.map(c=>({...c,prefix:c.slug})),{slug:'portfolio',prefix:'demo',name:'跨客戶示範總覽'}];
  // Public Pages accepts only explicitly synthetic fixtures. Production customer releases stay in Silo.
  for(const item of selected){
    const id=`${item.prefix}-2026-q3${suffix}`,run=path.join(RUNS,id);
    const generation=readJSON(path.join(run,'generation.json'));
    const manifest=readJSON(path.join(run,'build/manifest.json'));
    if(generation.synthetic!==true||manifest.synthetic!==true)throw Error(`Refusing to publish non-synthetic run ${id}`);
    for(const [file,entry] of Object.entries(manifest.artifacts)) {
      if(fileHash(path.join(run,'build',file))!==entry.sha256)throw Error(`Artifact changed: ${id}/${file}`);
    }
    item.run=run;item.manifest=manifest;
  }
  fs.mkdirSync(path.dirname(PAGES),{recursive:true});
  const stage=fs.mkdtempSync(path.join(path.dirname(PAGES),'pages-stage-'));
  try {
    for(const item of selected){
      const destination=path.join(stage,item.slug);fs.mkdirSync(destination);
      for(const entry of ['site','report.html','report-native.html','dashboard.html','demos','manifest.json'])
        fs.cpSync(path.join(item.run,'build',entry),path.join(destination,entry),{recursive:true});
    }
    const cards=clients.map(c=>{
      const catalog=selected.find(s=>s.slug===c.slug).manifest.catalog.filter(d=>d.site);
      return `<article><p class="eyebrow">${escapeHTML(c.focus)}</p><h2>${c.name}</h2><p>${c.description}</p><nav><a class="primary" href="${c.slug}/dashboard.html">開啟 Dashboard ↗</a><a href="${c.slug}/report.html">閱讀週報 ↗</a></nav><details><summary>查看四個案場的整合方案</summary>${catalog.map(d=>`<p class="site"><a href="${c.slug}/site/d/${d.id}/">${escapeHTML(d.title.replace('ATLED Engergy | ',''))}</a></p>`).join('')}</details></article>`;
    }).join('');
    fs.writeFileSync(path.join(stage,'index.html'),`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLED Engergy — 能源服務展示</title><style>
body{margin:0;background:#edf2ef;color:#153f36;font:16px/1.75 system-ui,sans-serif}header,main,footer{max-width:1120px;margin:auto;padding:40px 24px}header{border-bottom:1px solid #bdcfc5}h1{font-size:clamp(36px,6vw,68px);line-height:1.12;font-weight:500;letter-spacing:-.04em;margin:24px 0}.eyebrow{font-size:12px;letter-spacing:.13em;color:#467168}.intro{max-width:760px}.badge{background:#d9e9df;display:inline-block;border-radius:24px;padding:5px 15px;font-size:13px}main{display:grid;gap:24px}article{background:#fff;padding:28px;border-top:4px solid #008775;border-radius:10px}h2{font-size:27px;font-weight:550;margin:10px 0}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}a{color:#006c5d;text-decoration:none}nav a{padding:12px 20px;border:1px solid #b8d3c6;border-radius:7px}.primary{background:#006f61;color:white}a:hover{text-decoration:underline}.site a{display:block;padding:10px 0;border-bottom:1px solid #e5eee8}summary{cursor:pointer}footer{font-size:13px}details{margin-top:18px}@media(max-width:600px){header,main,footer{padding:24px 16px}article{padding:20px}nav a{flex:1;text-align:center}}
</style></head><body><header><p class="eyebrow">ATLED ENGERGY / INTEGRATED ENERGY SERVICES</p><h1>把每一座案場，<br>連成可理解的能源決策。</h1><p class="intro">智慧樓宇・智慧電網・資料中心・儲能・太陽能・充電樁。選擇一家客戶，即可操作對應的 Dashboard、切換案場與週期，或閱讀能源週報。</p><span class="badge">互動示範 · 三家客戶 · 十二案場 · 全部為合成資料</span></header><main>${cards}<article><p class="eyebrow">PORTFOLIO / 整合視角</p><h2>跨客戶能源總覽</h2><p>查看整個虛構企業的能源供需、異常事件及設備績效。</p><nav><a href="portfolio/dashboard.html">開啟整體 Dashboard ↗</a><a href="portfolio/site/d/energy/">瀏覽全部頁面 ↗</a><a href="atlas/demos/react/">React 嵌入範例</a><a href="atlas/demos/vue/">Vue 嵌入範例</a></nav></article></main><footer>所有企業、數據與事件均為虛構。頁面呈現凍結快照，可操作預先計算的篩選；不代表即時設備狀態或保證收益。<br><a href="https://github.com/clarencechien/odsh">原始碼與操作說明 ↗</a></footer></body></html>`);
    fs.writeFileSync(path.join(stage,'.nojekyll'),'');
    writeJSON(path.join(stage,'deployment.json'),{company:'ATLED Engergy',synthetic:true,runs:selected.map(s=>({id:s.manifest.run_id,path:s.slug,data_hash:s.manifest.data_hash})),files:filesUnder(stage).length});
    fs.rmSync(PAGES,{recursive:true,force:true});fs.renameSync(stage,PAGES);
    return PAGES;
  } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(buildPages());
