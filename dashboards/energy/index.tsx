import {Dashboard,Filters,Select,Row,Stat,Section,Sankey,Heatmap,BulletChart,Table,Text} from '@open-dashboard/core'
import Prose from '../../charts/prose'
import IntegrationMap from '../../charts/integration-map'
export const meta={title:'ATLED Engergy / 全域能源控制台',description:'ENERGY LOOP · 跨產業方案組合 / 合成資料',theme:'atled',locale:'zh-TW'}
export default function Energy(){return <Dashboard>
<Filters><Select name="site" query="sites" label="客戶 / 案場" allLabel="所有示範案場"/><Select name="window" query="windows" label="觀測週期" default="current" allowAll={false}/></Filters>
<Row><Prose title="PORTFOLIO / 全域快照" query="kpis" text="{{period_start:text}} — {{period_end:text}} · {{site_count:integer}} 座案場。從電網到負載，觀察同一套資料模型如何支援不同產業的能源决策。" height={90} span={12}/></Row>
<Row><Stat title="用電量 · kWh" query="weekly_stats" column="load_current" compare="load_previous" compareLabel="前週" format="integer" span={3}/><Stat title="模型電費 · TWD" query="weekly_stats" column="cost_current" compare="cost_previous" compareLabel="前週" format="integer" invert span={3}/><Stat title="光儲模型差額 · TWD" query="kpis" column="savings_twd" format="integer" span={3}/><Stat title="記錄事件" query="event_summary" column="event_count" format="integer" span={3}/></Row>
<Section title="ENERGY LOOP / 能源協同"><Row height={330}><Sankey title="供給 → 匯流排 → 去向 · kWh" query="flow" source="source" target="target" value="energy_kwh" format="integer" span={8}/><BulletChart title="案場需量與契約容量 · kW" query="capacity" label="site_id" value="actual" target="target" max="scale" span={4} format="integer"/></Row></Section>
<Row height={235}><Heatmap title="樓宇負載時段 · kW" query="building_heat" x="hour" y="day" value="power_kw" format="integer" span={6}/><Heatmap title="車隊補能時段 · kW" query="charging_heat" x="hour" y="day" value="power_kw" format="integer" span={6}/></Row>
<Section title="INTEGRATION / 多系統接口"><IntegrationMap title="整合子系統與接口規劃" query="connectors" label="label" protocol="protocol" count="subsystem_count" height={155}/></Section>
<Row><Table title="跨案場事件紀錄" query="events" columns={[{key:'site_id',label:'案場'},{key:'title',label:'事件'},{key:'action',label:'建議'}]} height={230}/></Row>
<Text title="探索方式">此頁為跨客戶的合成資料展示。每家客戶另有不同的控制台：工廠看供需與韌性，物流看補能熱圖，機房看冷卻診斷。週報則固定區間，呈現結論、模型帳單橋接與行動清單。</Text>
</Dashboard>}
