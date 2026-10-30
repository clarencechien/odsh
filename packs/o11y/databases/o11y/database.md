# Request observations

`http_requests`: one request per row. Required fields: `ts` TIMESTAMP (Asia/Taipei local wall time), `service` TEXT, `path` TEXT, `status` INTEGER HTTP status, `latency_ms` DOUBLE milliseconds. Never sum latency percentiles or average error percentages across services.

- error_rate: count of status >= 500 divided by all requests; ratio 0..1.
- p99_ms: quantile_cont(latency_ms, .99), across the selected raw observations.
- rps: count divided by elapsed seconds between the selected first/last request, minimum one second. This is an observed-window rate, not a count divided by a nominal day. Sparse logs do not prove zero traffic in gaps.
- Snapshot filters select service. Full-window metrics have their own unfiltered reference queries for consistency validation.
- Synthetic ingestion injects an incident into checkout on 2026-10-28. This is evidence of a fixture, not a causal claim about a real system.
- `--input` preserves the provided Parquet bytes and records a checksum. The owner must confirm de-identification and appropriate access before sharing artifacts.
