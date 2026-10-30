# S1 升級與薄殼化 / 2026-10-30

依據 [dataxpr S1 handoff](https://github.com/clarencechien/dataxpr/blob/main/docs/odsh-handoff-s1.md)。保留能源展示與快照交付，將引擎責任交回原生能力；不 fork，不實作 S2 compiler/agent 或 S3 ClickHouse。

這是依工作包與時間排列的歷史紀錄；W9 的「未發布」描述的是當時狀態，後續已取得發布授權。當前狀態以 [發布指南](../deployment.md) 與 [驗收文件](../validation.md) 為準，原始 JSON 證據不覆寫。

## W1 — open-dashboard 0.12.0

- core / cli / mcp 精確固定 0.12.0；DuckDB 原版 1.5.6-r.1 符合 upstream optional peer，沿用。
- `upgrade` dry-run 只有 `record-version` 待辦；`--write` 記錄 `openDashboard.version`。skills / version-range 已符合，無 migration 或手動修復待辦。
- config 與 snapreport 設定 `timeZone: Asia/Taipei`。單檔結果形狀與 query JSON 延續；`dashboards.json` 新增 `builtAt`、sources/freshness。
- 資料 hash 排除索引根層 `builtAt`，仍包含 freshness 與查詢資料；`ranAt` / `elapsedMs` 仍會變，保留時間正規化。磁碟上的索引保留 builtAt 給原生 host refresh。完整 artifacts checksum 不去掉任何 bytes。
- 驗證：18 tests、typecheck、四 run build/verify、守恆／成本橋接通過；四 run 第二次 build 的 data_hash 均一致，見 `w1-evidence.json`。
- 舊版與 0.12 的索引 schema 不同，不能宣稱跨 minor 完整 data_hash 相同；接下來 pack 搬移以本次基準與查詢 payload 比對。

## 已確認的介面限制

0.12 的 `exportHtml(workspace, id, ...)` 需要 `Workspace` / `loadConfig`；「只保留 exportHtml 一個非公開符號」按原簽章做不到。暫將三個符號集中在 `src/upstream.mjs` 的單一匯出通道，其他功能改走 CLI。此差異須在嚴格 S1 exit 保留缺口；不以 namespace import、動態字串或仿造 Workspace 隱藏依賴。

## W2 — 原生 CLI 邊界

- build / check / lint 改走安裝版 CLI；check 預設遍歷所有篩選組合，另保留原生 lint JSON。dev 啟動原生 `dev --mcp`。
- 所有 production 非公開 import 集中 `src/upstream.mjs`，僅供 single HTML 匯出使用。測試精確列出三個符號，不掩蓋嚴格 ≤1 缺口。
- 驗證：19 tests 通過；Atlas 原生 all-params check 與原生 lint 執行完成。MCP runtime 在 S1 統一煙霧測試驗收。

## W3 — core / pack

- `src/run.mjs` 只管理 run 契約；`pack.mjs` 載入必要輸入、模板、品牌、hooks、預設頁及發布範圍。核心沒有能源禁字或直接 import packs。
- 能源生成器、客戶／案場版型、品牌、指標 YAML 與 iframe demo 搬進 `packs/energy`；通用 Prose 留在 charts。舊 quality 暫留 pack hook，W5 以原生 expect 完整替換。
- CLI 支援 `--pack`；`live` 委派唯讀原生 serve，`dev` 啟用原生 MCP，靜態 run 索引仍用受限的 reader server。
- 原本硬寫在 Rill exporter 的指標改為 pack 檔案；無價值的預彙總 drafts 在這次拆分時一起移除，W7 補跨層一致性驗證。
- 驗證：四 run data_hash 與 W1 完全相同（`w3-evidence.json`）；T19 禁字／直接 import 測試通過。

## W4 — 第二場景 o11y

- 新增獨立 pack：120,960 筆、三服務、十四天的可重現請求情境，RCA 頁可篩服務；資料契約與來源標記跟著產物走。
- `generate <id> --pack o11y --input <file.parquet>` 可匯入符合欄位的實際 Parquet，保留原檔 bytes 與來源 checksum；本次未取得真實資料，只驗證合成場景。
- 新增 pack 時 `src/` 修改行數為 0，檔案雜湊亦相同。build / verify / native all-params check 通過；六項瀏覽器／交付檢查通過（`w4-evidence.json`）。
- 此環境 Chromium 的 `file://` 導航仍被管理政策阻擋；測試改用關網 setContent，實測服務篩選、手機與零外連。嚴格「直接開檔」驗收仍列缺口。

## W5 — 原生 expect 取代 quality engine

- 刪除自製 quality runner 與 validate-data 命令；23 條舊規則逐條轉成 `queries/quality_checks.sql`，對照在 `quality-map.json`，容差以 residual + between 表達。
- 原生 check 會跳過未引用的 shared query，因此新增僅供驗證的 quality dashboard，以原生 `-- uses:` 觸及全部規則；它不在交付 dashboard 清單中。沒有依賴自寫 SQL 品質引擎。
- 所有能源查詢補上符合粒度／設備可用性的 expect；來源標為 static。check 的錯誤、截斷與 trimming 會阻擋建置。
- 移除未接 agent 的三輪 callback；S2 修復應使用原生 MCP 的 check/lint/render，而非另一層偽自動修復。保留原生尚未支援的 Prose placeholder／格式／敘事裸數字檢查（`lint-prose.mjs`）。
- 驗證：18 tests 全通過；23 條 input 規則確實執行；反號購電功率使原生 q_energy_balance expectation 失敗。這不是只檢查 SQL 存在。

## W6 — 原樣 imitator chassis + 獨立 brand pack

- 新增 `packs/imitator-brand`；22,857-byte `report.css` 原樣內嵌，SHA、來源 commit 見 `brand/provenance.json`。o11y 報告預設使用此品牌，Dashboard 保留操作介面。
- 通用 `brand.mjs` 注入模板、fingerprint metadata、標題與 CSS；差異全部在 brand pack。0.12 單檔 viewer 仍顯示 header，使用 scoped CSS 隱藏重複標題，未改上游。
- `node --test tests/brand.test.mjs`：1/1；瀏覽器實測 light/dark 背景、襯線標題、卡片邊框、主題切換、390px、列印與零外連。此測試使用 offline setContent，不能冒稱通過受管理瀏覽器禁止的 file:// 導航。

## W7 — reviewed metrics + T18

- Rill 匯出讀 frozen workspace 的 `metrics.yaml`，驗證模板及原始 Parquet hash；不再產 `drafts/MAX(預彙總)`。
- 新增通用 `metrics.mjs`／`consistency.mjs`：simple expression 與 parameterized derived macro；比對獨立 SQL 宣告的 `-- metric: view.measure` 快照，檢查輸入、SQL、快照 checksum 與完整覆蓋。
- `npm run test:consistency`：energy 7/7 measures（77 scalar snapshots）、o11y 3/3（3 snapshots）；各自修改一個 expression 會失敗並指出 measure。`node --test tests/metrics.test.mjs`：derived aggregate、quoted column、NULL、循環依賴皆驗證。
- **界線**：T18 覆蓋完整不可變輸入的 scalar references，不宣稱驗證每一張有篩選的圖表公式；後續需明確定義 filter scope，不能拿完整資料總值比子集合。

## W8 — TD options（尚非 compiler／Studio）

- `td/options.mjs --pack <name> --run <id>` 讀 metrics、原生 `charts --json` 與 Parquet distinct values。輸出固定字母選項、內容 hash `options_version`，刪除的字母保留不重用；新增排序較前的 measure 不影響舊字母。
- >26 個值標 `needs_narrowing`，不截斷。原生 widget 也超過 26，因此提供 widget_group 與分組槽位；o11y path=40，必須縮小。
- `node --test tests/options.test.mjs tests/t19.test.mjs`：3/3。pack options 已產生（energy 18 slots、o11y 16 slots）；`thresholds.lock.json` 維持空殼，未宣稱完成 S3 校準。

## W9 — 收尾、相容性與實際驗收（首次 Pages 發布前）

- README/handoff/architecture/validation/agent roadmap/科普 HTML 全面更新為 0.12 + packs；列出嚴格 S1 的三個缺口、原生 screenshot 環境限制與未部署狀態。移除「MCP 未裝」「仍有 callback」「仍產 Rill drafts」等舊描述。
- 修正 report/default_dashboard 指向同頁時的輸出角色判定；check 與 build 共享 pack maxRuns；manifest 增加 commit dirty 標記。
- 補上原生 `more filter combinations` 警告的阻擋，並實測 maxRuns=1 失敗；widget group 先去重計數，避免把重複分組誤判成 >26。
- 保留舊 release.json 形狀，bucket 由 pack metadata 計算；更新 demo/test/package 路徑，原測試中的私有 dev/query 呼叫改由原生 CLI/MCP smoke。
- 新增 native MCP/serve 與五 run 重建測試。實際結果：unit 22/22、typecheck；runtime 6/6；e2e 15/15；themes 48/48；personalization 12/12；Pages staging 13/13；o11y 6/6；data snapshots 4/4；T18 兩 pack、T15 五 run。完整數據見 validation 與 final-evidence.json。
- 「殼變薄」是責任移轉：刪 custom quality runner、未接線的 repair callback、Rill drafts、domain imports；CLI/MCP/runtime 使用上游。src 實體行數 598→556，另新增 TD 51 行；合計未減少，不能把這當大幅縮碼的宣傳數字。T19 的零領域耦合與唯一 export adapter 才是主要邊界。
- 雲端 start_skill 已更新為目前 pack 路徑與原生 runtime 驗證；安裝腳本保持原有 npm ci。保存草稿不等於發布環境。
- 每個工作包以獨立 commit 留存；GitHub API 受限，未建立逐包 PR。未送上游 PR，未發布 S1 Pages 或外部服務。

## 後續授權 — S1 Pages 發布 / 2026-10-30

- 使用者要求沿用上一版資料發布 S1。比對原 gh-pages `f26697c`：三客戶及 portfolio 的所有 inputs SHA/rows 與 S1 完全相同；保留合成標記。
- 重新執行 Pages 13 項測試全部通過，使用現有 publisher 推送 `gh-pages` 至 `f01815f`（來源 `98a0c1d`），未合併 main 或加入其他場景。
- 遠端 deployment.json、四份 manifest、guide.html 與 staging 逐 byte 相同。環境 proxy 阻擋 github.io，實際部署完成／線上渲染仍無法確認。證據見 pages-deployment.json。

## 文件全面同步 / 2026-10-30

- 更新 README、handoff、架構、驗收、roadmap、upstream 提案、科普 HTML 及兩個 pack 的資料契約；新增文件索引與 Pages 發布／回復指南。
- 統一 S1/gh-pages/main 分支狀態、v4 相同合成輸入、energy 公開／o11y 本機範圍、原生工具能力與尚未驗收項目。歷史 JSON／品牌 provenance 保留原值。
- 修正科普頁連到舊 main 的文件連結、已不存在的草稿格式／API 文件描述、input 步驟誤列 build/check 產物、公開 URL 與 frozen run 生命週期混淆，以及資料契約中的搬移前路徑與 Rill drafts 描述。
- 說明 database.md 參與 template fingerprint；既有成品可直接 verify／發布，後續 build 或會 prepareWorkspace 的命令須選新 run。
- 文件驗證：11 份 Markdown 的 59 個本機連結全部有效；更新後的科普指南通過既有 Pages 13 項瀏覽器檢查（含主題、列印、手機與無 JavaScript）。此輪只修改文件，未重建或更換已發布能源資料。
