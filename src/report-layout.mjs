// A fixed executive brief: no operational filters, time-series wall or live-state widgets.
export function reportSource(customer){
 const name=customer?.name||'ATLED Engergy',kind=customer?.layout||'portfolio';
 const focus=kind==='compute'?'算力擴張與冷卻效率':kind==='mobility'?'補能服務與場站成本':kind==='resilience'?'需量管理與樓宇排程':'整合能源營運';
 const verdict=kind==='compute'?'<Prose title="能效觀察" query="report_story" text="{{cooling_verdict:text}}。本週 PUE {{pue_current:decimal}}，前週 {{pue_previous:decimal}}；冷卻及非 IT 耗能 {{cooling_current:integer}} kWh。事件與工作負載應分開覆核。" span={12} height={130}/>'
 :kind==='mobility'?'<Prose title="服務觀察" query="report_story" text="{{charging_verdict:text}}。本週充電量 {{ev_current:integer}} kWh，前週 {{ev_previous:integer}} kWh；本週可用率 {{availability_current:percent}}。服務缺口應對照設備事件，而非僅以補能總量判斷。" span={12} height={130}/>'
 :'<Prose title="需量觀察" query="specialized" text="最緊案場的契約裕度為 {{min_headroom_kw:integer}} kW，本週最高單站需量 {{max_site_peak_kw:integer}} kW。需量峰值與非營業負載應分開處理，不能把跨站非同時峰值相加作為契約判斷。" span={12} height={130}/>';
 return `import {Dashboard,Row,Stat,Section,Text,Waterfall,Dumbbell,Table} from '@open-dashboard/core'
 import Prose from '../../charts/prose'
 export const meta={title:${JSON.stringify(name+' / 能源決策週報')},description:${JSON.stringify('WEEKLY DECISION BRIEF · '+focus+' · 固定週期 / 可列印')},theme:'imitator',locale:'zh-TW'}
 export default function Weekly(){return <Dashboard>
 <Row><Prose title="ENERGY LOOP / 本期範圍" query="kpis" text="{{period_start:text}} — {{period_end:text}}。本期涵蓋 {{site_count:integer}} 座案場；所有數據皆為合成示範，以下結論引用同一份凍結快照。" height={115} span={12}/></Row>
 <Section title="本週結論 / What changed">
 <Row><Prose title="管理摘要" query="report_story" text="{{cost_verdict:text}}。本週用電較前週變動 {{load_change:percent}}，模型電費變動 {{cost_change:percent}}。本報告先說明觀測差異，再檢視光儲模型效益與待覆核的事件。" height={145} span={12}/></Row>
 <Row>${verdict}</Row>
 <Row><Stat title="本週模型電費 · TWD" query="weekly_stats" column="cost_current" compare="cost_previous" compareLabel="前週" format="integer" invert span={4}/><Stat title="光儲模型差額 · TWD" query="kpis" column="savings_twd" format="integer" span={4}/><Stat title="本週記錄事件" query="event_summary" column="event_count" format="integer" span={4}/></Row>
 </Section>
 <Section title="效益拆解 / Why it matters">
 <Row height={290}><Waterfall title="模型帳單如何形成 · TWD" query="cost_bridge" label="step" value="value" type="type" format="integer" span={12}/></Row>
 <Row><Prose title="模型解讀" query="kpis" text="相同負載的無光儲情境，與本週模型帳單相差 {{savings_twd:integer}} TWD；其中儲能相對保留光電、移除儲能的情境差額為 {{storage_savings_twd:integer}} TWD。這是反事實模型比較，不等同前後週的實際節費。" height={140} span={12}/></Row>
 <Row height={190}><Dumbbell title="各案場帳單 / 前週 → 本週 · TWD" query="week_sites" label="site_id" from="previous" to="current" labels={{from:'前週',to:'本週'}} format="integer" span={12}/></Row>
 </Section>
 <Section title="風險與行動 / What happens next">
 <Row><Prose title="事件覆核範圍" query="event_summary" text="本週共有 {{event_count:integer}} 筆事件，涉及 {{affected_sites:integer}} 座案場，記錄時段合計 {{recorded_hours:decimal}} 小時。這是事件時段加總，不代表整座案場停機時間。請以下列清單覆核處置與成效。" height={135} span={12}/></Row>
 <Row><Table title="下一週行動清單" query="actions" columns={[{key:'priority',label:'優先順序'},{key:'site_id',label:'案場'},{key:'title',label:'已知事件'},{key:'action',label:'責任與動作'},{key:'checkpoint',label:'覆核時間'}]} height={300} span={12}/></Row>
 </Section>
 <Section title="方法與資料品質 / Evidence notes">
 <Row><Prose title="資料完整性" query="kpis" text="估補區間占 {{estimated_ratio:percent}}。本期用電 {{load_kwh:integer}} kWh，購電排放 {{carbon_tonnes:decimal}} tCO₂e；排放採示範係數，未計生命週期與抵換。" height={105} span={12}/></Row>
 <Text title="假設與限制">光儲差額使用同負載模型，電價含購電與售電抵扣，不含需量費、稅費、投資或電池劣化。事件原因為模擬植入條件；前後週變化同時受到負載與天候影響，不能直接視為因果或保證效益。這份週報固定報告範圍；設備探索與案場切換請使用營運 Dashboard。</Text>
 </Section></Dashboard>}`;
}
