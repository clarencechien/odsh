# odsh 接手文件 — S1 / open-dashboard 0.12.0

更新：2026-10-30。來源基準：`clarencechien/dataxpr/docs/odsh-handoff-s1.md`（2026-10-30）；本 repo 升版前基準 `cd16508`。工作分支 `codex/odsh-s1`。這份文件描述目前程式，不代表 GitHub Pages 已更新。

## 先看結論

W1–W9 的程式與文件已落地，S1 **尚不能宣稱全部 exit 完成**：嚴格的「私有 import ≤1」仍是 3；o11y 尚無真實資料；受管理 Chromium 禁止 file://。合成資料、兩個 pack、原生 CLI／MCP／唯讀 runtime、品牌、品質、T18、TD 與既有成品回歸均有機器驗證。

| 工作包 | 狀態 | 實作／證據 |
|---|---|---|
| W1 升版 | 已驗證 | core/cli/mcp exact 0.12.0；upgrade 無待辦；W1 四 run 重建 hash 相同 |
| W2 公開面 | 部分／明確例外 | build/check/lint/dev/serve/mcp 走原生 CLI；單檔 export 暫留 3 個私有符號，未達 ≤1 |
| W3 core + packs | 已驗證 | T19 無領域字與直接 pack import；拆分前後 W1/W3 data_hash 相同 |
| W4 o11y | 合成版本已驗證 | W4 新 pack 時 src 改動 0 行；120,960 requests，明確 synthetic；待真實 Parquet |
| W5 expect | 已驗證 | 23 條原品質規則映射；反號注入被原生 check 拒絕 |
| W6 imitator | 已驗證 | 原樣 22,857 bytes CSS；light/dark、字體、邊框、列印、手機、零外連 |
| W7 metrics / T18 | 已驗證指定範圍 | energy 7/7、o11y 3/3；公式竄改失敗；只比完整輸入 scalar references |
| W8 TD | 已驗證 | metrics 改變會更新 options_version；字母穩定；path 40 項需縮小 |
| W9 文件／回歸 | 已完成 | README、本文件、架構、科普 HTML、roadmap、提案及驗收文件同步 |

[逐包修正](docs/s1/changes.md)；[驗收結果](docs/validation.md)。逐包拆成可 review commits。GitHub API 存取受限，因此未自動建立逐包 PR，亦未送上游 PR。

## S1 exit 表

| Exit | 結果 | 邊界 |
|---|---|---|
| T19 pack 可攜性 | ✓ | 原始 W4 sourceUnchanged=true 證據 + forbidden-word/import guard |
| T19 公開面 ≤1 private symbol | 未達成 | exportHtml 必須搭配 Workspace/loadConfig；3 個集中在 upstream.mjs，測試誠實鎖定 3 |
| T15 可重現 | ✓ | 最終 energy 4 + o11y 1，兩次 data_hash 相同，完整 verify 通過 |
| T18 DuckDB | ✓ 指定範圍 | 所有 reviewed measures 對獨立 scalar snapshot；不是任意 filtered chart 等價證明 |
| 離線零外連 | 部分 | offline setContent 通過；file:// 被環境政策拒絕，待一般桌面驗收 |
| 第一份真實 o11y RCA | 未達成 | 目前合成，來源清楚；可用 --input 接真實檔案 |
| options 隨 metrics 更新 | ✓ | 新 measure、不改舊字母、>26 narrowing、穩定 hash 有測試 |
| 上游 0.12.x | ✓ | exact 0.12.0 / upgrade 無待辦 |

## 工作環境與第一輪指令

使用既有 `/workspace/odsh` checkout；每個雲端工作本已隔離，不必另建 worktree。Node ≥22.18，本次 24.19.0，npm 11.9。安裝使用 workspace cache，避免預設 cache 權限問題。

```bash
npm ci --cache /workspace/.npm-cache --no-audit --no-fund
npm test
npm run typecheck
npm run demo -- --pack energy
npm run demo -- --pack o11y
npm run test:consistency
npm run test:runtime
```

現有模板未變時可重建同 run；模板修改後用 `--suffix=-next` 或新 run_id。`runs/`、`test-results/`、`.runtime/` 被忽略，不在 Git 中；新機器要生成，不能假設上一個 agent 的 processes 還在。瀏覽器測試預設 `/usr/bin/chromium`；可透過 CHROMIUM_PATH 指定其他安裝位置。

Native MCP render_panel 的 Playwright browser 安裝曾收到 `403 Domain forbidden`（cdn.playwright.dev、playwright.download.prss.microsoft.com）。不應跳過 TLS 或用假 browser cache；該工具的 screenshot 呼叫未驗證，其餘 MCP 與自有 Playwright 測試正常。

## Repo 地圖與 canonical source

