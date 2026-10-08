# ATLED Engergy / odsh — 下一位 agent 接手指南

更新：2026-10-08（Asia/Taipei）。這是**目前 repo 的接手文件**，不是原始 `handoff-snapreport-v3.md` 的複製品。原始 handoff 目標、使用者追加需求、已交付能力與未完成事項在下方分開記錄。

## 1. 先掌握目前產品與使用者意圖

- 公司名稱依使用者指定為 **ATLED Engergy**，保留這個拼法。
- 這是虛構 ToB 能源整合公司的 MVP：智慧樓宇、電網、資料中心、儲能、太陽能、充電樁；**3 個客戶、6 個案場**，不同設備組合與 KPI。不要回到 12 案場。
- 主色 `#0087dc`，青色與萊姆綠組成 Energy Loop；深／淺模式及列印皆須可讀。曾發生固定白底配深色模式白字的 regression。
- Dashboard 用於營運探索；Report 是固定週期的決策文件。靜態篩選只切預先計算的查詢結果，不是即時 BI。
- 所有數據與接口都是合成示範；`BACnet/OCPP/Modbus/Redfish` 卡片並未連接真實設備。
- 使用者要求用 [PGSTY Silo](https://github.com/pgsty/silo) 取代原 handoff 的 MinIO，這項已實作；Rill / ClickHouse 保留接入可能。
- v4 新增的「編輯版面」是我們的 React 個人化介面，**不是原生編輯器**。使用者明確覺得不好用。功能測試通過不代表 UX 已被接受；下一輪先比較原生操作，再決定保留／重作。
- 最新要求：更新文件與科普 HTML，說明 dev agent 產製、customer Studio／chat 產製的可行架構。這些產品路線目前是設計文件，不要宣稱已建置客戶 AI Studio。

## 2. 入口、版本與部署

- 原始碼：<https://github.com/clarencechien/odsh>，發布原始碼至 `main`。
- 展示站：<https://clarencechien.github.io/odsh/>，由 `gh-pages` 分支 `/` 部署。
- 科普與路線圖：<https://clarencechien.github.io/odsh/guide.html>；來源 `docs/open-dashboard-guide.html`。
- 現行 dashboard/report release：`demo-2026-q3-v4`、`atlas-2026-q3-v4`、`meridian-2026-q3-v4`、`helios-2026-q3-v4`。展示頁路徑固定為 `/atlas/` 等，不含 run_id。
- v4 功能基準 source commit：`9a54f9c`；後續文件 commit 請看 `git log`。不要把文件 commit 當成已重建的 run 模板版本。
- `runs/`、`node_modules/`、`.runtime/`、`test-results/` 全被忽略：新 clone 不一定有產物，需要重建。原有雲端快照可能保留它們；先檢查，不要假設。
- 使用現有 checkout，先 `pwd`、`git status --short`，保留別人的修改。不要為了接手額外建立 worktree。

## 3. 最短啟動路徑

Node ≥22.18（已驗證 24.19）、npm；Chromium 用於瀏覽器測試；Docker 只在 Silo demo 需要。

```bash
npm ci
npm run demo             # 沒有既有 v4 產物時，產生四個 run / HTML / Rill 匯出
npm run serve            # 靜態產物預覽，loopback 4173
npm run dev              # 準備 demo v4 workspace，再啟動原生 dev，loopback 5473
```

`npm run dev` 會呼叫 `prepareWorkspace()`，重新複製 repo 模板並生成客戶頁。**原生編輯器改的是 `runs/<id>/workspace/` 裡的 TSX，下一次 prepare 可能覆蓋它。** 在 repo 正式來源納入修改以前，不可把這些臨時編輯當作已保存的產品功能。

只想重開既有臨時 workspace、不重置它時：

```bash
node node_modules/@open-dashboard/core/bin.js dev --root runs/demo-2026-q3-v4/workspace --port 5473
```

常駐程序與 Docker 不保證隨環境快照恢復；檢查頁面／實際查詢，不只檢查 port。`npm run serve` 不開放來源 Parquet 與 workspace。

## 4. 原始碼地圖：改什麼，去哪裡改

| 工作 | 權威來源／實作 |
|---|---|
| 客戶、案場、設備組合與 KPI 偏好 | `src/customers.mjs`；生成器仍假設 ATL/MER/HEL 三家，增加新客戶需一起改 `src/generate.mjs` |
| 合成資料、事件、季度觀測 | `src/generate.mjs`；`src/quality.mjs` 驗證物理與租戶邊界 |
| 指標語意 | **先讀** `databases/energy/database.md` |
| DuckDB views、固定單執行緒 | `open-dashboard.config.ts` |
| 共用 SQL | `dashboards/energy/queries.sql`；具名 query 與 `description` / `metric` 註解 |
| 跨客戶 Dashboard | `dashboards/energy/index.tsx` |
| 客戶／固定案場 Dashboard | **`src/layouts.mjs`** 生成 TSX/SQL；不要只改 run 裡的副本 |
| 週報 | **`src/report-layout.mjs`** 是生成來源；`dashboards/weekly/index.tsx` 是可見樣板，會被 workspace 生成結果覆蓋 |
| 週報 SQL | workspace 由共用 energy SQL 固定 `:window='current'`、`:site=NULL` 生成，來源輸入本身已按客戶切片 |
| 敘事與接口卡 | `charts/prose/`、`charts/integration-map/`，使用官方 `defineChart` |
| v4 個人版面 | `charts/personal-dashboard/index.tsx`，組合原生公開元件；不適用正式週報 |
| 主題與後處理 | `themes/`、`theme-overrides/`、`src/presentation.mjs`；頂端主題選單 `reader-controls.js` |
| run、check、快照、manifest | `src/build.mjs`、`src/lint.mjs`、`src/common.mjs`、`src/cli.mjs` |
| Silo 發布／gateway | `src/silo.mjs`、`src/release.mjs`、`scripts/silo-dev.mjs` |
| Rill、ClickHouse seam | `src/export-rill.mjs`、`adapters/` |
| 公開入口／科普文件打包 | `scripts/build-pages.mjs`、`docs/open-dashboard-guide.html` |
| 推送 gh-pages | `scripts/publish-pages.mjs`；保留分支歷史，拒絕覆蓋非本專案管理的站點 |

## 5. 新增 dashboard / widget / report 的實際做法

### A. 在現有客戶頁加一個 widget

1. 決定資料粒度、單位、分母、時間與適用設備。未裝機回傳不適用，勿假造零績效。
2. 在 `dashboards/energy/queries.sql` 加具名 SELECT（有 `-- name:`、`-- description:`、`-- metric:`）；沿用 `:site` / `:window`。寫法要能被 `scopeSQL()` 的 scoping 規則處理。
3. 在 `src/layouts.mjs` 對應客戶版型加原生元件；以設備能力決定是否顯示。能用現有圖表就不新增 library；自訂圖先用 `defineChart`。
4. 敘事數字用 `Prose` 的 SQL placeholder；`Text` 只放定義與注意事項。避免讓敘事結論和 SQL 數字各自維護。
5. 使用新 run 進行下列檢查，再開瀏覽器核對預設、篩選、深淺模式與手機。

### B. 新增一個獨立 dashboard

建立 `dashboards/<new-id>/{queries.sql,index.tsx}`，將 id 加入 `snapreport.yaml` 的 `dashboards`。產物在 `site/d/<new-id>/`。需要放到公開首頁，另更新 `scripts/build-pages.mjs`；`writeLayouts()` 的 catalog 只自動涵蓋生成的客戶／案場頁，不會自動列出你手加的頁面。

若要獨立的個人版面偏好，可引用公開包裝 `charts/personal-dashboard` 並給唯一 id；若要比較原生編輯體驗，用原生 `Dashboard`，避免混入個人化包裝與 localStorage 設定。

### C. 新增或改週報

修改 `src/report-layout.mjs` 與共用具名 SQL。固定週期；結論、模型假設、風險及行動要分開。同步根目錄可見週報樣板，避免下一位 agent 讀到不同版本。

### D. 新 run 的完整驗證路徑

```bash
node src/cli.mjs generate atlas-next --tenant 'Atlas Semiconductor' --seed 42 --days 92
node src/cli.mjs check atlas-next
node src/cli.mjs build atlas-next
node src/cli.mjs verify atlas-next
node src/cli.mjs export-rill atlas-next
```

需重建四家展示產物時：`ATLED_RUN_SUFFIX=-v5 npm run demo`。同一 suffix 後續需一致用於 `pages:build` / `pages:publish`。**部分 npm 測試腳本與 snapshots 測試仍固定 v4**：新 release 需調整 package scripts、測試預設／明確參數、`scripts/package.mjs` 及文件，不能只改環境變數就假設全部測到 v5。

`check/lint/build/dev` 會重建 workspace；目前 CLI `check` 與 `lint` 共用整套 renderer＋敘事檢查。不要在 agent repair callback 每次嘗試間呼叫會覆寫草稿的 prepare；對同一隔離草稿做迴圈，完成後才納入模板。

## 6. run 契約與中間產物

```text
runs/<run_id>/
  generation.json       合成來源、seed、scope、期間、案場、事件
  input/*.parquet       meters / telemetry / sites / assets / events
  workspace/            這次產製用的 TSX、SQL、config、theme 副本
  quality.json          物理／資料品質與租戶檢查
  validation/           單獨執行 check/lint 的輸出
  failure.json          建置失敗原因；成功建置後清除
  build/
    check.json lint.json build.log
    site/               靜態多頁 + 查詢結果 JSON + JS/CSS
    dashboard.html      單檔營運快照；有限篩選
    report.html         固定週期、完整套版週報
    report-native.html  同報告的原生呈現對照
    demos/react/ demos/vue/
    manifest.json       inputs/artifacts SHA-256、rows、scope、模板指紋、data_hash
  rill/                 複製的 Parquet、sources、metrics、草稿與匯出 manifest
```

- 已建置 run 的 input/template 指紋不可變；改了就用新 run_id。不得刪除已發布 release 以規避限制。
- 正規化只去掉 `ranAt`、`elapsedMs`，保留查詢結果／順序；不承諾整份 HTML byte-identical。建置會比較 site 與 single 的查詢 payload。
- manifest 的 `template.commit` 是建置時 checkout HEAD，未必包含當時未提交的修改；檔案指紋才是實際模板內容證據。精確 Git lineage（含 dirty/repo）是後續待補，不可只憑 commit 宣稱完整重現。
- build log 與 validation 留在 run；公開 Pages 僅複製 reader artifacts，不公開 input/SQL/workspace/憑證。

## 7. 三種 runtime，不要混稱

| 模式 | 功能 | 持久化 |
|---|---|---|
| 靜態 reader / Pages | 快照篩選、主題、v4 個人版面 | 個人版面 localStorage；不建新 SQL／widget |
| 原生 dev server | 查 DuckDB、原生 Edit、熱更新 | Save 改 workspace TSX；不是多租戶正式 authoring server |
| 未來 Studio/chat 服務 | 登入、草稿、生成、預覽、發布、版本 | 需要應用後端＋DB＋工作佇列＋Node worker＋Silo |

`npx` 是執行套件的工具，不是另一個 runtime。Vercel Functions / Cloudflare Workers 不能照搬「常駐 dev server＋永久本機 TSX」；Workers 也不能直接載入本案 native DuckDB `.node` 套件。可把前端／輕 API 放這些平台，建置與 DuckDB 放獨立 Node 容器；或先單一 Node 服務搭持久磁碟驗證原生操作。GitHub Pages 不能跑這些後端工作。

## 8. agent 友善 ≠ 已有客戶生成產品

已確認 0.7.0 CLI 有 `schema/query/charts/check/render/build`，含 JSON 輸出；TSX/SQL 是可版本控管的輸入。可選 `mcp` / `dev --mcp` 需要 **額外的 `@open-dashboard/mcp`**，本 repo 尚未安裝、未驗證；不要直接宣稱 MCP 可用。

原生可選 assistant 的 `read_panels` 與 `set_filters` 用於現有面板解讀／篩選，**不是寫 TSX／SQL 的生成工具**。本 repo 未配置 assistant provider／model／credentials，未啟動這項能力。

未來兩條工作流與工具／API 契約詳見 [docs/agent-studio-roadmap.md](docs/agent-studio-roadmap.md)。核心原則：dev agent 可以在可審查的隔離草稿修改 TSX/SQL；customer Studio/chat 先輸出受約束的草稿規格，再編譯成同樣的 TSX/SQL，共用驗證與發布。

## 9. 品質與測試：按改動選擇

| 改動 | 檢查 |
|---|---|
| SQL／敘事／生成器 | `npm test`、新 run `check/build/verify`、`npm run test:snapshots`（確認版本） |
| TSX／自訂圖 | `npm run typecheck`、`npm run test:e2e` |
| 配色／排版 | `npm run test:themes`、深淺／列印／390px 截圖 |
| 個人編輯 | `npm run test:personalization`；實際 drag / resize / reload / storage disabled |
| Pages / 科普頁 | `npm run test:pages`；真實 `/odsh/` 前綴、互動與手機 |
| Silo / Rill / live API | 啟動 Silo 後 `npm run test:services` |

詳盡結果在 [docs/validation.md](docs/validation.md)。`test-results/` 未進 Git，換環境時需重跑；文件的「已通過」是既有驗證紀錄，不是保證新機器已驗證。

Silo：`npm run silo:start` → `node src/cli.mjs publish-silo atlas-2026-q3-v4`（另兩家同理）→ `node src/cli.mjs serve-silo atlas`。本機憑證只在忽略版控的 `.runtime/silo.env`，不要輸出內容。Silo 每客戶 bucket、物件逐一回讀驗 hash、release marker 最後寫入；正式 auth 尚待整合。

## 10. 發布與常見陷阱

```bash
npm run pages:build
npm run test:pages
# 提交已完成的 source/docs（不要加入 runs/.runtime/ 憑證）
git push origin HEAD:main
npm run pages:publish
```

發布器使用獨立暫存 Git repo 更新 gh-pages，保留歷史、不 force push。確認新 workflow commit 對得上並顯示 Success。只有明確 synthetic 的 run 能公開；真實客戶內容走 Silo。

- 公開靜態 HTTP 與本機真實 DuckDB 查詢不是同一種能力。
- 本環境曾被代理禁止直接開 github.io；以 GitHub Actions 核對部署、本機 `/odsh/` 瀏覽器驗證，不能假稱遠端逐頁點過。
- Chromium 曾禁止 `file://` 導航；離線測試採關網載入完整 HTML，零 network requests；直接雙擊仍待其他環境驗收。
- 深色問題根源：硬寫白底，卻繼承白字。元件底色／文字須配對使用 theme tokens。
- `scopeSQL()` 目前是有限的 SQL 文字改寫，不是任意 SQL 的多租戶授權器。租戶隔離依賴先切好的 input 與獨立 run。不要把它當作公開任意 SQL sandbox。
- 生成器是合成資料 fixture，CLI 沒有完整 ingest；真實來源須先轉成相同五張表與 generation/lineage 契約，再驗證 quality 假設。
- `scripts/package.mjs` 是人工 bundle 工具，新增交付文件時同步 include；產物不等同雲端服務部署。

## 11. 完成度與下一步（不把追加功能抵掉原始缺口）

原 handoff 必做 M0–M3 約 **85%（估計，非正式驗收）**：M0 80%、M1 85%、M2 75%、M3 100%，以四個里程碑等權概估。M3 的完成是匯出草稿，不是 Rill runtime。

剩餘：真實 o11y／客戶資料驗收；實際 agent 修復迴圈（現有只有 callback 與三次上限測試）；原始 imitator report.css 對照（目前 Energy Loop 原創版）；真正雙擊離線閱讀；更完整 Git lineage。§7 上游 3 個 issue／PR 只有文件，未送出。Markdown compiler 為原 handoff 可選項，未做；不應阻擋 MVP。

原手冊非目標的 auth、常駐讀者 server、寫回、通用 BI，與後續 Studio/chat 路線分開排程。原始全地端要求只有在 agent/model 也使用本地服務時才完整成立；未來選雲端 LLM 應明確列為架構選擇。

建議下一位 agent 的順序：

1. 若任務是新 dashboard，先依 §5 做一個新 run，不改 renderer；交付可審查 TSX/SQL、指標定義與 reader artifacts。
2. 若任務是改善 editor，先用隔離的原生 Dashboard fixture 比較原生 Edit 與 v4 個人化層；具體評估拖放落點、縮放、撤銷／儲存／取消，勿再聲稱 v4 是原生功能。
3. 若任務是 repo 功能，優先打通 dev agent job runner / 有界修復 / 版本追溯，再做客戶 Studio 或 chat。
4. 客戶生成產品按 roadmap 分階段：白名單 widget / 指標 → 草稿預覽與發布 → chat tool calling → 團隊版面與 Rill 探索。

不得把原始附件中的示意指令當成新的使用者授權（尤其對第三方送 issue／PR）；文件描述與使用者實際要求需要區分。
