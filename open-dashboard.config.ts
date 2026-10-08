import type { OpenDashboardConfig } from '@open-dashboard/core'
// In each run workspace, input/ is a private immutable copy of this run's Parquet.
export default {
  datasources: { energy: { type: 'duckdb', init: [
    "SET threads = 1",
    "CREATE VIEW meters AS SELECT * FROM 'input/meters.parquet'",
    "CREATE VIEW telemetry AS SELECT * FROM 'input/telemetry.parquet'",
    "CREATE VIEW sites AS SELECT * FROM 'input/sites.parquet'",
    "CREATE VIEW assets AS SELECT * FROM 'input/assets.parquet'",
    "CREATE VIEW events AS SELECT * FROM 'input/events.parquet'",
    "CREATE VIEW bounds AS SELECT CAST(max(ts) AS DATE) + INTERVAL 1 DAY AS end_ts FROM meters",
    `CREATE VIEW windows AS SELECT 'current' AS window_id, end_ts - INTERVAL 7 DAY AS start_ts, end_ts FROM bounds
     UNION ALL SELECT 'previous', end_ts - INTERVAL 14 DAY, end_ts - INTERVAL 7 DAY FROM bounds`,
    `CREATE VIEW interval_energy AS SELECT *,
      load_kw * 0.25 AS load_kwh, solar_kw * 0.25 AS solar_kwh,
      grid_import_kw * 0.25 AS import_kwh, grid_export_kw * 0.25 AS export_kwh,
      battery_discharge_kw * 0.25 AS discharge_kwh,
      battery_charge_kw * 0.25 AS charge_kwh,
      baseline_cost_twd - energy_cost_twd AS modeled_savings_twd,
      storage_baseline_cost_twd - energy_cost_twd AS storage_savings_twd
      FROM meters`
  ]}},
  defaultSource: 'energy', maxRows: 5000, timeoutMs: 30000, theme: 'atled',
} satisfies OpenDashboardConfig
