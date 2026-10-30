# ATLED Engergy — energy data contract v2

S1 implementation: open-dashboard 0.12.0. This remains data contract v2; the documentation update does not change the data schema or metric formulas. This file is copied into generated workspaces and fingerprinted, so a change requires a new run ID when rebuilding.

All companies, sites, observations and incidents in the demo are **synthetic**. Read this before writing SQL. Source of truth is the immutable Parquet in each run's `input/`; DuckDB views are the analytical adapter. `generation.json` records seed, scope, window and assumptions.

## Tables and grain

- `sites`: one row per `site_id`; tenant, local site name, comma-separated installed `domains`, human-readable `solution`, preferred `layout`, equipment capacities, `contract_kw`, `archetype` and `goal`.
- `assets`: one virtual subsystem per installed domain per site; `asset_id` unique. These are subsystem meters, not individual physical inverter/rack/connector counts.
- `meters`: one row per site per **15-minute** interval; primary key `(site_id, ts)`. Power fields are interval-average kW, not instantaneous readings. Unsupported domains carry zero power and zero capacity. `battery_capacity_kwh` and `contract_kw` repeat the site configuration for bounded analytical queries. Missing/estimated is not the same as uninstalled.
- `telemetry`: one row per installed `(asset_id, ts)`; domain power, operating state and quality. Only installed domains are emitted.
- `events`: resolved, deliberately injected operational incidents; start inclusive, end exclusive, site, domain, severity, title and suggested action. These are known simulation causes, not inferred causal diagnoses.

## Time and quality

`ts`, `start_ts`, `end_ts` are DuckDB TIMESTAMP **local wall times in Asia/Taipei**, not UTC instants. The generator uses UTC arithmetic only to create stable calendar labels; never append `Z` when interpreting the stored timestamp. Default window is 2026-07-01 through 2026-09-30 inclusive, 92 days. Current and prior report windows are absolute seven-day intervals anchored to the input's last date, never the build clock. For a UTC ClickHouse source, convert once at ingestion and preserve this contract. A real multi-timezone installation should migrate to UTC plus explicit timezone dimensions.

`quality` is measured/estimated; roughly 0.3% of intervals are tagged estimated. The fixture intentionally has complete interval coverage; it does not claim a realistic missing-data recovery algorithm. `synthetic=true` is always present. Null KPI denominators mean not applicable, not zero performance.

## Metric definitions

- Energy kWh = sum(interval-average kW × 0.25 hours). Never sum power directly and label it kWh.
- Load = building + datacenter + EV. Solar and storage are supply-side flows, not extra end-use consumption.
- Balance: grid import + solar + discharge = load + charge + grid export.
- SOC transition: ending SOC = starting SOC + charge × 0.25 × sqrt(0.9) − discharge × 0.25 / sqrt(0.9). Operational SOC 15–90%; no simultaneous charge/discharge; SOC carries across intervals.
- `energy_cost_twd` = (import kW × interval tariff − export kW × 2 TWD/kWh) × 0.25. Tariffs 2.1/4.2/6.8 are illustrative TOU assumptions. Demand fees, taxes and capex are excluded.
- `baseline_cost_twd`: identical observed load with no solar or battery. `modeled_savings_twd` is baseline minus modeled energy bill; not guaranteed or measured savings.
- `storage_baseline_cost_twd`: same load and PV without battery; storage savings = this bill minus modeled bill. Solar exported or charging batteries is not automatically assigned a zero emissions credit.
- PUE = sum(datacenter energy) / sum(IT energy); never average site ratios. Null when no IT is installed.
- Cooling/non-IT energy = sum(datacenter − IT) × 0.25; includes all non-IT facility overhead, not just the chiller.
- Charging availability = sum(available_ports) / sum(total_ports), weighted by interval and installed ports. Charging kWh is delivered energy in the simplified model, not session-level billing.
- Grid CO₂ kg = import kWh × 0.474 (illustrative location-based factor). No export credit, lifecycle assessment, offsets or formal carbon inventory.
- On-site solar ratio = (PV kWh − exported kWh) / load kWh. This includes battery charging and losses; it is a simplified on-site PV allocation proxy, not traced hourly renewable consumption. Solar self-use ratio uses PV as denominator.
- Peak demand = maximum **single-site 15-minute** imported kW. Do not sum non-coincident site peaks and call it portfolio demand. Contract headroom = minimum across sites of contract kW minus that site's peak.
- Hourly portfolio power = sum(interval kW)/4; this assumes the complete interval coverage validated by the generator. Single-site average IT kW in the cloud view averages site-intervals, not total portfolio IT power.

## Customer and solution boundaries

Atlas Semiconductor favors resilience/demand; Meridian Logistics favors charging/solar; Helios Cloud favors PUE/carbon. `packs/energy/hooks/customers.mjs` (repository-relative) maps each of six sites to its installed domains. Pages are compiled into ordinary open-dashboard TSX/SQL; no renderer fork or alternate dashboard DSL.

A site filter is not authorization. For delivery, generate `--tenant` runs; input Parquet and every precomputed combination contain only that tenant. A real multi-tenant portfolio must remain internal. The public Pages portfolio is an explicitly synthetic demonstration; the Pages publisher requires synthetic=true in both generation metadata and the build manifest. Per-customer Silo buckets separate delivery packages but production authentication remains the host's responsibility.

## Future ingestion

ClickHouse must produce the same five tables with this grain, names, units and timezone semantics. Materialize a bounded window before report generation; record source lineage and watermark. Never put source credentials or live SQL in report HTML. The native ClickHouse example config is only a live-dashboard seam: DuckDB-specific SQL must be ported, not swapped blindly.

Rill uses copied Parquet and reviewed interval-level measures from `packs/energy/rill/metrics.yaml`. The exporter no longer generates aggregated drafts. T18 recomputes all seven measures against the full immutable input and compares independent unfiltered scalar `-- metric: energy.<measure>` snapshots; this does not validate every filtered chart formula.

## Native quality checks and published fixture

The 23 input-quality rules are mapped in `packs/energy/quality-map.json` and implemented as shared SQL with native `-- expect:` in `packs/energy/queries/quality_checks.sql`. A validation-only dashboard references every rule so upstream check actually executes them; it is not delivered to readers. There is no separate custom quality runner.

The S1 Pages energy inputs are byte-identical to the prior v4 demo: three customer runs with two sites each, plus the synthetic six-site portfolio. Current and previous weeks are still 2026-09-24–09-30 and 2026-09-17–09-23. This is not a new observation period or live customer data. Repository evidence: `docs/s1/pages-deployment.json`; publication instructions: `docs/deployment.md`.
