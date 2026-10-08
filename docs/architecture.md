# Architecture and delivery boundaries

```mermaid
flowchart LR
  Generator[Seeded site/asset simulation] --> P[Scoped immutable Parquet]
  CH[Future ClickHouse ingestion] -. same contract .-> P
  P --> Duck[DuckDB semantic views]
  Templates[Native TSX + SQL + customer layouts] --> Check[Renderer check + narrative lint]
  Duck --> Check
  Check --> OD[open-dashboard 0.7.0]
  OD --> Site[Static site + single HTML]
  Site --> Manifest[Normalized data hash + artifact manifest]
  Manifest --> Silo[PGSTY Silo / private customer buckets]
  Silo --> Host[Customer host / iframe]
  P --> Rill[Rill source + reviewed metrics]
```

The build shell uses open-dashboard's CLI and public `Workspace/loadConfig/exportHtml` boundary. The v4 personal-layout wrapper composes public React components (`Dashboard`, `Section`, `Filters`, `Row`) from the package; it is a custom reader extension, not the native editor. No renderer fork or private component imports are used. Prose is an official `defineChart` extension and uses escaped React text, including database values.

Build is staged and checked before replacing the prior build. Input/template fingerprints prevent semantic mutation of an already built run. File hashes cover complete bytes; `data_hash` covers all normalized `site/data` JSON, retaining row order and dropping only `ranAt` and `elapsedMs`. Site/single query payloads must match. Wall-clock HTML build timestamps are intentionally outside `data_hash`; byte-identical full HTML is not promised.

A default 92-day dataset contains 6 × 92 × 96 = 52,992 site intervals and 25 installed subsystem meters × 92 × 96 = 220,800 telemetry rows. The same seeded draws are used when selecting an individual tenant; scoped inputs are a reproducible subset of the portfolio. Each run stores five Parquet tables plus generation lineage.

Snapshot filter enumeration has a per-query cap of 100. The largest supported site × window product is 7 × 3 = 21 (including null defaults). The developer live API does not have this snapshot product restriction. Any build-time query error or row truncation is fatal; filter trimming is a manifest warning, and demo builds must have none.

Customer data is sliced before materialization and never relies on browser filters as authorization. Published report assets do not contain Parquet, SQL, runtime credentials or source workspaces. Silo uses private buckets. The development reader gateway is bound to loopback and can only read a specified tenant bucket and committed release artifacts. Production authentication, policies, backup/restore and TLS termination belong to the deploying host.

Rill's reviewed metrics calculate ratios from interval-level numerator/denominator sums. Query-derived draft metrics use MAX on already aggregated values as a deliberately conservative placeholder and are excluded with `.rillignore`; they are not valid automatic additive rollups. ClickHouse is an extension point with a tested HTTP adapter boundary, not a completed production connector or promised cross-dialect compatibility.

Energy Loop uses native chart widgets for operational exploration (Sankey, heatmap, gauge, bullet, scatter, timeline, line, bar and treemap). The fixed weekly report intentionally has no filters: SQL-derived prose, a cost waterfall, site comparison dumbbells and an action table. IntegrationMap is a second official defineChart extension describing mocked protocol seams. All six sites inherit only widgets supported by their installed domains.


## Reader, developer runtime, and proposed authoring service

The static reader needs only HTTP hosting (or a single-file HTML reader), with finite precomputed filters. Its personal theme/layout preferences live in localStorage. The native developer server runs Node and DuckDB, queries live local inputs, and saves editor changes into the workspace TSX. `prepareWorkspace()` can overwrite these changes: persist them to the authoritative source templates before rebuilding.

A future customer Studio/chat product is a third mode, requiring an application API, identity and tenant scope, draft revisions, a job runner and durable storage. Studio and chat should edit the same constrained draft specification; a compiler generates existing TSX/SQL, then validation, preview and release reuse this repo. Developer tools can edit reviewed source drafts more freely. These services are **proposed, not implemented**. Native assistant tools read existing panels and set filters; they are not a source authoring service.

The runtime split permits a Vercel/Cloudflare frontend with a separate Node build worker. Cloudflare Workers cannot directly load this project's native DuckDB addon; transient function filesystems are not durable source repositories. Rill is an optional exploration service; exports alone do not provide a hosted Rill runtime.

See [handoff](../handoff.md) for source ownership and recipes, [agent/Studio design](agent-studio-roadmap.md) for proposed tools/API contracts, and [the illustrated guide](https://clarencechien.github.io/odsh/guide.html) for the product explanation.

## Provenance and current boundaries

`manifest.template.commit` records checkout HEAD and may omit uncommitted template changes; the template file fingerprints represent the actual build inputs. Complete Git/dirty lineage remains a gap. Regex-based SQL scope rewriting supports trusted templates, not arbitrary customer SQL authorization. Customer-generated content needs semantic metric validation and service-enforced tenant scoping before exposing authoring tools.
