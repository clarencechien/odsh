# odsh — packs over open-dashboard 0.12.0

以 **DuckDB + 原生 open-dashboard CLI／MCP** 產生可驗證的 Dashboard、單檔 Report 與靜態站。odsh 保留的是不可變 run、品牌套版、領域 pack 與交付契約；查詢、圖表、參數檢查與 runtime 交給上游。

目前有兩個資料 pack：`energy`（虛構企業 **ATLED Engergy**，三家客戶六案場）與 `o11y`（服務請求 RCA）。**目前展示資料皆為合成資料，節省效益為模型估算。** `imitator-brand` 是可獨立套用的報告品牌。

- [接手必讀 handoff](handoff.md)：工作位置、S1 狀態與剩餘缺口。
- [W1–W9 修正紀錄](docs/s1/changes.md)、[驗收證據](docs/validation.md)、[架構](docs/architecture.md)。
- [科普 HTML](docs/open-dashboard-guide.html)、[Agent／Studio 串接方向](docs/agent-studio-roadmap.md)。
- 既有展示網址：[https://clarencechien.github.io/odsh/](https://clarencechien.github.io/odsh/)。2026-10-30 已將 S1 成品推至 gh-pages，沿用 v4 完全相同的輸入資料；環境無法存取 github.io，實際上線狀態仍待 GitHub Pages 確認。發布證據見 [pages-deployment.json](docs/s1/pages-deployment.json)。

## 文件與發布範圍

[文件索引](docs/README.md) 按閱讀用途列出全部說明；[Pages 發布指南](docs/deployment.md) 說明來源分支、產物、驗證、更新與回復流程。S1 程式與目前文件位於 [`codex/odsh-s1`](https://github.com/clarencechien/odsh/tree/codex/odsh-s1)，尚未合併 `main`；`gh-pages` 只存讀者成品。公開站發布 energy 的三客戶六案場與合成總覽；o11y／imitator 報告目前在 repo 與本機 run，未加入公開站。

## 開始使用

Node ≥22.18；本次驗證 Node 24.19.0。使用 lockfile 安裝：

```bash
npm ci --cache /workspace/.npm-cache
npm run demo -- --pack energy
npm run demo -- --pack o11y
npm run serve
```

上述指令適用尚未產生預設 run 的 checkout。若已存在 `*-s1-final`，且來源（包含 database.md）有修改，請改用新的 `--suffix=-next`；不要重建舊 run。既有成品仍可 verify、預覽及發布。

`demo` 產生凍結 run、原生檢查、靜態站、單檔 HTML、manifest 與 Rill 專案。預設 energy 四份 `*-2026-q3-s1-final`，o11y 為 `o11y-2026-10-s1-final`。瀏覽器測試使用 `/usr/bin/chromium`，可用 `CHROMIUM_PATH` 指定系統 Chromium。

模板改變後請使用新 suffix；不能覆寫舊 run 的語意：

```bash
npm run demo -- --pack energy --suffix=-next
npm run snapreport -- generate atlas-next --pack energy --tenant 'Atlas Semiconductor' --days 92 --seed 42
npm run snapreport -- build atlas-next
npm run snapreport -- verify atlas-next
npm run snapreport -- export-rill atlas-next
node src/consistency.mjs atlas-next
```

o11y 可接提供的 Parquet，欄位契約見 [database.md](packs/o11y/databases/o11y/database.md)：

```bash
npm run snapreport -- generate o11y-real --pack o11y --input /path/to/http_requests.parquet
npm run snapreport -- build o11y-real
```

此入口已提供；真實資料驗收尚未完成。原始輸入及其 SHA 會記錄在 run，報告會顯示合成／實際來源標記。

## 讀者、開發與 Agent 入口

| 模式 | 指令 | 能力 |
|---|---|---|
| 凍結快照 | `npm run serve` | 普通 HTTP server 提供已建置 HTML／JSON；只在預先計算的篩選組合內互動 |
| 開發與 authoring | `npm run snapreport -- dev <run>` | 原生 `open-dashboard dev --mcp`，Node + DuckDB；有編輯能力 |
| 即時唯讀查詢 | `npm run snapreport -- live <run>` | 原生 `open-dashboard serve`，Node + DuckDB；讀目前資料，無編輯 UI |
| Agent stdio | `npm run snapreport -- mcp <run>` | 原生 MCP，提供查詢、檢查及來源編輯工具；不是租戶隔離的公共聊天服務 |

`workspace/` 是生成副本，`prepareWorkspace` 會重新套 pack；check／lint／dev／live／mcp 也會觸發這一步。來源變更後請先建立新 run，再使用這些命令；長期修改應回寫 pack。不要在凍結 run 中開啟編輯工作後期待改動自動成為新版本。正式多人草稿／發布服務屬 S2。

Vercel／Cloudflare 可承載靜態成品或未來 UI；即時 DuckDB、原生檔案編輯與長任務仍需要合適的 Node worker。單檔 HTML 不需要 Node runtime。

## 修改哪裡

| 需求 | 檔案 |
|---|---|
| 客戶 KPI、設備組合 | `packs/energy/hooks/customers.mjs` |
| 能源 Dashboard／週報 | `packs/energy/hooks/layouts.mjs`、`packs/energy/hooks/report-layout.mjs`、`packs/energy/dashboards/` |
| 能源守恆／品質 | `packs/energy/queries/quality_checks.sql` 與 `packs/energy/quality-map.json` |
| o11y 報告 | `packs/o11y/dashboards/rca/` |
| 品牌與主題 | 各 pack 的 `brand/`、`themes/`；原版 imitator CSS 不可改動 |
| Rill 指標 | 各 pack 的 `rill/metrics.yaml`；新增指標同步獨立 `-- metric:` scalar reference |
| 通用流程 | `src/run.mjs`、`src/pack.mjs`、`src/upstream.mjs` |

Dashboard 的主題與個人排版仍為 energy pack 自製讀者擴充，設定存在瀏覽器；正式 Report 不受個人編輯影響。原生編輯器用於 authoring，兩者不是同一套功能。

## 驗證與 TD 選項

```bash
npm test
npm run typecheck
npm run test:consistency
npm run test:runtime
npm run test:e2e
npm run test:themes
npm run test:personalization
npm run test:o11y
npm run test:snapshots
npm run test:pages
npm run test:reproducibility
npm run options -- --pack energy --run demo-2026-q3-s1-final
npm run options -- --pack o11y --run o11y-2026-10-s1-final
```

這組驗證指令預設讀已產生的 `*-s1-final`。若使用新 suffix，先設定 `ATLED_RUN_SUFFIX=-next` 與 `ODSH_O11Y_RUN=o11y-2026-10-next`；CLI 的單一 run 指令則明確傳入新 ID。

`test:pages` 僅建置並驗證本機 staging，不發布。發布既有成品使用 `npm run pages:publish`，不需要重跑 DuckDB build；完整流程見 [發布指南](docs/deployment.md)。TD 選項包含 view／measure／dimension／grain／widget 與 distinct values；字母不重排，超過 26 項必須縮小範圍。這不是 compiler 或客戶 Studio。

Rill 匯出包含 raw Parquet 與 reviewed metrics，不再產 `drafts/`。T18 驗證的是宣告的完整輸入 scalar 指標，不是所有有篩選的圖表公式。Rill runtime／ClickHouse 生產串接尚未完成。

既有 PGSTY Silo 流程保留：`npm run silo:start` → `npm run snapreport -- publish-silo atlas-2026-q3-s1-final` → `npm run snapreport -- serve-silo atlas`；需要 Docker。本次未重新驗證或部署 Silo／Rill／ClickHouse 服務；Pages 靜態發布另有獨立紀錄。私有憑證只保留在忽略版控的 `.runtime/silo.env`。

## 尚未達成的嚴格 S1 exit

1. 單檔 HTML 匯出沒有公開 CLI，`src/upstream.mjs` 仍集中使用 `exportHtml`、`Workspace`、`loadConfig` 三個私有符號；不符合 handoff 的「≤1」。未 fork 上游，具體 CLI 提案見 [upstream proposals](docs/upstream-proposals.md)。
2. 尚未取得真實 o11y Parquet，現有結果明確標記 synthetic。
3. 受管理 Chromium 阻擋 `file://`，已驗證 offline setContent 零外連，雙擊檔案仍需在一般桌面瀏覽器驗收。

MCP 工具列、讀取與全參數檢查已驗證；`render_panel` 需要的 Playwright browser 下載被環境網路規則阻擋，尚未執行。不能把測試通過誤寫成 S1 全部完成。
