import { defineChart } from '@open-dashboard/core'
export default defineChart<{label:string,protocol:string,count:string}>({
  name:'IntegrationMap',columns:['label','protocol','count'],height:145,
  render:({rows,props,format})=><div className="loop-integrations">{rows.map((row,i)=><div className="loop-integration" key={i}>
    <span className="loop-node"/><strong>{String(row[props.label])}</strong><small>{String(row[props.protocol])}</small>
    <span className="loop-integration-count">{format(row[props.count],'integer')} 個子系統 · 接口模擬</span>
  </div>)}</div>
})
