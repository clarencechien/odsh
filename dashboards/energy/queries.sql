-- name: sites
-- description: 客戶及站點篩選；內部總覽包含所有客戶
-- metric: dimension, text
SELECT site_id, tenant || ' / ' || site_name AS label FROM sites ORDER BY site_id;

-- name: windows
-- description: 以輸入資料末日為基準的固定報告區間，與建置時鐘無關
-- metric: dimension, text
SELECT window_id, strftime(start_ts, '%m/%d') || ' – ' || strftime(end_ts - INTERVAL 1 DAY, '%m/%d') AS label FROM windows ORDER BY window_id;

-- name: kpis
-- description: 電量為十五分鐘平均功率乘區間長度；成本含購電與售電抵扣，不含需量費；節省為無光儲模型相對差額
-- metric: mixed, number
SELECT sum(load_kwh) AS load_kwh, sum(import_kwh) AS import_kwh,
sum(solar_kwh) AS solar_kwh, sum(energy_cost_twd) AS cost_twd,
sum(modeled_savings_twd) AS savings_twd, sum(storage_savings_twd) AS storage_savings_twd,
sum(grid_co2_kg)/1000 AS carbon_tonnes,
sum(datacenter_kw)/nullif(sum(it_kw),0) AS pue,
sum(available_ports)::DOUBLE/nullif(sum(total_ports),0) AS charger_availability,
sum(solar_kwh-export_kwh)/nullif(sum(load_kwh),0) AS onsite_solar_ratio,
avg(CASE WHEN quality='estimated' THEN 1.0 ELSE 0 END) AS estimated_ratio,
count(DISTINCT site_id) AS site_count,
strftime(min(w.start_ts), '%Y-%m-%d') AS period_start,
strftime(max(w.end_ts)-INTERVAL 1 DAY, '%Y-%m-%d') AS period_end
FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site);

-- name: daily
-- description: 按日彙總電量；不將功率直接加總為電量
-- metric: kWh, integer
SELECT date_trunc('day',m.ts) AS day, sum(load_kwh) AS load_kwh, sum(solar_kwh) AS solar_kwh, sum(import_kwh) AS import_kwh, sum(discharge_kwh) AS discharge_kwh FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site) GROUP BY 1 ORDER BY 1;

-- name: profile
-- description: 每小時跨站點平均功率；需量峰值另取十五分鐘站點峰值
-- metric: kW, integer
SELECT date_trunc('hour',m.ts) AS hour, sum(load_kw)/4 AS load_kw, sum(grid_import_kw)/4 AS grid_kw, sum(solar_kw)/4 AS solar_kw FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site) GROUP BY 1 ORDER BY 1;

-- name: sectors
-- description: 三種終端用電部門；發電與儲能不重複算作負載
-- metric: kWh, integer
WITH totals AS (SELECT sum(building_kw)*.25 AS building, sum(datacenter_kw)*.25 AS datacenter, sum(ev_kw)*.25 AS charging FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site)) SELECT '智慧樓宇' AS sector, building AS energy_kwh FROM totals UNION ALL SELECT '資料中心', datacenter FROM totals UNION ALL SELECT '充電樁', charging FROM totals;

-- name: ranking
-- description: 站點週用電、模型節省與單站需量峰值；PUE 是能源加權比值
-- metric: mixed, number
SELECT m.site_id, m.tenant, m.site_name, sum(load_kwh) AS load_kwh, sum(modeled_savings_twd) AS savings_twd, max(grid_import_kw) AS peak_kw, sum(datacenter_kw)/nullif(sum(it_kw),0) AS pue, sum(discharge_kwh) AS discharge_kwh FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site) GROUP BY 1,2,3 ORDER BY load_kwh DESC, site_id;

-- name: events
-- description: 固定報告視窗內與選定站點重疊的事件；原因為模擬注入的已知原因
-- metric: event, text
SELECT e.event_id,e.site_id,e.domain,e.severity,e.start_ts,e.title,e.action FROM events e CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current') AND e.start_ts<w.end_ts AND e.end_ts>w.start_ts AND (:site IS NULL OR e.site_id=:site) ORDER BY e.start_ts, e.event_id;

-- name: comparison
-- description: 與同站點緊接前週比較；成本變動率分母為前週實際模型帳單
-- metric: ratio, percent
WITH current AS (SELECT sum(load_kwh) AS load_kwh, sum(energy_cost_twd) AS cost_twd FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site)),
previous AS (SELECT sum(load_kwh) AS load_kwh, sum(energy_cost_twd) AS cost_twd FROM interval_energy m CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts-INTERVAL 7 DAY AND m.ts<w.start_ts AND (:site IS NULL OR m.site_id=:site))
SELECT (c.load_kwh-p.load_kwh)/nullif(p.load_kwh,0) AS load_change, (c.cost_twd-p.cost_twd)/nullif(p.cost_twd,0) AS cost_change FROM current c CROSS JOIN previous p;

