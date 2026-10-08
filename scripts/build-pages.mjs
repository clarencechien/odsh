import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, RUNS, readJSON, fileHash, filesUnder, escapeHTML, writeJSON } from '../src/common.mjs';

export const PAGES = path.join(ROOT, '.runtime/pages-site');
const clients = [
  {slug:'atlas',name:'Atlas Semiconductor',focus:'供電韌性 · 契約需量 · 儲能',description:'能源流向、契約需量與樓宇熱圖；對照製程微電網和智慧研發樓的不同配置。'},
  {slug:'meridian',name:'Meridian Logistics',focus:'車隊補能 · 場站光電 · 電費',description:'充電熱圖、設備狀態時間軸與補能可用率；辨識夜間車隊需求及冷鏈場站中斷。'},
  {slug:'helios',name:'Helios Cloud',focus:'算力能效 · PUE · 排放',description:'溫度與 PUE 散點、IT／冷卻耗能拆解；比較 AI 算力中心和綠能邊緣機房。'},
];

export function buildPages({suffix=process.env.ATLED_RUN_SUFFIX||'-v3'}={}) {
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
      return `<article><p class="eyebrow">${escapeHTML(c.focus)}</p><h2>${c.name}</h2><p>${c.description}</p><nav><a class="primary" href="${c.slug}/dashboard.html">營運 Dashboard ↗</a><a href="${c.slug}/report.html">決策 Report ↗</a></nav><details><summary>查看兩個案場的整合方案</summary>${catalog.map(d=>`<p class="site"><a href="${c.slug}/site/d/${d.id}/">${escapeHTML(d.title.replace('ATLED Engergy | ',''))}</a></p>`).join('')}</details></article>`;
    }).join('');
    fs.writeFileSync(path.join(stage,'index.html'),`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLED Engergy — 能源服務展示</title><style>
*{box-sizing:border-box}body{margin:0;background:#f2f7fc;color:#18344c;font:16px/1.75 system-ui,sans-serif}header,main,footer{max-width:1180px;margin:auto;padding:40px 28px}header{margin-top:30px;background:white;border:2px solid #0087dc;border-top:12px solid transparent;border-image:linear-gradient(90deg,#0087dc 0 48%,#54c9c9 48% 82%,#b8eb68 82%) 1}h1{font-size:clamp(36px,6vw,66px);line-height:1.2;font-weight:650;letter-spacing:-.04em;margin:24px 0;color:#0087dc}.eyebrow{font-size:12px;letter-spacing:.13em;color:#32779d}.intro{max-width:820px}.badge{background:#e7f4fc;display:inline-block;border-radius:24px;padding:5px 15px;font-size:13px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}article{background:#fff;padding:25px;border-top:4px solid #0087dc;border-radius:10px;box-shadow:0 5px 22px #16456408}article:nth-child(2){border-color:#54c9c9}article:nth-child(3){border-color:#b8eb68}article:last-child{grid-column:1/-1}h2{font-size:25px;font-weight:650;margin:10px 0;line-height:1.3}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}a{color:#0072bc;text-decoration:none}nav a{padding:10px 15px;border:1px solid #c6dfef;border-radius:7px}.primary{background:#0087dc;color:white}a:hover{text-decoration:underline}.site a{display:block;padding:10px 0;border-bottom:1px solid #e0ecf4}summary{cursor:pointer;font-size:14px}footer{font-size:13px}details{margin-top:18px}.modes{display:flex;gap:24px;margin-top:24px;padding-top:20px;border-top:1px solid #dceaf3}.modes p{flex:1;margin:0;font-size:14px}.modes strong{display:block;color:#0072bc;font-size:17px}@media(max-width:950px){main{grid-template-columns:1fr}}@media(max-width:600px){header,main,footer{padding:24px 16px}header{margin:16px}article{padding:20px}.modes{flex-direction:column}nav a{flex:1;text-align:center}}
</style></head><body><header><p class="eyebrow">ATLED ENGERGY / INTEGRATED ENERGY SERVICES</p><h1>Energy Loop<br>讓能源整合，形成決策。</h1><p class="intro">智慧樓宇・智慧電網・資料中心・儲能・太陽能・充電樁。選擇一家客戶，即可操作對應的 Dashboard、切換案場與週期，或閱讀能源週報。</p><span class="badge">互動示範 · 三家客戶 · 六案場 · 全部為合成資料</span><div class="modes"><p><strong>Dashboard / 掌握營運</strong>切換案場與週期，追蹤能源流向、設備狀態及營運指標。</p><p><strong>Report / 推動決策</strong>固定報告週期，閱讀結論、成本瀑布、前週比較與後續行動。</p></div></header><main>${cards}<article><p class="eyebrow">PORTFOLIO / 整合視角</p><h2>跨客戶能源總覽</h2><p>查看整個虛構企業的能源供需、異常事件及設備績效。</p><nav><a href="portfolio/dashboard.html">開啟整體 Dashboard ↗</a><a href="portfolio/site/d/energy/">瀏覽全部頁面 ↗</a><a href="atlas/demos/react/">React 嵌入範例</a><a href="atlas/demos/vue/">Vue 嵌入範例</a></nav></article></main><footer>所有企業、數據與事件均為虛構。頁面呈現凍結快照，可操作預先計算的篩選；不代表即時設備狀態或保證收益。<br><a href="https://github.com/clarencechien/odsh">原始碼與操作說明 ↗</a></footer></body></html>`);
    fs.writeFileSync(path.join(stage,'.nojekyll'),'');
    writeJSON(path.join(stage,'deployment.json'),{company:'ATLED Engergy',synthetic:true,runs:selected.map(s=>({id:s.manifest.run_id,path:s.slug,data_hash:s.manifest.data_hash})),files:filesUnder(stage).length});
    fs.rmSync(PAGES,{recursive:true,force:true});fs.renameSync(stage,PAGES);
    return PAGES;
  } finally {fs.rmSync(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(buildPages());
