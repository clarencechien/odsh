import { Dashboard, Filters, Select, Row, Stat, LineChart, BarChart, Table, Text, Section } from '@open-dashboard/core'
import Prose from '../../charts/prose'
export const meta = { title: 'ATLED Engergy | 能源營運總覽', description: 'Integrated energy operations · 合成資料示範', theme: 'atled' }
export default function Energy() { return <Dashboard>
  <Filters><Select name="site" query="sites" label="客戶 / 站點" allLabel="全部站點（內部）"/><Select name="window" query="windows" label="報告週期" default="current" allowAll={false}/></Filters>
  <Row><Prose title="ATLED ENGERGY / OPERATIONS INTELLIGENCE" query="kpis" text="{{period_start}} 至 {{period_end}} · 整合 {{site_count:integer}} 座站點。從發電、儲能到終端負載，建立可追溯的能源營運視圖。" span={8}/><Text title="資料聲明" span={4}>合成資料驗證環境・所有客戶與事件均為虛構。對外分享請使用獨立客戶 run。</Text></Row>
  <Row><Stat title="用電量 · kWh" query="kpis" column="load_kwh" format="integer" span={3}/><Stat title="模型電費 · TWD" query="kpis" column="cost_twd" format="integer" span={3}/><Stat title="光儲模型節省 · TWD" query="kpis" column="savings_twd" format="integer" span={3}/><Stat title="現地太陽能占比" query="kpis" column="onsite_solar_ratio" format="percent" span={3}/></Row>
  <Section title="ENERGY / 能源供需">
  <Row height={300}><LineChart title="負載與電网 · kW" query="profile" x="hour" y={['load_kw','grid_kw','solar_kw']} span={8}/><BarChart title="终端用電結構 · kWh" query="sectors" x="sector" y="energy_kwh" span={4}/></Row>
  <Row height={260}><LineChart title="每日能源 · kWh" query="daily" x="day" y={['load_kwh','solar_kwh','import_kwh','discharge_kwh']} span={8}/><Prose title="週比較" query="comparison" text="相較前週，用電變動 {{load_change:percent}}，模型電費變動 {{cost_change:percent}}。請搭配氣象、營運排程與事件判讀，勿將相關性視為節能因果。" span={4}/></Row>
  </Section>
  <Section title="ASSETS / 設備與服務">
  <Row><Stat title="資料中心 · 加權 PUE" query="kpis" column="pue" format="number" span={3}/><Stat title="充電樁 · 時間加權可用率" query="kpis" column="charger_availability" format="percent" span={3}/><Stat title="電網購電排放 · tCO₂e" query="kpis" column="carbon_tonnes" format="number" span={3}/><Stat title="儲能放電 · kWh" query="storage" column="discharge_kwh" format="integer" span={3}/></Row>
  <Row><Table title="站點績效" query="ranking" columns={[{key:'site_id',label:'站點'},{key:'tenant',label:'客戶'},{key:'load_kwh',label:'用電 kWh',format:'integer',bar:true},{key:'savings_twd',label:'模型節省 TWD',format:'integer'},{key:'peak_kw',label:'峰值 kW',format:'integer'},{key:'pue',label:'PUE',format:'number'}]} span={12}/></Row>
  <Row><Table title="異常與行動建議" query="events" columns={[{key:'site_id',label:'站點'},{key:'severity',label:'等級'},{key:'start_ts',label:'發生時間'},{key:'title',label:'事件'},{key:'action',label:'建議處置'}]} span={12}/></Row>
  <Row><Text title="指標口徑">模型節省使用相同負載、無光儲的反事實電費；不含需量費、設備投資與電池劣化。排放仅計電網購電；售電不抵減排放。本 dashboard 的篩選来自預先計算快照，開發模式才會重新執行 DuckDB SQL。</Text></Row>
  </Section>
</Dashboard> }
