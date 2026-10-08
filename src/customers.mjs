export const CUSTOMERS = {
  ATL: {name:'Atlas Semiconductor',slug:'atlas',layout:'resilience',headline:'供電韌性與需量管理',kpis:['契約容量裕度','十五分鐘需量峰值','儲能放電','模型節省'],plans:[['building','grid','datacenter','storage','solar','charging'],['building','grid','solar'],['grid','datacenter','storage'],['building','grid','storage','charging']]},
  MER: {name:'Meridian Logistics',slug:'meridian',layout:'mobility',headline:'車隊補能與場站營運',kpis:['充電埠可用率','充電量','太陽能自用率','模型電費'],plans:[['building','grid','solar','charging'],['building','grid','solar','storage','charging'],['building','grid','charging'],['building','grid','solar','storage']]},
  HEL: {name:'Helios Cloud',slug:'helios',layout:'compute',headline:'算力能效與碳管理',kpis:['能源加權 PUE','IT 負載','電網排放','冷卻耗能'],plans:[['grid','datacenter','solar','storage'],['grid','datacenter','storage'],['building','grid','datacenter','storage','solar','charging'],['grid','datacenter','solar','storage','charging']]}
};
export const DOMAIN_LABELS={building:'智慧樓宇',grid:'智慧電網',datacenter:'資料中心',storage:'儲能',solar:'太陽能',charging:'充電樁'};
