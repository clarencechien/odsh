# Upstream proposals — prepared, not sent

No issues or pull requests have been sent to third parties from this task.

1. `open-dashboard build --single`: expose the existing public exportHtml behavior through CLI; retain JSON-only data payload and offline filter snapshots.
2. Deterministic data output: strip query ranAt/elapsedMs and optionally accept a build timestamp. Floating reductions also need deterministic database configuration; our DuckDB input config fixes threads=1.
3. Custom-chart template validation: opt-in ChartDefinition template properties, mapping placeholders to query output columns with source locations. Preserve the renderer's literal-only philosophy; reject unverifiable computed templates only when explicitly opted in.

The local shell implements these delivery behaviors without forking the renderer. Follow upstream contribution guidance and ask the maintainer before submitting changes in a separately authorized contribution task.