-- name: storage
-- description: 儲能輸入輸出電量與觀測區間末平均SOC；非循環效率估計
-- metric: mixed, number
SELECT sum(charge_kwh) AS charge_kwh, sum(discharge_kwh) AS discharge_kwh, min(soc_kwh) AS min_soc_kwh, max(soc_kwh) AS max_soc_kwh FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id = coalesce(:window, 'current') AND m.ts >= w.start_ts AND m.ts < w.end_ts
  AND (:site IS NULL OR m.site_id = :site);


-- name: solution
-- description: 案場整合組合及服務目標
-- metric: dimension, text
SELECT string_agg(DISTINCT solution, ' / ' ORDER BY solution) AS solution, count(*) AS sites FROM sites WHERE (:site IS NULL OR site_id=:site);

-- name: specialized
-- description: 需量裕度依單站契約容量；自用率以光電為分母
-- metric: mixed, number
WITH observations AS (SELECT m.* FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site)), peaks AS (SELECT site_id,max(grid_import_kw) peak_kw FROM observations GROUP BY 1)
SELECT sum(ev_kw)*.25 AS ev_kwh, avg(it_kw) AS avg_it_kw,
sum(datacenter_kw-it_kw)*.25 AS cooling_kwh,
(sum(solar_kw)-sum(grid_export_kw))/nullif(sum(solar_kw),0) AS solar_self_use,
(SELECT min(s.contract_kw-p.peak_kw) FROM peaks p JOIN sites s USING(site_id)) AS min_headroom_kw,
(SELECT max(peak_kw) FROM peaks) AS max_site_peak_kw,
sum(battery_discharge_kw)*.25 AS storage_kwh,
sum(available_ports)::DOUBLE/nullif(sum(total_ports),0) AS availability,
(SELECT max(p.peak_kw/s.contract_kw) FROM peaks p JOIN sites s USING(site_id)) AS contract_utilization
FROM observations;

-- name: flow
-- description: 供給與去向為同一區間的交流電量；匯流排不追蹤電力來源歸屬；充放電分開避免循環
-- metric: kWh, integer
WITH a AS (SELECT sum(import_kwh) grid,sum(solar_kwh) pv,sum(discharge_kwh) discharge,
sum(building_kw)*.25 building,sum(datacenter_kw)*.25 dc,sum(ev_kw)*.25 ev,sum(charge_kwh) charge,sum(export_kwh) AS exported FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site)),
links AS (
SELECT 1 ord,'電網購電' AS source,'站內匯流排' AS target,grid energy_kwh FROM a UNION ALL
SELECT 2,'太陽能','站內匯流排',pv FROM a UNION ALL
SELECT 3,'儲能放電','站內匯流排',discharge FROM a UNION ALL
SELECT 4,'站內匯流排','樓宇負載',building FROM a UNION ALL
SELECT 5,'站內匯流排','機房負載',dc FROM a UNION ALL
SELECT 6,'站內匯流排','車隊補能',ev FROM a UNION ALL
SELECT 7,'站內匯流排','儲能充電',charge FROM a UNION ALL
SELECT 8,'站內匯流排','餘電外送',exported FROM a)
SELECT source,target,energy_kwh FROM links WHERE energy_kwh>0 ORDER BY ord;

-- name: capacity
-- description: 單站實際十五分鐘峰值相對契約容量，非跨站峰值總和
-- metric: kW, integer
SELECT m.site_id,max(grid_import_kw) AS actual,max(contract_kw) AS target,max(contract_kw)*1.15 AS scale FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) GROUP BY m.site_id ORDER BY m.site_id;

-- name: charging_heat
-- description: 每日與小時的車隊補能功率；多站時彙總每小時站點均值
-- metric: kW, integer
SELECT strftime(ts,'%H') AS hour,strftime(ts,'%m/%d') AS day,sum(ev_kw)/4 AS power_kw FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) GROUP BY 1,2 ORDER BY 2,1;

-- name: building_heat
-- description: 每日與小時的樓宇功率，可辨識非營業排程
-- metric: kW, integer
SELECT strftime(ts,'%H') AS hour,strftime(ts,'%m/%d') AS day,sum(building_kw)/4 AS power_kw FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) GROUP BY 1,2 ORDER BY 2,1;

-- name: soc_profile
-- description: 每小時末電池 SOC 依容量加權；非裝機站點不列入
-- metric: ratio, percent
SELECT date_trunc('hour',ts) AS hour,site_id, arg_max(soc_kwh,ts)/nullif(max(battery_capacity_kwh),0) AS soc_ratio FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) AND battery_capacity_kwh>0 GROUP BY 1,2 ORDER BY 1,2;

