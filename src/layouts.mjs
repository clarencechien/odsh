import fs from 'node:fs';
import path from 'node:path';
import { CUSTOMERS, DOMAIN_LABELS } from './customers.mjs';
import { sqlString, writeJSON } from './common.mjs';
const imports=`import { Dashboard, Filters, Select, Row, Stat, LineChart, BarChart, Table, Text, Section } from '@open-dashboard/core'\nimport Prose from '../../charts/prose'\n`;
const additional=`
-- name: solution
-- description: 案場整合範圍；未安裝的設備不應呈現為故障或零效率
-- metric: dimension, text
SELECT string_agg(DISTINCT solution, ' / ' ORDER BY solution) AS solution, count(*) AS sites FROM sites WHERE (:site IS NULL OR site_id=:site);

-- name: specialized
-- description: 需量裕度以各站契約容量減去觀測十五分鐘峰值；冷卻為機房總耗能减IT；自用率分母為光電發電量
-- metric: mixed, number
WITH observations AS (
 SELECT m.* FROM interval_energy m CROSS JOIN windows w
 WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts AND (:site IS NULL OR m.site_id=:site)
), peaks AS (SELECT site_id,max(grid_import_kw) AS peak_kw FROM observations GROUP BY 1)
SELECT sum(ev_kw)*.25 AS ev_kwh, avg(it_kw) AS avg_it_kw,
 sum(datacenter_kw-it_kw)*.25 AS cooling_kwh,
 (sum(solar_kw)-sum(grid_export_kw))/nullif(sum(solar_kw),0) AS solar_self_use,
 (SELECT min(s.contract_kw-p.peak_kw) FROM peaks p JOIN sites s USING(site_id)) AS min_headroom_kw,
 (SELECT max(peak_kw) FROM peaks) AS max_site_peak_kw,
 sum(battery_discharge_kw)*.25 AS storage_kwh
FROM observations;
`;
function scopeSQL(sql,tenant,site){
  if(tenant)for(const table of ['interval_energy','sites','events'])sql=sql.replace(new RegExp(`\\bFROM ${table}\\b`,'g'),`FROM (SELECT * FROM ${table} WHERE tenant=${sqlString(tenant)})`);
  if(site)sql=sql.replaceAll(':site',sqlString(site.site_id));
  return sql;
}
const stat=(title,column,query='specialized',format='integer',span=3)=>`<Stat title=${JSON.stringify(title)} query="${query}" column="${column}" format="${format}" span={${span}}/>`;
export function layoutSource(customer,site){
  const domains=site?site.domains.split(','):[...new Set(customer.plans.flat())];
  const has=d=>domains.includes(d),slug=site?`site-${site.site_id.toLowerCase()}`:customer.slug;
  const title=`ATLED Engergy | ${site?site.site_id+' '+site.site_name:customer.name} · ${customer.headline}`;
  const filter=site?'':`<Select name="site" query="sites" label="案場" allLabel="${customer.name} 全部案場"/>`;
  const plan=site?`<Text title="整合方案" span={12}>${site.solution}。此頁僅包含本案場資料；未安裝設備不列入績效。</Text>`:`<Prose title="本客戶整合方案" query="solution" text="共 {{sites:integer}} 座案場。方案組合：{{solution:text}}。" span={12}/>`;
  const storage=has('storage')?stat('儲能放電 · kWh','storage_kwh'):stat('模型電費 · TWD','cost_twd','kpis');
  let content='';
  if(customer.layout==='resilience')content=`
  <Section title="RESILIENCE / 供電韌性">
    <Row>${stat('最小契約容量裕度 · kW','min_headroom_kw')}${stat('最高單站需量 · kW','max_site_peak_kw')}${storage}${stat('光儲模型節省 · TWD','savings_twd','kpis')}</Row>
    <Row height={340}><LineChart title="需量曲線 · kW" query="profile" x="hour" y={['load_kw','grid_kw']} span={9}/><Prose title="管理摘要" query="comparison" text="用電週變動 {{load_change:percent}}；成本週變動 {{cost_change:percent}}。關注契約裕度與尖峰發生時段。" span={3}/></Row>
  </Section>`;
  if(customer.layout==='mobility')content=`
  <Section title="MOBILITY / 場站補能">
    <Row>${has('charging')?stat('充電埠可用率','charger_availability','kpis','percent',4):stat('太陽能發電 · kWh','solar_kwh','kpis','integer',4)}${has('charging')?stat('充電量 · kWh','ev_kwh','specialized','integer',4):stat('購電量 · kWh','import_kwh','kpis','integer',4)}${stat('模型電費 · TWD','cost_twd','kpis','integer',4)}</Row>
    <Row><Table title="優先處置 / 營運事件" query="events" columns={[{key:'site_id',label:'站點'},{key:'title',label:'事件'},{key:'action',label:'下一步'}]} span={12}/></Row>
    <Row height={290}><BarChart title="場站用電分布 · kWh" query="sectors" x="sector" y="energy_kwh" span={5}/><LineChart title="每日補能與供電 · kWh" query="daily" x="day" y={['load_kwh','import_kwh','solar_kwh']} span={7}/></Row>
  </Section>`;
  if(customer.layout==='compute')content=`
  <Section title="COMPUTE / 算力能效">
    <Row>${stat('能源加權 PUE','pue','kpis','decimal',4)}${stat('冷卻及非 IT 耗能 · kWh','cooling_kwh','specialized','integer',4)}${stat('電網排放 · tCO₂e','carbon_tonnes','kpis','decimal',4)}</Row>
    <Row><Prose title="能效評估" query="kpis" text="資料中心能源加權 PUE 為 {{pue:decimal}}，購電排放 {{carbon_tonnes:decimal}} tCO₂e。需結合 IT 負載與環境溫度判讀冷卻效能；模型未計生命週期排放。" span={8}/>${stat('單站平均 IT 負載 · kW','avg_it_kw','specialized','integer',4)}</Row>
    <Row height={320}><LineChart title="算力園區能源曲線 · kW" query="profile" x="hour" y={['load_kw','grid_kw','solar_kw']} span={12}/></Row>
  </Section>`;
  const solar=has('solar')?`<Section title="SOLAR / 光電利用"><Row>${stat('光電自用率','solar_self_use','specialized','percent',6)}${stat('光電發電 · kWh','solar_kwh','kpis','integer',6)}</Row></Section>`:'';
  const batteries=has('storage')?`<Section title="STORAGE / 儲能管理"><Row><Prose title="充放電紀錄" query="storage" text="本週充電 {{charge_kwh:integer}} kWh，放電 {{discharge_kwh:integer}} kWh。跨週 SOC 不一定相等，因此不將本週輸出輸入比值當作循環效率。" span={12}/></Row></Section>`:'';
  return {slug,title,source:imports+`export const meta = {title:${JSON.stringify(title)},theme:'atled',description:'客戶客製化方案 · 合成資料'}\nexport default function ClientDashboard(){return <Dashboard>
    <Filters>${filter}<Select name="window" query="windows" label="報告週期" default="current" allowAll={false}/></Filters>
    <Row><Prose title=${JSON.stringify(customer.name+' / '+customer.headline)} query="kpis" text="{{period_start}} — {{period_end}} · {{site_count:integer}} 座站點。ATLED Engergy 整合能源服務。" span={12}/></Row>
    <Row>${plan}</Row>${content}${solar}${batteries}
    <Section title="SITE PERFORMANCE / 案場績效"><Row><Table title="案場指標" query="ranking" columns={[{key:'site_id',label:'案場'},{key:'site_name',label:'名稱'},{key:'load_kwh',label:'用電 kWh',format:'integer'},{key:'peak_kw',label:'需量 kW',format:'integer'},{key:'savings_twd',label:'模型節省 TWD',format:'integer'}]} span={12}/></Row></Section>
    ${customer.layout==='mobility'?'':`<Row><Table title="異常追蹤" query="events" columns={[{key:'site_id',label:'站點'},{key:'title',label:'事件'},{key:'action',label:'建議'}]} span={12}/></Row>`}
    <Row><Text title="資料與服務邊界">虛構客戶與合成資料。未安裝設備不適用；模型節省不含需量費、投資及劣化。此快照僅供 MVP 驗證，不代表正式服務承諾。</Text></Row>
  </Dashboard>}`};
}
export function writeLayouts(workspace,generation){
  const base=fs.readFileSync(path.join(workspace,'dashboards/energy/queries.sql'),'utf8')+additional;
  const catalog=[];
  for(const customer of Object.values(CUSTOMERS)){
    if(generation.tenant&&customer.name!==generation.tenant)continue;
    const profiles=generation.site_profiles.filter(s=>s.tenant===customer.name);
    for(const site of [null,...profiles]){
      const layout=layoutSource(customer,site),dir=path.join(workspace,'dashboards',layout.slug);fs.mkdirSync(dir,{recursive:true});
      fs.writeFileSync(path.join(dir,'index.tsx'),layout.source);
      fs.writeFileSync(path.join(dir,'queries.sql'),scopeSQL(base,customer.name,site));
      catalog.push({id:layout.slug,title:layout.title,tenant:customer.name,site:site?.site_id||null,layout:customer.layout,domains:site?.domains.split(',')||[...new Set(customer.plans.flat())],kpis:customer.kpis});
    }
  }
  writeJSON(path.join(workspace,'catalog.json'),catalog);return catalog;
}
