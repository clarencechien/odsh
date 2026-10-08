import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { runPath, writeJSON, sqlString } from './common.mjs';
import { CUSTOMERS, DOMAIN_LABELS } from './customers.mjs';
const tenants = ['Atlas Semiconductor', 'Meridian Logistics', 'Helios Cloud'];
const cities = ['新竹', '台中', '高雄', '桃園'];
const rand = seed => { let x=seed>>>0; return () => { x=(Math.imul(x,1664525)+1013904223)>>>0; return x/4294967296; }; };
const round = n => Math.round(n*1e6)/1e6;
export async function generate(id, {tenant, days=92, seed=42}={}) {
  if (!Number.isInteger(days)||days<14||days>366) throw Error('days must be 14..366');
  if (tenant && !tenants.includes(tenant)) throw Error(`Unknown tenant; use ${tenants.join(', ')}`);
  const dir=runPath(id); if(fs.existsSync(dir)) throw Error('Run exists; choose a new run_id to preserve the snapshot');
  fs.mkdirSync(path.join(dir,'input'),{recursive:true});
  const rng=rand(seed), sites=[], assets=[], events=[];
  for(let t=0;t<3;t++) for(let s=0;s<CUSTOMERS[['ATL','MER','HEL'][t]].plans.length;s++) {
    const n=t*4+s; const site_id=`${['ATL','MER','HEL'][t]}-${s+1}`;
    const customer=CUSTOMERS[site_id.split('-')[0]], domains=customer.plans[s];
    sites.push({domains:domains.join(','),solution:domains.map(d=>DOMAIN_LABELS[d]).join(' + '),layout:customer.layout,site_id,tenant:tenants[t],site_name:customer.names[s],archetype:customer.archetypes[s],goal:customer.goals[s],timezone:'Asia/Taipei',solar_capacity_kw:domains.includes('solar')?900+s*180:0,battery_capacity_kwh:domains.includes('storage')?2000+s*400:0,battery_power_kw:domains.includes('storage')?500+s*100:0,charger_ports:domains.includes('charging')?20+s*4:0,contract_kw:t===0?(s===0?1200:600):t===1?(s===0?850:950):(s===0?2400:1300),building_area_m2:24000+s*4000});
    for(const domain of domains) assets.push({asset_id:`${site_id}-${domain}`,site_id,tenant:tenants[t],domain,model:`AE-${domain.toUpperCase()}`,commissioned:'2024-01-01',synthetic:true});
  }
  const start=new Date('2026-07-01T00:00:00Z'), end=new Date(+start+days*86400000);
  const eventDay=days-5;
  const incidents=[['HEL-1','datacenter','冷卻系統效率劣化','設備團隊：清理濾網並覆核冷凍機負載分配',eventDay,8,36,'high'],['MER-1','solar','逆變器高溫降額','維運團隊：覆核散熱風扇與直流串列',days-4,9,7,'medium'],['MER-2','charging','充電閘道間歇中斷','充電維運：切換備援網路，覆核補能排程',days-3,0,36,'high'],['ATL-1','grid','尖峰需量反應','能源經理：確認儲能放電與製程排程一致',days-2,16,2,'info'],['ATL-2','building','樓宇非營業時段負載偏高','樓控團隊：校正空調關機時序與加班區域',days-6,20,8,'medium']];
  for(let i=0;i<incidents.length;i++){ const [site_id,domain,title,action,d,h,duration,severity]=incidents[i]; const site=sites.find(s=>s.site_id===site_id); const ts=new Date(+start+d*86400000+h*3600000); events.push({event_id:`EVT-${i+1}`,site_id,tenant:site.tenant,domain,title,action,severity,start_ts:ts.toISOString().slice(0,19),end_ts:new Date(+ts+duration*3600000).toISOString().slice(0,19),status:'resolved',synthetic:true}); }
  const selected=sites.filter(s=>!tenant||s.tenant===tenant);
  const meterFile=path.join(dir,'meters.ndjson'), assetFile=path.join(dir,'telemetry.ndjson');
  const mf=fs.openSync(meterFile,'w'), af=fs.openSync(assetFile,'w');
  // UTC timestamps encode local wall time for reproducible DuckDB TIMESTAMPs; documented timezone Asia/Taipei.
  for(const site of sites){
    const include=!tenant||site.tenant===tenant, t=tenants.indexOf(site.tenant), s=Number(site.site_id.split('-')[1])-1;
    let soc=0.5*site.battery_capacity_kwh, meterBatch='', assetBatch='';
    for(let i=0;i<days*96;i++) {
      const day=Math.floor(i/96), hour=(i%96)/4, ts=new Date(+start+i*900000), dow=ts.getUTCDay();
      const occupied=dow!==0&&dow!==6&&hour>=7&&hour<20;
      const cloud=0.78+0.2*Math.sin(day*1.73)+0.04*(rng()-.5);
      const temperature=28+5*Math.sin((hour-8)*Math.PI/12)+2*Math.sin(day/8)+(rng()-.5);
      const irradiance=Math.max(0,Math.sin((hour-6)*Math.PI/12))*Math.max(.12,cloud);
      const coolingIncident=site.site_id==='HEL-1'&&i>=eventDay*96+32&&i<(eventDay*96+32+144);
      const solarIncident=site.site_id==='MER-1'&&day===days-4&&hour>=9&&hour<16;
      const evIncident=site.site_id==='MER-2'&&i>=(days-3)*96&&i<(days-3)*96+144;
      const afterHours=site.site_id==='ATL-2'&&i>=(days-6)*96+80&&i<(days-6)*96+112;
      const currentWeek=day>=days-7;
      const dr=site.site_id==='ATL-1'&&day===days-2&&hour>=16&&hour<18;
      const building=(site.domains.includes('building')?1:0)*(occupied?320:afterHours?290:110)*(t===1&&s===1?1.7:1+s*.15)*(currentWeek&&t===0&&s===0?1.16:1)*(1+Math.max(0,temperature-26)*.025)*(0.97+rng()*.06);
      const it=(site.domains.includes('datacenter')?1:0)*(t===2?(s===0?1120:480):t===0?470:170)*(currentWeek&&t===2&&s===0?1.24:1)*(1+s*.12)*(0.93+.09*Math.sin(hour/24*Math.PI)+rng()*.04);
      const pue=(t===2&&s===1?1.13:1.24)+Math.max(0,temperature-24)*(t===2&&s===1?.005:.008)+(coolingIncident?.33:0);
      const dc=it*pue;
      const ports=evIncident?site.charger_ports-8:site.charger_ports;
      const ev=Math.max(0,ports*11*(t===1?(hour<7?.82:hour>=17?.58:.20):(occupied?.65:.12))*(currentWeek&&t===1?1.20:1)*(0.7+0.3*Math.sin(hour/24*Math.PI))*(.8+rng()*.4));
      const solar=site.solar_capacity_kw*irradiance*.88*(solarIncident?.4:1);
      const peak=hour>=16&&hour<21&&dow!==0&&dow!==6;
      const rate=peak?6.8:hour<7?2.1:4.2;
      const load=building+dc+ev, lower=site.battery_capacity_kwh*.15, upper=site.battery_capacity_kwh*.9, eff=Math.sqrt(.9);
      let charge=0, discharge=0;
      if(hour<6 || solar>load) charge=Math.max(0,Math.min(site.battery_power_kw,(upper-soc)/(.25*eff),hour<6?site.battery_power_kw*.65:solar-load));
      if(peak||dr) discharge=Math.max(0,Math.min(site.battery_power_kw,(soc-lower)*eff/.25,load-solar));
      const soc_start=soc; soc+=charge*.25*eff-discharge*.25/eff;
      const net=load+charge-solar-discharge, grid_import=Math.max(0,net), grid_export=Math.max(0,-net);
      const no_storage=Math.max(0,load-solar), no_storage_export=Math.max(0,solar-load);
      const cost=(grid_import*rate-grid_export*2.0)*.25;
      const quality=rng()<.003?'estimated':'measured';
      const row={ts:ts.toISOString().slice(0,19),site_id:site.site_id,tenant:site.tenant,site_name:site.site_name,temperature_c:round(temperature),irradiance_w_m2:round(irradiance*1000),building_kw:round(building),it_kw:round(it),datacenter_kw:round(dc),ev_kw:round(ev),load_kw:round(load),solar_kw:round(solar),battery_charge_kw:round(charge),battery_discharge_kw:round(discharge),soc_start_kwh:round(soc_start),soc_kwh:round(soc),grid_import_kw:round(grid_import),grid_export_kw:round(grid_export),tariff_twd_kwh:rate,energy_cost_twd:round(cost),baseline_cost_twd:round(load*.25*rate),storage_baseline_cost_twd:round((no_storage*rate-no_storage_export*2)*.25),grid_co2_kg:round(grid_import*.25*.474),available_ports:ports,total_ports:site.charger_ports,quality,battery_capacity_kwh:site.battery_capacity_kwh,contract_kw:site.contract_kw,synthetic:true};
      if(include){ meterBatch+=JSON.stringify(row)+'\n';
        for(const [domain,kw,state] of [['building',building,occupied?'occupied':'setback'],['grid',net,dr?'demand_response':'normal'],['datacenter',dc,coolingIncident?'degraded':'normal'],['storage',discharge-charge,discharge>0?'discharging':charge>0?'charging':'idle'],['solar',solar,solarIncident?'derated':'normal'],['charging',ev,evIncident?'partial_outage':'normal']]) if(site.domains.split(',').includes(domain)) assetBatch+=JSON.stringify({ts:row.ts,asset_id:`${site.site_id}-${domain}`,site_id:site.site_id,tenant:site.tenant,domain,power_kw:round(kw),state,quality,synthetic:true})+'\n';
        if(i%96===95){fs.writeSync(mf,meterBatch); fs.writeSync(af,assetBatch);meterBatch='';assetBatch='';}
      }
    }
  }
  fs.closeSync(mf);fs.closeSync(af);
  const instance=await DuckDBInstance.create(':memory:'); const db=await instance.connect();
  try {
    for(const [name,data] of [['sites',selected],['assets',assets.filter(a=>!tenant||a.tenant===tenant)],['events',events.filter(e=>!tenant||e.tenant===tenant)]]) fs.writeFileSync(path.join(dir,`${name}.ndjson`),data.map(r=>JSON.stringify(r)).join('\n')+'\n');
    for(const [table,source] of [['meters','meters'],['telemetry','telemetry'],['sites','sites'],['assets','assets'],['events','events']]) {
      await db.run(`COPY (SELECT * FROM read_json_auto(${sqlString(path.join(dir,source+'.ndjson'))}, timestampformat='%Y-%m-%dT%H:%M:%S')) TO ${sqlString(path.join(dir,'input',table+'.parquet'))} (FORMAT PARQUET, COMPRESSION ZSTD)`);
      fs.unlinkSync(path.join(dir,source+'.ndjson'));
    }
  } finally {db.closeSync();instance.closeSync();}
  writeJSON(path.join(dir,'generation.json'),{generator:'atled-energy-loop-v2',seed,days,interval_minutes:15,timezone:'Asia/Taipei',timestamp_semantics:'local wall time; not UTC instants',start:'2026-07-01',end_exclusive:end.toISOString().slice(0,10),tenant:tenant||null,scope:tenant?'customer':'internal-portfolio',synthetic:true,site_profiles:selected,sites:selected.length,meter_rows:selected.length*days*96,telemetry_rows:selected.reduce((n,s)=>n+s.domains.split(',').length,0)*days*96,events:events.filter(e=>!tenant||e.tenant===tenant),limitations:['Synthetic data; not measured customer outcomes','TOU rates, export credit and emissions factor are illustrative','No demand charge, taxes, capex, battery degradation or guaranteed savings','Estimated intervals are explicitly flagged; no missing intervals in this fixture']});
  return {dir,sites:selected.length,meter_rows:selected.length*days*96,telemetry_rows:selected.reduce((n,s)=>n+s.domains.split(',').length,0)*days*96};
}
