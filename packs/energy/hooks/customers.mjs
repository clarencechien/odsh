export const CUSTOMERS = {
  ATL: {name:'Atlas Semiconductor',slug:'atlas',layout:'resilience',headline:'工廠韌性與樓宇節能',kpis:['契約容量裕度','尖峰削減','電池 SOC','樓宇負載'],
    plans:[['building','grid','datacenter','storage','solar'],['building','grid','solar']],
    names:['新竹・製程微電網','台中・智慧研發樓'],archetypes:['MICROGRID / 工廠微電網','SMART BUILDING / 智慧樓宇'],
    goals:['光儲協同，壓低尖峰並保留儲能備援','串接樓控與屋頂光電，辨識非營業用電']},
  MER: {name:'Meridian Logistics',slug:'meridian',layout:'mobility',headline:'車隊補能與場站調度',kpis:['充電埠可用率','補能時段','光電自用率','需量控制'],
    plans:[['building','grid','solar','storage','charging'],['building','grid','storage','charging']],
    names:['桃園・電動車隊基地','高雄・冷鏈補能站'],archetypes:['FLEET HUB / 車隊基地','COLD CHAIN / 冷鏈補能'],
    goals:['讓夜間車隊補能與白天光儲調度相容','維持冷鏈負載，同時追蹤充電服務中斷']},
  HEL: {name:'Helios Cloud',slug:'helios',layout:'compute',headline:'算力能效與綠電協同',kpis:['能源加權 PUE','冷卻耗能','IT 負载','電網排放'],
    plans:[['grid','datacenter','storage'],['building','grid','datacenter','solar','storage']],
    names:['新竹・AI 算力中心','台中・綠能邊緣機房'],archetypes:['AI COMPUTE / 高密度算力','GREEN EDGE / 綠能邊緣'],
    goals:['辨識訓練工作負載與冷卻劣化的不同影響','整合屋頂光電、儲能與高效率機房']}
};
export const DOMAIN_LABELS={building:'智慧樓宇',grid:'智慧電網',datacenter:'資料中心',storage:'儲能',solar:'太陽能',charging:'充電樁'};