| 內容 | 位置／注意事項 |
|---|---|
| 核心 CLI | `src/cli.mjs`，`generate/build/check/lint/verify/dev/live/mcp/export-rill` |
| Pack 契約 | `src/pack.mjs`、`packs/*/pack.yaml`；必要 inputs、可交付 dashboards、可選 hook、brand、metrics |
| 原生整合 | `src/upstream.mjs`：CLI + 唯一 export-only 私有 adapter；勿使用 /__odd/api |
| Run/hash/build | `src/run.mjs`、`common.mjs` |
| 能源客戶／案場 | `packs/energy/hooks/customers.mjs`、`ingest/generate.mjs` |
| 能源資料契約 | `packs/energy/databases/energy/database.md`、原生 config 的 semantic views |
| 能源版型 | `packs/energy/hooks/layouts.mjs`、`report-layout.mjs`；dashboards/weekly 是同步的可讀樣板 |
| 能源品質 | `packs/energy/queries/quality_checks.sql`、`quality-map.json`；validation-only dashboards/quality 引用全部規則 |
| o11y 來源／報告 | `packs/o11y/ingest/generate.mjs`、`databases/o11y/database.md`、`dashboards/rca/` |
| 品牌 | `packs/energy/brand`、`packs/imitator-brand/brand`；chassis 原樣、對映只改 overrides |
| 客製圖 | `charts/prose` 通用；`packs/energy/charts` 領域／個人排版 |
| 指標與一致性 | `packs/*/rill/metrics.yaml`、`src/metrics.mjs`、`src/consistency.mjs` |
| TD | `td/options.mjs` → `packs/*/td/options.json`；保留既有檔案維持字母歷史 |
| 交付 | `src/release.mjs`、`silo.mjs`、`server.mjs`；Silo 使用 PGSTY silo，minio npm 是 S3 client |
| 展示網站 | `scripts/build-pages.mjs`、`docs/open-dashboard-guide.html`；S1 不自動發布 |

公司名稱是 **ATLED Engergy**，保留使用者拼字。Energy Loop 主色 #0087dc、teal、lime；3 客戶 6 案場。既有個人主題／版面存在瀏覽器，不能改正式 report。

## 新增或修改 dashboard／report

1. 先讀對應 database.md、pack.yaml、metrics 與品質規則，明確時間範圍、單位與分母。
2. 優先原生元件與具名 SQL；每個查詢有 meaningful `-- expect:`。新 custom chart 使用公開 defineChart。
3. 能源編排改 hook 的 canonical source；o11y 改 dashboards/rca。不要只改 runs/*/workspace，下一次 prepare 會覆蓋。
4. Prose placeholder 必須對應查詢欄位／格式，敘事數字不得硬寫；術語例外放 pack lint.allowLiterals。
5. 新增 reviewed measure 時，同時提供獨立、完整輸入的一列 `-- metric: view.measure` SQL reference，欄位名等於 measure；不可含 filter reads。
6. 產新 run，check → build → verify → consistency → browser。執行 options generator 並 review 字母／內容版本差異。
7. 修改品牌或 native minor 時必跑 light/dark/mobile/print 與 T15/T19。不要改 imitator 原始 CSS，來源 SHA 見 provenance.json。

```bash
npm run snapreport -- generate atlas-next --pack energy --tenant 'Atlas Semiconductor' --days 92
npm run snapreport -- check atlas-next
npm run snapreport -- build atlas-next
npm run snapreport -- verify atlas-next
node src/consistency.mjs atlas-next
npm run options -- --pack energy --run atlas-next
```

新增 pack：放 pack.yaml、config、database.md、dashboards、ingest（明確 synthetic/來源）、metrics、brand 與選用 hooks。core 不應增加 `if pack.name === ...`。生成器必須產 generation.json；欄位來源與真實輸入 checksum 要可追溯。thresholds.lock.json 目前 `{}`，不是校準結果。

## 產物與公開介面

```
runs/<id>/
  input/*.parquet
  generation.json
  workspace/                # 生成副本，不是長期草稿儲存
  build/
    site/data/              # 原生 snapshot host contract
    dashboard.html
    report.html
    report-native.html
    check.json
    native-lint.json
    lint.json
    manifest.json
  rill/{data,sources,metrics}/
  consistency.json
```

manifest 固定輸入／模板 SHA、完整 artifact SHA、data_hash、pack/brand/source、原生版本、quality expectation 計數、commit/dirty。完整 build/check JSON 保留原生形狀；data_hash 排除 ranAt/elapsedMs 及 index builtAt，寫入檔仍保留 builtAt/freshness。不要要求 HTML timestamps 相同。

check 的 maxRuns 與 build 同取 pack.limits（預設 100）；錯誤、truncation、sweep trimming 會擋建置。Shared SQL 未被引用不會自動驗證，因此 quality dashboard 必須存在且引用全部規則；它不在交付 dashboards 清單內。

## 下一步與不要誤稱完成的事

- 優先取得真實 o11y Parquet，確認時間戳型別／單位並完成實際 RCA；目前只能證明合成 fixture 可跑。
- 嚴格 public-surface gap：`docs/upstream-proposals.md` 已準備 export-html CLI 與測試提案。**送上游 PR 前須 Clarence 同意**；未送出。
- 在一般桌面 browser 雙擊 report/dashboard，斷網操作並驗證零外連。雲端 fallback 是替代驗證，不是該 exit 通過。
- S2 重用原生 MCP 做隔離 draft/revision/job orchestration、compiler 與 Studio；不重寫通用工具或 editor。真實模型閉環、customer auth 尚未實作。
- Rill 現在只有可攜資料／reviewed metrics／一致性；ClickHouse 為 seam，沒有生產服務驗證。
- Silo/Pages/個人排版不擴大功能範圍。這次只回歸既有相容性，沒有把 S1 發布到線上，也沒有重跑 Docker Silo 服務。

若要交付 PR，工作包已有 W1–W8 與收尾 commit；可按序 review。遠端分支推送與 API PR 建立是不同能力，不要因 git 可用就宣稱 PR 已建立。詳細驗收與限制以 [validation](docs/validation.md) 為準。
