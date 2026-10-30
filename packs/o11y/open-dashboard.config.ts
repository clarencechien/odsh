import type {OpenDashboardConfig} from '@open-dashboard/core'
export default {
 timeZone:'Asia/Taipei',defaultSource:'o11y',maxRows:5000,timeoutMs:30000,
 datasources:{o11y:{type:'duckdb',freshness:'static',init:[
  'SET threads = 1',
  "CREATE VIEW run_metadata AS SELECT * FROM read_json_auto('generation.json')",
  "CREATE VIEW http_requests AS SELECT * FROM 'input/http_requests.parquet'",
  "CREATE VIEW bounds AS SELECT min(ts) AS start_ts,max(ts) AS end_ts FROM http_requests",
 ]}},
} satisfies OpenDashboardConfig