-- name: thermal
-- description: 每站每小時環境溫度對能源加權 PUE；標記已知冷卻事件，不做相關性因果推論
-- metric: ratio, decimal
SELECT date_trunc('hour',ts) AS hour,site_id,avg(temperature_c) AS temperature_c,
sum(datacenter_kw)/sum(it_kw) AS pue,avg(it_kw) AS it_kw,
CASE WHEN sum(datacenter_kw)/sum(it_kw)>1.5 THEN '冷卻異常樣本' ELSE '正常樣本' END AS operating_state
FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) AND it_kw>0 GROUP BY 1,2 ORDER BY 1,2;

-- name: cooling_daily
-- description: 日尺度機房 IT 與非IT耗能拆解
-- metric: kWh, integer
SELECT date_trunc('day',ts) AS day,sum(it_kw)*.25 AS it_kwh,sum(datacenter_kw-it_kw)*.25 AS cooling_kwh FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) GROUP BY 1 ORDER BY 1;

-- name: asset_states
-- description: 每小時子系統狀態；異常優先呈現，狀態來自模擬遙測
-- metric: state, text
SELECT date_trunc('hour',t.ts) AS start_ts, date_trunc('hour',t.ts)+INTERVAL 1 HOUR AS end_ts,
t.site_id || ' · ' || t.domain AS lane,
CASE WHEN count(*) FILTER(WHERE state IN ('degraded','derated','partial_outage'))>0 THEN '異常'
WHEN count(*) FILTER(WHERE state='demand_response')>0 THEN '需量反應'
WHEN count(*) FILTER(WHERE state='discharging')>0 THEN '放電'
WHEN count(*) FILTER(WHERE state='charging')>0 THEN '充電' ELSE '正常' END AS status
FROM telemetry t CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND t.ts>=w.start_ts AND t.ts<w.end_ts AND (:site IS NULL OR t.site_id=:site)
AND t.domain IN ('storage','charging','datacenter','solar')
GROUP BY 1,2,3 ORDER BY 3,1;

-- name: connectors
-- description: 已安裝子系統的接口規劃；全部為模擬接口，並非真實連線狀態
-- metric: integration, text
SELECT domain,
CASE domain WHEN 'building' THEN '樓宇控制' WHEN 'grid' THEN '智慧電表' WHEN 'solar' THEN '太陽能' WHEN 'storage' THEN '儲能 EMS' WHEN 'charging' THEN '充電樁' ELSE '機房 DCIM' END AS label,
CASE domain WHEN 'building' THEN 'BACnet / BEMS' WHEN 'grid' THEN 'Modbus / MQTT' WHEN 'solar' THEN 'SunSpec / Inverter' WHEN 'storage' THEN 'EMS / Modbus' WHEN 'charging' THEN 'OCPP / CSMS' ELSE 'Redfish / DCIM' END AS protocol,
count(*) AS subsystem_count FROM assets WHERE (:site IS NULL OR site_id=:site) GROUP BY domain ORDER BY domain;

-- name: cost_bridge
-- description: 無光儲反事實帳單到模型帳單的精確橋接；光電與儲能效應按固定順序拆解，非保證節省
-- metric: TWD, integer
WITH a AS (SELECT sum(baseline_cost_twd) baseline,sum(storage_baseline_cost_twd) solar_only,sum(energy_cost_twd) actual FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site))
SELECT '無光儲情境' step,baseline AS value,'total' AS type FROM a UNION ALL
SELECT '光電差額',solar_only-baseline,'change' FROM a UNION ALL
SELECT '儲能差額',actual-solar_only,'change' FROM a UNION ALL
SELECT '本週模型帳單',actual,'total' FROM a;

