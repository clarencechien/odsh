-- name: services
-- description: Services available in this scoped input
-- expect: unique value
-- expect: not_null value
SELECT DISTINCT service AS value, service AS label FROM http_requests ORDER BY 1;

-- name: overview
-- description: Selected raw request window; ratios and percentiles recomputed at this scope
-- expect: rows = 1
-- expect: requests > 0
-- expect: error_rate between 0 and 1
-- expect: p99_ms >= 0
SELECT count(*) AS requests, count(*) FILTER(WHERE status>=500)::DOUBLE/count(*) AS error_rate,
 quantile_cont(latency_ms,.99) AS p99_ms,
 count(*)::DOUBLE/greatest(epoch(max(ts)-min(ts)),1) AS rps,
 min(ts)::VARCHAR AS start_ts,max(ts)::VARCHAR AS end_ts
FROM http_requests WHERE :service IS NULL OR service=:service;

-- name: hourly
-- description: Hourly error rate and latency; never average p99s from other groups
-- expect: rows > 0
-- expect: error_rate between 0 and 1
SELECT date_trunc('hour',ts) AS hour,service,
 count(*) FILTER(WHERE status>=500)::DOUBLE/count(*) AS error_rate,
 quantile_cont(latency_ms,.99) AS p99_ms
FROM http_requests WHERE :service IS NULL OR service=:service GROUP BY 1,2 ORDER BY 1,2;

-- name: endpoints
-- description: Endpoint evidence ranked by failure rate with denominator shown
-- expect: rows > 0
-- expect: error_rate between 0 and 1
SELECT service,path,count(*) AS requests,count(*) FILTER(WHERE status>=500)::DOUBLE/count(*) AS error_rate,quantile_cont(latency_ms,.99) AS p99_ms
FROM http_requests WHERE :service IS NULL OR service=:service GROUP BY 1,2 ORDER BY error_rate DESC,service,path LIMIT 120;


-- name: provenance
-- description: Ingestion provenance; synthetic and supplied data are explicitly distinguished
-- expect: rows = 1
-- expect: not_null label
SELECT CASE WHEN synthetic THEN '合成資料 / SYNTHETIC：情境注入，非真實事故' ELSE '提供的 Parquet / SOURCE DATA：待資料擁有者確認來源' END AS label FROM run_metadata;

-- name: input_quality
-- description: Required input values and HTTP / latency domain
-- expect: rows = 1
-- expect: invalid_rows = 0
SELECT count(*) FILTER(WHERE ts IS NULL OR service IS NULL OR path IS NULL OR status IS NULL OR status NOT BETWEEN 100 AND 599 OR latency_ms IS NULL OR NOT isfinite(latency_ms) OR latency_ms<0) AS invalid_rows FROM http_requests;
