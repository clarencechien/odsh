import fs from 'node:fs';import path from 'node:path';
import {CUSTOMERS} from './customers.mjs';import {sqlString,writeJSON} from './common.mjs';
import {reportSource} from './report-layout.mjs';
const imports=`import { Dashboard, Filters, Select, Row, Stat, LineChart, BarChart, Table, Text, Section, Sankey, Gauge, Heatmap, BulletChart, ScatterChart, StateTimeline, Treemap } from '@open-dashboard/core'
import Prose from '../../charts/prose'
import IntegrationMap from '../../charts/integration-map'
`;
function scopeSQL(sql,tenant,site){
  if(tenant)for(const table of ['interval_energy','sites','events','telemetry','assets'])sql=sql.replace(new RegExp(`\\bFROM ${table}\\b`,'g'),`FROM (SELECT * FROM ${table} WHERE tenant=${sqlString(tenant)}${site?' AND site_id='+sqlString(site.site_id):''})`);
  if(site)sql=sql.replaceAll(':site',sqlString(site.site_id));return sql;
}
const stat=(title,column,query='kpis',format='integer',span=3,extra='')=>`<Stat title=${JSON.stringify(title)} query="${query}" column="${column}" format="${format}" span={${span}} ${extra}/>`;
const flow=(span=8)=>`<Sankey title="Energy Loop / 能源流向 · kWh" query="flow" source="source" target="target" value="energy_kwh" format="integer" span={${span}} description="區間交流電量：購電、光電與放電流向負載、充電及外送；非來源追蹤。"/>`;
const state=(span=12)=>`<StateTimeline title="設備狀態時間軸 / 小時快照" query="asset_states" x="start_ts" end="end_ts" series="lane" state="status" states={{'正常':'good','異常':'critical','需量反應':'warning','充電':'neutral','放電':'good'}} span={${span}}/>`;
export function layoutSource(customer,site){
 const domains=site?site.domains.split(','):[...new Set(customer.plans.flat())];const has=d=>domains.includes(d);
 const slug=site?`site-${site.site_id.toLowerCase()}`:customer.slug;
 const title=`${site?site.site_name:customer.name} / 營運控制台`;
 const filter=site?'':`<Select name="site" query="sites" label="案場" allLabel="全部案場"/>`;
 let content='';
 if(customer.layout==='resilience')content=`
 <Row>${stat('單站最高需量 · kW','max_site_peak_kw','specialized')}${stat('最小契約容量裕度 · kW','min_headroom_kw','specialized')}${stat('模型電費 · TWD','cost_current','weekly_stats','integer',3,'compare="cost_previous" compareLabel="前週" invert spark={{query:"daily",x:"day",y:"import_kwh"}}')}${has('storage')?stat('儲能調度 · kWh','storage_kwh','specialized'):stat('太陽能 · kWh','solar_kwh')}</Row>
 <Section title="ENERGY LOOP / 供需與韌性"><Row height={310}>${flow(8)}<Gauge title="契約容量使用率 / 最緊站點" query="specialized" column="contract_utilization" max={1.2} target={1} format="percent" span={4}/></Row>
 <Row height={240}><BulletChart title="尖峰需量 vs 契約容量 · kW" query="capacity" label="site_id" value="actual" target="target" max="scale" format="integer" span={5}/>${has('storage')?'<LineChart title="儲能 SOC / 容量比" query="soc_profile" x="hour" y="soc_ratio" series="site_id" format="percent" span={7}/>':'<LineChart title="光電與樓宇負載 · kW" query="profile" x="hour" y={["load_kw","solar_kw"]} span={7}/>'}</Row></Section>
 <Section title="BUILDING / 非營業負載與設備"><Row height={245}><Heatmap title="樓宇負載時段熱圖 · kW" query="building_heat" x="hour" y="day" value="power_kw" format="integer" span={8}/><Treemap title="終端耗能分布 · kWh" query="sectors" label="sector" value="energy_kwh" format="integer" span={4}/></Row>${has('storage')?`<Row height={210}>${state()}</Row>`:''}</Section>`;
 if(customer.layout==='mobility')content=`
 <Row>${stat('車隊補能 · kWh','ev_current','weekly_stats','integer',4,'compare="ev_previous" compareLabel="前週"')}${stat('充電埠可用率','charger_availability','kpis','percent',4)}${stat('模型電費 · TWD','cost_current','weekly_stats','integer',4,'compare="cost_previous" compareLabel="前週" invert')}</Row>
 <Section title="MOBILITY / 補能服務"><Row height={270}><Heatmap title="車隊補能時段 · kW" query="charging_heat" x="hour" y="day" value="power_kw" format="integer" span={8}/><Gauge title="充電服務可用率 / 示範目標" query="specialized" column="availability" target={0.99} format="percent" span={4}/></Row>
 <Row height={210}>${state()}</Row></Section>
 <Section title="DISPATCH / 場站能源調度"><Row height={290}>${flow(8)}<BulletChart title="補能需量 vs 契約 · kW" query="capacity" label="site_id" value="actual" target="target" max="scale" format="integer" span={4}/></Row>
 <Row height={215}><LineChart title="儲能充放電後的 SOC" query="soc_profile" x="hour" y="soc_ratio" series="site_id" format="percent" span={12}/></Row></Section>`;
 if(customer.layout==='compute')content=`
 <Row>${stat('能源加權 PUE','pue_current','weekly_stats','decimal',3,'compare="pue_previous" compareLabel="前週" invert')}${stat('冷卻及非 IT · kWh','cooling_current','weekly_stats','integer',3,'compare="cooling_previous" compareLabel="前週" invert')}${stat('平均單站 IT · kW','avg_it_kw','specialized')}${stat('購電排放 · tCO₂e','carbon_tonnes','kpis','decimal')}</Row>
 <Section title="COMPUTE / 冷卻診斷"><Row height={300}><ScatterChart title="溫度 × PUE / 每小時觀測" query="thermal" x="temperature_c" y="pue" series="operating_state" size="it_kw" label="site_id" format="decimal" xFormat="decimal" span={8}/><BulletChart title="PUE vs 設計目標 / 示範" query="pue_sites" label="site_id" value="actual" target="target" max="scale" format="decimal" span={4}/></Row>
 <Row height={235}><BarChart title="IT 與冷卻耗能 · kWh" query="cooling_daily" x="day" y={['it_kwh','cooling_kwh']} span={7}/><LineChart title="備援儲能 SOC" query="soc_profile" x="hour" y="soc_ratio" series="site_id" format="percent" span={5}/></Row></Section>
 <Section title="INFRASTRUCTURE / 算力與能源整合"><Row height={260}>${flow(12)}</Row><Row height={200}>${state()}</Row></Section>`;
 const plan=site?`${site.archetype||'SITE / 案場'} · ${site.goal||site.solution}`:customer.headline;
 return {slug,title,source:imports+`export const meta={title:${JSON.stringify(title)},description:${JSON.stringify(plan+' · 合成資料 / 可切換快照')},theme:'atled',locale:'zh-TW'}
 export default function ClientDashboard(){return <Dashboard>
 <Filters>${filter}<Select name="window" query="windows" label="觀測週期" default="current" allowAll={false}/></Filters>
 <Row><Prose title="OPERATIONS / 資料範圍" query="kpis" text="{{period_start:text}} — {{period_end:text}} · {{site_count:integer}} 座案場。切換快照以探索能源、設備與服務狀態。" height={85} span={12}/></Row>
 ${content}
 <Section title="INTEGRATION / 接口與子系統"><Row><IntegrationMap title="整合方案 / 已安裝子系統" query="connectors" label="label" protocol="protocol" count="subsystem_count" span={12} height={155}/></Row></Section>
 <Row height={190}><Table title="事件紀錄 / 追蹤清單" query="events" columns={[{key:'site_id',label:'案場'},{key:'title',label:'事件'},{key:'action',label:'建議'}]} span={12}/></Row>
 <Text title="使用說明">本頁為合成資料的營運快照。整合接口為模擬規劃，未連接真實設備。指標依已安裝設備計算；未安裝或無分母者不適用。請用週報閱讀固定週期的結論、模型效益與下一步。</Text>
 </Dashboard>}`};
}
export function writeLayouts(workspace,generation){
 const base=fs.readFileSync(path.join(workspace,'dashboards/energy/queries.sql'),'utf8');const catalog=[];
 for(const customer of Object.values(CUSTOMERS)){
  if(generation.tenant&&customer.name!==generation.tenant)continue;
  const profiles=generation.site_profiles.filter(s=>s.tenant===customer.name);
  for(const site of [null,...profiles]){
   const layout=layoutSource(customer,site),dir=path.join(workspace,'dashboards',layout.slug);fs.mkdirSync(dir,{recursive:true});
   fs.writeFileSync(path.join(dir,'index.tsx'),layout.source);fs.writeFileSync(path.join(dir,'queries.sql'),scopeSQL(base,customer.name,site));
   catalog.push({id:layout.slug,title:layout.title,tenant:customer.name,site:site?.site_id||null,layout:customer.layout,domains:site?.domains.split(',')||[...new Set(customer.plans.flat())],kpis:customer.kpis});
  }
 }
 const customer=Object.values(CUSTOMERS).find(c=>c.name===generation.tenant);
 fs.writeFileSync(path.join(workspace,'dashboards/weekly/index.tsx'),reportSource(customer));
 fs.writeFileSync(path.join(workspace,'dashboards/weekly/queries.sql'),base.replaceAll(':site','NULL').replaceAll(':window',"'current'"));
 writeJSON(path.join(workspace,'catalog.json'),catalog);return catalog;
}
