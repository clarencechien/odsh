# Upstream proposals — prepared, not submitted

Reviewed against open-dashboard 0.12.0 (`4cd642da7b9f3bf2112d1f8b1092f43ca9dad187`). No upstream issue or PR has been sent. Obtain Clarence's approval before submitting one.

Updated 2026-10-30. These are proposals, not shipped commands. The existing S1 Pages publication uses the current export adapter and does not resolve any private-API gap. See [current publication](deployment.md), [architecture](architecture.md) and [documentation index](README.md).

## 1. Public single-file export CLI (still needed)

Propose `open-dashboard export-html <id> [--filter k=v] --out file.html [--max-runs n] [--json]`.

It should resolve a configured workspace, execute the existing single export implementation, close database resources, and atomically write an offline HTML artifact. `--filter` follows native query/filter coercion, while absent filters retain the existing default plus enumerated snapshots. `--json` returns output path, dashboard ID, stored combinations, trim warnings and errors. Failed queries/truncated rows return nonzero; filter trimming must be machine-visible.

Acceptance: two filters with NULL/default values; offline service/site switching with zero HTTP; escaped `</script>`/Unicode; query error and max-runs trimming; resource cleanup on failure; deterministic data payload and equality to the multi-file build. Export must not silently depend on externally loaded fonts/assets.

This removes odsh's entire private `exportHtml, Workspace, loadConfig` import. Today `exportHtml` requires a Workspace instance; pretending that only one imported symbol is necessary would hide the real dependency. No CLI/MCP replacement exists in 0.12.0.

## 2. Determinism (partly solved upstream)

0.12 config supports explicit `timeZone`, and the build documents portable execution. This addresses the missing timezone contract; odsh now uses Asia/Taipei. It does **not** make byte-identical output: observed `ranAt`, `elapsedMs`, and `dashboards.json.builtAt` still vary.

Potential remaining proposal: documented semantic-hash projection, or optional deterministic timestamp via a build option / SOURCE_DATE_EPOCH, keeping host freshness useful. Test repeated builds in distinct host timezones. Until then odsh excludes timing metadata from data_hash and separately hashes complete artifact bytes. threads=1 remains the configured DuckDB reproducibility choice.

## 3. Host contract / single export (observation, no API fork)

Use documented `window.__OPEN_X_HOST__ = {embed:true}` for framed sites. The bundled single-file viewer in the tested release still renders an additional header; the imitator pack scopes a CSS mapping to avoid duplicated report titles. A public single-export chrome option and a host-contract browser test could eliminate that selector dependency.

## 4. Opt-in defineChart template validation

Native check validates known query references and column props, but cannot infer `{{column:format}}` references in a custom Prose chart's string template. Propose an opt-in ChartDefinition schema field declaring template-bearing props and their token grammar/format names; check resolves placeholders against the selected query and reports TSX source positions. Built-in literal-only behavior remains unchanged for charts not opting in.

Acceptance: valid column/format passes; unknown column/format and malformed token fail with file:line; computed templates explicitly report unverifiable when strict validation is opted in; quoted/escaped text and user-provided data do not become executable code. Shared queries and all-params checking must use the same resolved columns. Narrative bare-number policy remains a domain policy, not forced on every upstream chart.

If this lands, odsh can remove most template-column validation and keep only its optional narrative-number policy. S2 should consume existing MCP authoring tools rather than introduce another general chart editor or tool catalog.
