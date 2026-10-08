import { Dashboard, Filters, Select, Row, Stat, LineChart, Table, Text, Section } from '@open-dashboard/core'
import Prose from '../../charts/prose'
export const meta = { title: 'ATLED Engergy | 客戶能源週報', description: 'Weekly energy review · 合成資料', theme: 'imitator' }
export default function Weekly() { return <Dashboard>
  <Filters><Select name="site" query="sites" label="客戶 / 站點" allLabel="本報告全部站點"/><Select name="window" query="windows" label="週期" default="current" allowAll={false}/></Filters>
  <Row><Prose title="ATLED ENGERGY / WEEKLY ENERGY REVIEW" query="kpis" text="{{period_start}} — {{period_end}}。本週整合 {{site_count:integer}} 座站點，終端用電 {{load_kwh:integer}} kWh，現地太陽能占負載 {{onsite_solar_ratio:percent}}。" span={12}/></Row>
  <Row><Stat title="用電量 · kWh" query="kpis" column="load_kwh" format="integer" span={4}/><Stat title="光儲模型節省 · TWD" query="kpis" column="savings_twd" format="integer" span={4}/><Stat title="購電排放 · tCO₂e" query="kpis" column="carbon_tonnes" format="number" span={4}/></Row>
  <Section title="營運摘要">
  <Row><Prose title="成本與效率" query="kpis" text="模型電費為 {{cost_twd:integer}} TWD，其中儲能相對無儲能情境的電費差額為 {{storage_savings_twd:integer}} TWD。資料中心能源加權 PUE 為 {{pue:number}}，充電埠時間加權可用率為 {{charger_availability:percent}}。" span={8}/><Prose title="週變動" query="comparison" text="用電較前週變動 {{load_change:percent}}；模型電費變動 {{cost_change:percent}}。" span={4}/></Row>
  <Row height={310}><LineChart title="本週能源組合 · kWh" query="daily" x="day" y={['load_kwh','solar_kwh','import_kwh','discharge_kwh']} span={12}/></Row>
  </Section>
  <Section title="站點追蹤與服務建議">
  <Row><Table title="客戶站點週績效" query="ranking" columns={[{key:'site_id',label:'站點'},{key:'site_name',label:'場域'},{key:'load_kwh',label:'用電 kWh',format:'integer'},{key:'savings_twd',label:'模型節省 TWD',format:'integer'},{key:'peak_kw',label:'峰值 kW',format:'integer'}]} span={12}/></Row>
  <Row><Table title="異常、已知原因與建議" query="events" columns={[{key:'site_id',label:'站點'},{key:'title',label:'事件'},{key:'action',label:'建議'}]} span={12}/></Row>
  <Row><Prose title="資料品質" query="kpis" text="本期估補區間占 {{estimated_ratio:percent}}。所有資料均為可重現的合成資料，事件原因為預先植入的模擬條件；本報告不代表真實客戶效益。" span={6}/><Text title="方法與下一步" span={6}>電價、售電抵扣與排放係數皆為示範假設。先覆核事件站點的冷卻設備、逆變器及充電閘道，再以真實電表與帳單校準模型。不得將模型差額視為保證節省或正式碳盤查。</Text></Row>
  </Section>
</Dashboard> }
