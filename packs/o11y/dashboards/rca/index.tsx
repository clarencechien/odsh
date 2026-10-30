import {Dashboard,Filters,Select,Row,Stat,LineChart,Table,Text,Section} from '@open-dashboard/core'
import Prose from '../../charts/prose'
export const meta={title:'Request reliability / 事件觀測報告',description:'來源與合成標記見交付 manifest；觀測異常，不自動推論根因。',locale:'zh-TW'}
export default function RCA(){return <Dashboard>
 <Filters><Select name="service" query="services" label="Service" allLabel="所有服務"/></Filters>
 <Row><Prose title="資料來源" query="provenance" text="{{label:text}}" span={12}/></Row>
 <Row><Prose title="觀測範圍" query="overview" text="{{start_ts:text}} — {{end_ts:text}}，共 {{requests:integer}} 筆請求。請先核對資料來源，再解讀異常。" span={12}/></Row>
 <Row><Stat title="請求錯誤率" query="overview" column="error_rate" format="percent" span={4}/><Stat title="尾端延遲 · ms" query="overview" column="p99_ms" format="decimal" span={4}/><Stat title="觀測區間每秒請求" query="overview" column="rps" format="decimal" span={4}/></Row>
 <Section title="異常時段與影響範圍"><Row height={300}><LineChart title="服務錯誤率" query="hourly" x="hour" y="error_rate" series="service" format="percent" span={6}/><LineChart title="尾端延遲變化" query="hourly" x="hour" y="p99_ms" series="service" span={6}/></Row></Section>
 <Section title="端點證據"><Table title="錯誤率與分母" query="endpoints" columns={[{key:'service',label:'服務'},{key:'path',label:'端點'},{key:'requests',label:'請求數'},{key:'error_rate',label:'錯誤率',format:'percent'},{key:'p99_ms',label:'延遲 · ms'}]} height={380}/></Section>
 <Text title="覆核方式">5xx 是伺服器錯誤分類。請將異常時段與部署、追蹤、依賴服務及資源事件交叉核對；時間上的共現不等於根因。完整資料的百分位須回到原始請求重算。</Text>
 </Dashboard>}
