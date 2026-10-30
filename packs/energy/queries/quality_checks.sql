-- name: q_meter_row_count
-- description: meter row count
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) - (SELECT meter_rows FROM run_metadata) AS residual FROM meters;

-- name: q_telemetry_row_count
-- description: telemetry row count
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) - (SELECT telemetry_rows FROM run_metadata) AS residual FROM telemetry;

-- name: q_unique_intervals
-- description: unique interval keys
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*)-count(DISTINCT (site_id,ts)) AS residual FROM meters;

-- name: q_energy_balance
-- description: energy balance kW
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(grid_import_kw+solar_kw+battery_discharge_kw-load_kw-battery_charge_kw-grid_export_kw)) AS residual FROM meters;

-- name: q_end_use_balance
-- description: end use balance
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(load_kw-building_kw-datacenter_kw-ev_kw)) AS residual FROM meters;

-- name: q_soc_transition
-- description: battery SOC transition
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(soc_kwh-soc_start_kwh-battery_charge_kw*.25*sqrt(.9)+battery_discharge_kw*.25/sqrt(.9))) AS residual FROM meters;

-- name: q_soc_continuity
-- description: SOC continuity
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT coalesce(max(abs(soc_start_kwh-previous_soc)),0) AS residual FROM (SELECT soc_start_kwh,lag(soc_kwh) OVER(PARTITION BY site_id ORDER BY ts) previous_soc FROM meters);

-- name: q_soc_bounds
-- description: SOC bounds
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters m JOIN sites s USING(site_id) WHERE soc_kwh < s.battery_capacity_kwh*.15-.00001 OR soc_kwh > s.battery_capacity_kwh*.9+.00001;

-- name: q_charge_exclusivity
-- description: no simultaneous charge/discharge
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters WHERE battery_charge_kw>0 AND battery_discharge_kw>0;

-- name: q_grid_exclusivity
-- description: no simultaneous import/export
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters WHERE grid_import_kw>0 AND grid_export_kw>0;

-- name: q_tariff_ledger
-- description: tariff ledger
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(energy_cost_twd-(grid_import_kw*tariff_twd_kwh-grid_export_kw*2)*.25)) AS residual FROM meters;

-- name: q_emissions_ledger
-- description: emissions ledger
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(grid_co2_kg-grid_import_kw*.25*.474)) AS residual FROM meters;

-- name: q_pue_ports
-- description: valid PUE and ports
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters WHERE datacenter_kw<it_kw OR available_ports<0 OR available_ports>total_ports;

-- name: q_cadence
-- description: regular interval cadence
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM (SELECT ts-lag(ts) OVER(PARTITION BY site_id ORDER BY ts) gap FROM meters) WHERE gap != INTERVAL 15 MINUTE;

-- name: q_night_solar
-- description: night solar
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters WHERE (hour(ts)<6 OR hour(ts)>=18) AND solar_kw>.000001;

-- name: q_telemetry_balance
-- description: telemetry reconciles with meters
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between -0.00001 and 0.00001
SELECT max(abs(m.load_kw-t.load_kw)) AS residual FROM meters m JOIN (SELECT site_id,ts,sum(power_kw) AS load_kw FROM telemetry WHERE domain IN ('building','datacenter','charging') GROUP BY 1,2) t USING(site_id,ts);

-- name: q_events_present
-- description: declared events present
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*)-(SELECT array_length(events) FROM run_metadata) AS residual FROM events;

-- name: q_null_observations
-- description: no null meter observations
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters WHERE ts IS NULL OR site_id IS NULL OR load_kw IS NULL OR soc_kwh IS NULL;

-- name: q_scope_meters
-- description: tenant isolation meters
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM meters,run_metadata meta WHERE meta.tenant IS NOT NULL AND (meters.tenant IS NULL OR meters.tenant<>meta.tenant);

-- name: q_scope_sites
-- description: tenant isolation sites
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM sites,run_metadata meta WHERE meta.tenant IS NOT NULL AND (sites.tenant IS NULL OR sites.tenant<>meta.tenant);

-- name: q_scope_assets
-- description: tenant isolation assets
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM assets,run_metadata meta WHERE meta.tenant IS NOT NULL AND (assets.tenant IS NULL OR assets.tenant<>meta.tenant);

-- name: q_scope_telemetry
-- description: tenant isolation telemetry
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM telemetry,run_metadata meta WHERE meta.tenant IS NOT NULL AND (telemetry.tenant IS NULL OR telemetry.tenant<>meta.tenant);

-- name: q_scope_events
-- description: tenant isolation events
-- expect: rows = 1
-- expect: not_null residual
-- expect: residual between 0.00000 and 0.00000
SELECT count(*) AS residual FROM events,run_metadata meta WHERE meta.tenant IS NOT NULL AND (events.tenant IS NULL OR events.tenant<>meta.tenant);
