# 驗證紀錄 — S1 / 2026-10-30

環境：Node 24.19.0、npm 11.9、DuckDB node-api 1.5.6-r.1、open-dashboard core/cli/mcp **0.12.0**、系統 Chromium。以下是本次實際執行結果；不沿用先前版本的服務通過數。

機器證據：[final-evidence.json](s1/final-evidence.json)。W1、W3、W4、W6、W7 的歷史 checkpoint 證據分別在 `docs/s1/w*-evidence.json`；W4 的 sourceUnchanged=true 專指新增 o11y pack 那一個工作包，不要求後續 core 永遠不改。

| 指令／驗收 | 結果 | 驗證內容 |
|---|---|---|
| `npm test` | **22/22** | 原測試、native expect 與反號拒絕、真正 CLI trimming、T19、private adapter guard、imitator 瀏覽器、derived metrics、TD 更新／narrowing |
| `npm run typecheck` | 通過 | 兩個 pack、通用 charts、生成 hook 來源的型別邊界 |
| `open-dashboard upgrade --json` | 無待辦 | 0.12.0 → 0.12.0，skills/version-range ok |
| `npm run demo -- --pack energy` | 4 run 成功 | portfolio + Atlas + Meridian + Helios；native all-params/check/lint、HTML、Rill export |
| `npm run demo -- --pack o11y` | 1 run 成功 | 120,960 rows、3 services、40 paths、合成來源 |
| `npm run test:reproducibility` | **5/5** | 同輸入／模板重建 data_hash 完全相同，artifact/input verify 通過 |
| `npm run test:consistency` | **2/2 packs** | energy 7 measures / 77 scalar snapshots；o11y 3 / 3；各一個 expression +1 會失敗並指出 measure；無 Rill drafts |
| `npm run test:runtime` | **6/6** | 原生 MCP 27 tools，list/read/check(all_params)，原生唯讀 serve 真實 DuckDB 篩選，來源未改動 |
| `npm run test:e2e` | **15/15** | 三家差異版型、六案場、離線篩選、固定週報、React/Vue、租戶不洩漏、手機、來源拒讀、零 runtime errors |
| `npm run test:themes` | **48/48** | 三客戶 × 四種 reader view × 四種系統／個人主題組合；實際文字對比 ≥4.5，另測列印 |
| `npm run test:personalization` | **12/12** | 拖曳、resize、隱藏、鍵盤、持久化、重設、手機、壞設定與 storage 被擋；正式 report 不受影響 |
| `npm run test:pages` | **13/13** | 僅本機 staging；/odsh/ 路徑、guide links、六步驟、兩路線、主題、列印、手機、無 JS、零 missing resources |
| `npm run test:o11y` | **6/6** | 合成標記、checksum、all-params、離線 checkout 篩選、手機、零外連／錯誤 |
| `npm run test:snapshots` | **4/4** | 能源流平衡、成本 bridge、不同客戶事件／PUE／availability；這是資料測試，不是 file:// 測試 |
| `node td/options.mjs ...` | 兩 pack 成功 | energy 18 slots、o11y 16；完整 catalog >26 時使用分組；path=40 需縮小 |
| `stageRelease` 本機 smoke | 通過 | Atlas 重複 staging 相同 scope/bucket/hash；未接 Silo 服務 |
| `git diff --check` | 通過 | 無 whitespace error |

## 核心修正的對照驗收

- **W1**：升版前後快照 JSON 結構確認；dashboard index 新增 builtAt/freshness，舊 ranAt/elapsedMs 仍存在。保留檔案 metadata，只從 data_hash 投影去除時間欄位。
- **W2**：production 的所有私有 import 集中一處；測試明確是 3 個符號，沒有假裝達成 handoff 的 ≤1。測試中的 renderer/dev 私有呼叫也改成原生 CLI/MCP。
- **W3**：搬 pack 前後四份 W1/W3 data_hash 完全相同；T19 core/td 領域字與直接 pack import 為 0。
- **W4**：新增第二領域時 src 全檔 hash 未改動；真實資料未取得，合成狀態保留。
- **W5**：quality-map 23 條規則都有 native expect；validation-only dashboard 明確引用 shared SQL；注入反號電網輸入，q_energy_balance 被原生 check 擋下。
- **W6**：原樣 CSS 22,857 bytes，SHA256 `d633c9293779209ad6851977145ef6ecb2f2591dc96d65f117ceac82e9502b9f`；light paper rgb(251,251,250)、dark rgb(25,25,23)、serif 標題與兩色邊框實測。
- **W7**：所有 reviewed measures 有完整輸入 scalar reference；derived macros、NULL、quoted columns、cycle failure 有測試。此驗收不涵蓋任意圖表／篩選 scope。
- **W8**：新增排序較前的 measure 不移動舊字母；移除後保留字母不重用；重跑 options_version 不變；>26 不展開。

## 最終資料 hash

| Run | data_hash |
|---|---|
| demo-2026-q3-s1-final | `47c5d1a178991540974aab8b81ad45bb57161a0856262e00b7d8cb37ae645fc4` |
| atlas-2026-q3-s1-final | `a3cdbef088b462489cbfaf1ba08c091ac1e53f7aecb4a5379f0fd4ba4992ce64` |
| meridian-2026-q3-s1-final | `464f50b3efc1095e1adc1cd86040921c9ca8a5fa51cce3c44c7faed91f6befc2` |
| helios-2026-q3-s1-final | `b72643112e38c6947f6f7713ea5699d86b45ef69bf260435af6a513b0dc0dd34` |
| o11y-2026-10-s1-final | `0037eb7489faed2739336d80c5dcbc90a909f44f806c56438bfc2ad78de15b4b` |

## 尚未通過或未執行

1. **嚴格 S1 private symbols ≤1：未達成。** 0.12 exportHtml 需要 Workspace/loadConfig，沒有 CLI/MCP 匯出替代。保留 3-symbol adapter，不 fork、不隱藏依賴。
2. **真實 o11y RCA：未執行。** 沒有真實 Parquet；合成案例不能當真實驗收。
3. **file://：受環境阻擋。** 導航收到 ERR_BLOCKED_BY_ADMINISTRATOR。offline setContent + 禁用網路可驗單檔自包含與篩選，但仍需一般桌面雙擊檔案驗收。
4. **Native MCP render_panel：未執行。** 原生 Playwright headless shell 下載收到 403 Domain forbidden。系統 Chromium 的本 repo 瀏覽器測試通過；不是原生 screenshot tool 通過。
5. **Silo、Rill runtime、ClickHouse、production auth：未執行本次外部服務驗證。** 本機 release staging、Rill 原始資料/SQL/一致性、ClickHouse adapter unit 不能替代服務驗收。
6. **GitHub Pages：後續已推送 S1，但實際上線未確認。** 使用者授權沿用 v4 資料發布；四份 run 的 inputs SHA 完全相同。13 項 staging 測試重新通過，遠端 gh-pages commit `f01815f5d503289acecea7117ee3a61f1bca32b6` 的 deployment、四份 manifest 與 guide bytes 已核對。環境 proxy 阻擋 github.io（403），不能宣稱已完成線上驗證。見 [發布證據](s1/pages-deployment.json)；final-evidence.json 保留發布前的 S1 驗收 checkpoint。

以上限制使嚴格 S1 exit 仍未全部滿足。其他原生 check/findings、測試與可重現性均已完成，不把限制藏成 skipped 測試或粗估百分比。
