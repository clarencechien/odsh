# MVP validation / 2026-10-08

企業名稱：**ATLED Engergy**。日期以 Asia/Taipei 為準。以下是實際執行結果；不是預期測試清單。

## 驗收證據

| 檢查 | 結果 |
|---|---|
| `npm test` | 18 passed、0 failed、0 skipped；含真 DuckDB fixture 與 renderer 壞欄位／trimmed filter |
| `npm run typecheck` | passed |
| `npm run test:e2e` | 15 checks passed；三套客戶版型、六案場、離線 Dashboard 篩選、固定週報、iframe、手機、跨客戶隔離 |
| `npm run test:services` | 9 checks passed；Silo、Rill 指標 SQL、live DuckDB API |
| `npm run test:pages` | 6 checks passed；真實 `/odsh/` 路徑前綴、入口連結、JSON／JS、篩選及 iframe |
| `npm run test:snapshots` | 四份快照能源流向守恆（含來源四捨五入容差）、成本橋接與差異化事件觀測通過 |
| 凍結依賴重装（前版環境驗證） | `npm ci --offline --cache /workspace/.npm-cache` 成功，原生 DuckDB 可從已快取套件重裝 |
| 同 run 重建 | 兩次 `data_hash` 相同；不承諾整份 HTML bytes 相同，建置時間仍保留 |
| 產物檔案 checksum | 四份 run 均通過 `snapreport verify` |
| 資料品質 | 內部 18 項、每客戶 23 項，全部通過 |
| snapshot 量 | 內部 308 個 named queries／1,676 次參數組合執行，最大單 query 21 次；無 filter trim／row truncation |

內部 run：`demo-2026-q3-v2`

```
3f2eef4a700504dfcb69d6e7cfec5e70ef2932f62a755aef1bfc8055eb950a30
```

`test-results/reproducibility.json` 保留兩次 hash；`test-results/e2e.json`、`services.json`、`pages.json` 與 `energy-loop-data.json` 保留分項結果。Screenshots：atlas.png、meridian.png、helios.png、report.png、mobile.png。

## 資料與異常

- 2026-07-01 至 2026-09-30，Asia/Taipei 本地時間，十五分鐘完整觀測。
- 三家客戶、六案場、二十五個已安裝的子系統計量點。
- 52,992 筆 meters、220,800 筆 telemetry、6 筆 sites、25 筆 assets、5 筆 events。
- HEL-1：冷卻劣化；MER-1：逆變器降額；MER-2：充電埠通訊中斷；ATL-1：需量反應；ATL-2：非營業負載偏高。
- 驗證電力供需守恆、負載構成、SOC 遞移／連續性／界限、無同時充放電、無同時進出口、電費及排放帳、時間間隔、夜間無光電、遙測對帳、tenant 隔離與固定 seed 的 Parquet bytes。

## Handoff milestone 對照

| 里程碑 | 實作與邊界 |
|---|---|
| M0 模板與端到端 | DuckDB config、database 語意文件、TSX/SQL、Prose、theme、check、static build、single export、manifest、輸入列數與 hash 已完成。Node 24.19、native DuckDB 與 Chromium 已驗證。使用 npm lockfile，未另造 pnpm lockfile。 |
| M0 可重現／離線 | 同 run 兩次資料 hash 相同；site 與 single query payload 相同。關網載入完整 HTML 後，Dashboard 可切站點／週期，Report 固定範圍，沒有網路請求。管理型 Chromium 禁止 `file://`，因此「在此環境直接雙擊檔案」未驗證。 |
| M0 儲存 | 依使用者要求，MinIO 改為 **pgsty/silo** 真實服務。三個私有客戶 bucket，各 177–178 個產物逐一回讀 checksum；Silo 靜態站與單檔可用。 |
| M0 真實 o11y parquet | 使用者未提供真實資料；本次依需求完成擬真能源合成資料驗證。真實客戶資料接入仍待後續，不以合成資料冒稱實測營運。 |
| M1 oracle | Prose placeholder／格式／裸數字／Text／動態字串 lint，renderer 壞欄位、filter trimming 測試，query error／row truncation 阻擋。最多三次的 repair callback API 與 failure history 完成；CLI 預設不自動呼叫 LLM 修復。 |
| M2 套版與嵌入 | token theme、報告限定 CSS、native/editorial 版本、React/Vue 本地 bundle iframe demo、手機版通過。未提供原始 imitator report.css，因此使用原創 editorial 對映，未聲稱精確還原。可選 markdown compiler 未做。 |
| M3 語意探索 | `-- description`／`-- metric`、SELECT 實際輸出 schema、Rill sources／metrics_view 草稿、可攜 Parquet、純靜態 runs 索引完成。Rill YAML 路徑與七個 interval 指標 SQL 已測；Rill runtime/Cloud 未啟動。 |

三項上游 PR 提案已寫入 `docs/upstream-proposals.md`，未替使用者向外部專案發文或送 PR。

## Silo 實測版本與範圍

- 官方映像：`pgsty/silo:RELEASE.2026-09-03T13-18-01Z`
- 固定 digest：`sha256:b616a0cf8cb281e7e6bb3c9b1fb53875b4016a2878223925541c18f82d6c5ca3`
- Ready endpoint 成功；S3 put/get、內容 checksum、相同 release 重試、匿名拒絕、租戶 gateway 隔離、讀者篩選皆通過。
- 單節點本機 Docker、私有 bucket；不是外部正式環境部署，也未測 HA、異地備援、production auth 或 WORM retention。

## 留待接入的能力

ClickHouse HTTP adapter 已測輸入邊界與解析，並提供原生 datasource config；沒有實際 ClickHouse 伺服器與客戶憑證，未宣稱已接通。Rill 預彙總 query 草稿放在 `drafts/`，不自動啟用，避免把 PUE、可用率與峰值錯誤加總。

所有節省與排放是透明模型假設，不能視為保證收益、正式帳單或碳盤查。客戶站點 Select 是可用性功能；租戶隔離依賴獨立輸入與獨立交付 run。

## Energy Loop 設計驗證

三家各兩案場。Atlas 的 Sankey／契約需量／樓宇熱圖、Meridian 的補能熱圖／狀態時間軸、Helios 的溫度–PUE 散點／冷卻耗能拆解均以原生 widgets 呈現。報告固定週期，使用結論敘事、成本瀑布、前後週 Dumbbell 與行動表。入口、圖表、品牌導覽及週報採 #0087dc、青色與萊姆綠。

本週合成數據：Atlas 模型電費較前週增加約 5.8%；Meridian 充電埠可用率約 96.1%；Helios 模型電費增加約 21.8%，冷卻與非 IT 耗能較前週上升逾 30%。這些差異來自場景與模擬事件，非真實客戶績效。

GitHub Pages 發布沿用已啟用的 gh-pages 分支。環境網路代理不允許直接瀏覽 github.io，因此遠端部署以 GitHub Actions 狀態核對；瀏覽器操作使用相同產物與 /odsh/ 路徑本機驗證。
