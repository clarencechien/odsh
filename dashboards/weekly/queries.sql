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
