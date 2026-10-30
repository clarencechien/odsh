# Request observations — S1 data contract

S1 uses open-dashboard 0.12.0 and DuckDB. The current default run is synthetic; no real customer dataset has been accepted. This pack and its imitator report are not included in the current energy Pages bundle. This file is part of the generated template fingerprint; use a new run ID after editing it.

`http_requests`: one request per row. Required fields: `ts` TIMESTAMP (Asia/Taipei local wall time), `service` TEXT, `path` TEXT, `status` INTEGER HTTP status, `latency_ms` DOUBLE milliseconds. Never sum latency percentiles or average error percentages across services.

- error_rate: count of status >= 500 divided by all requests; ratio 0..1.
- p99_ms: quantile_cont(latency_ms, .99), across the selected raw observations.
- rps: count divided by elapsed seconds between the selected first/last request, minimum one second. This is an observed-window rate, not a count divided by a nominal day. Sparse logs do not prove zero traffic in gaps.
- Snapshot filters select service. Full-window metrics have their own unfiltered reference queries for consistency validation.
- Synthetic ingestion injects an incident into checkout on 2026-10-28. This is evidence of a fixture, not a causal claim about a real system.
- `--input` preserves the provided Parquet bytes and records a checksum and source filename. It does not anonymize data or normalize timestamp units/types; the source must already satisfy this contract before use. Sharing scope must follow the data owner’s intended audience.

## Default fixture and validation

The default 14-day fixture covers 2026-10-16 00:00:00 through 2026-10-29 23:59:30: 120,960 rows, three services and 40 endpoint paths. Each service has one synthetic request every 30 seconds. The injected checkout error/latency event spans 2026-10-28 09:00–10:30 inclusive. Shorter fixtures may not include that event.

Native expectations in `packs/o11y/dashboards/rca/queries.sql` check input validity and query results. `packs/o11y/rill/metrics.yaml` owns the three reviewed formulas; T18 compares them to independent full-input scalar snapshots, with NULL matched as NULL and relative numeric tolerance 1e-9. Service-filtered charts are outside that T18 scope. TD expands the three service choices; 40 path values are marked needs_narrowing instead of truncated.

Generate a new fixture with `npm run snapreport -- generate o11y-next --pack o11y`, or supply `--input /path/to/http_requests.parquet`; then build, verify and run `node src/consistency.mjs o11y-next`. The --input route is implemented, but real-data acceptance remains pending. See repository `docs/validation.md` and `docs/deployment.md` for verified versus unpublished capabilities.