-- name: weekly_stats
-- description: 與前一完整週比較，PUE及可用率保持能源或埠時間加權；沒有安裝設備時為NULL
-- metric: mixed, number
SELECT sum(load_kwh) FILTER(WHERE m.ts>=w.start_ts) AS load_current,sum(load_kwh) FILTER(WHERE m.ts<w.start_ts) AS load_previous,sum(energy_cost_twd) FILTER(WHERE m.ts>=w.start_ts) AS cost_current,sum(energy_cost_twd) FILTER(WHERE m.ts<w.start_ts) AS cost_previous,sum(grid_co2_kg/1000) FILTER(WHERE m.ts>=w.start_ts) AS carbon_current,sum(grid_co2_kg/1000) FILTER(WHERE m.ts<w.start_ts) AS carbon_previous,sum(solar_kwh) FILTER(WHERE m.ts>=w.start_ts) AS solar_current,sum(solar_kwh) FILTER(WHERE m.ts<w.start_ts) AS solar_previous,sum(ev_kw*.25) FILTER(WHERE m.ts>=w.start_ts) AS ev_current,sum(ev_kw*.25) FILTER(WHERE m.ts<w.start_ts) AS ev_previous,sum((datacenter_kw-it_kw)*.25) FILTER(WHERE m.ts>=w.start_ts) AS cooling_current,sum((datacenter_kw-it_kw)*.25) FILTER(WHERE m.ts<w.start_ts) AS cooling_previous,sum(datacenter_kw) FILTER(WHERE m.ts>=w.start_ts)/nullif(sum(it_kw) FILTER(WHERE m.ts>=w.start_ts),0) AS pue_current,sum(available_ports) FILTER(WHERE m.ts>=w.start_ts)::DOUBLE/nullif(sum(total_ports) FILTER(WHERE m.ts>=w.start_ts),0) AS availability_current,sum(datacenter_kw) FILTER(WHERE m.ts<w.start_ts)/nullif(sum(it_kw) FILTER(WHERE m.ts<w.start_ts),0) AS pue_previous,sum(available_ports) FILTER(WHERE m.ts<w.start_ts)::DOUBLE/nullif(sum(total_ports) FILTER(WHERE m.ts<w.start_ts),0) AS availability_previous FROM interval_energy m CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current')
AND m.ts>=w.start_ts-INTERVAL 7 DAY AND m.ts<w.end_ts AND (:site IS NULL OR m.site_id=:site);

-- name: report_story
-- description: 敘事結論只使用SQL計算的本週和前週觀測；不宣稱推論因果
-- uses: weekly_stats
-- metric: narrative, text
SELECT *,
(cost_current-cost_previous)/nullif(cost_previous,0) AS cost_change,
(load_current-load_previous)/nullif(load_previous,0) AS load_change,
CASE WHEN cost_current>cost_previous THEN '成本上升，先覆核負載與尖峰排程' ELSE '成本下降，持續追蹤調度與天候因素' END AS cost_verdict,
CASE WHEN pue_current>pue_previous THEN '機房能效較前週下降，需覆核冷卻事件' ELSE '機房能效維持穩定，持續對照 IT 負載' END AS cooling_verdict,
CASE WHEN availability_current<0.99 THEN '充電服務未達示範目標，優先覆核中斷紀錄' ELSE '充電服務達示範目標，持續調整補能排程' END AS charging_verdict
FROM weekly_stats;

-- name: week_sites
-- description: 逐案場前後週成本，不以日均值冒充整週；供報告比較圖
-- metric: TWD, integer
SELECT m.site_id,sum(energy_cost_twd) FILTER(WHERE m.ts<w.start_ts) AS previous,
sum(energy_cost_twd) FILTER(WHERE m.ts>=w.start_ts) AS current FROM interval_energy m CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current')
AND m.ts>=w.start_ts-INTERVAL 7 DAY AND m.ts<w.end_ts AND (:site IS NULL OR m.site_id=:site) GROUP BY 1 ORDER BY 1;

-- name: actions
-- description: 本週事件的後續覆核清單；時數為記錄事件時段，不等同全部停機時數
-- metric: action, text
SELECT e.site_id,e.title,e.action,
CASE e.severity WHEN 'high' THEN '優先覆核' WHEN 'medium' THEN '排程追蹤' ELSE '成效覆核' END AS priority,
round(epoch(least(e.end_ts,w.end_ts)-greatest(e.start_ts,w.start_ts))/3600,1) AS event_hours,
'下個報告週期覆核' AS checkpoint
FROM events e CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current') AND e.start_ts<w.end_ts AND e.end_ts>w.start_ts AND (:site IS NULL OR e.site_id=:site) ORDER BY e.severity,e.site_id;

-- name: event_summary
-- description: 有事件記錄的案場與事件時數；互有重疊時不視為唯一停機時間
-- metric: event, integer
SELECT count(*) AS event_count,count(DISTINCT e.site_id) AS affected_sites,
coalesce(sum(epoch(least(e.end_ts,w.end_ts)-greatest(e.start_ts,w.start_ts))/3600),0) AS recorded_hours
FROM events e CROSS JOIN windows w WHERE w.window_id=coalesce(:window,'current') AND e.start_ts<w.end_ts AND e.end_ts>w.start_ts AND (:site IS NULL OR e.site_id=:site);

-- name: pue_sites
-- description: 逐站能源加權PUE與示範設計目標；不是客戶SLA
-- metric: ratio, decimal
SELECT m.site_id,sum(datacenter_kw)/sum(it_kw) AS actual,
CASE WHEN m.site_id='HEL-2' THEN 1.22 ELSE 1.32 END AS target,1.9 AS scale
FROM interval_energy m CROSS JOIN windows w
WHERE w.window_id=coalesce(:window,'current') AND m.ts>=w.start_ts AND m.ts<w.end_ts
AND (:site IS NULL OR m.site_id=:site) AND it_kw>0 GROUP BY m.site_id ORDER BY m.site_id;
