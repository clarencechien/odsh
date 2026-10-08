import type { OpenDashboardConfig } from '@open-dashboard/core'
// Optional future LIVE workspace. Requires @clickhouse/client and ported SQL.
export default {
  datasources: { energy: { type: 'clickhouse', url: process.env.CLICKHOUSE_URL! } },
  defaultSource: 'energy', maxRows: 5000,
} satisfies OpenDashboardConfig
