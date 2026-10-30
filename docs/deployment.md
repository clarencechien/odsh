# Pages 發布與版本

更新：2026-10-30。[文件索引](README.md) · [驗收](validation.md) · [接手文件](../handoff.md)。

## 目前發布內容

S1 energy 成品已推送至 `gh-pages`。首次 S1 發布 commit 為 `f01815f5d503289acecea7117ee3a61f1bca32b6`，來源為 `98a0c1d`；上一版是 `gh-pages@f26697c`。三個客戶與總覽的所有 inputs SHA／row count 均相同，沒有換資料、時間範圍或 seed。證據見 [pages-deployment.json](s1/pages-deployment.json)。

- 展示首頁：[https://clarencechien.github.io/odsh/](https://clarencechien.github.io/odsh/)
- 科普指南：[guide.html](https://clarencechien.github.io/odsh/guide.html)
- 部署狀態：[GitHub Actions](https://github.com/clarencechien/odsh/actions)
- S1 原始碼與最新文件：[codex/odsh-s1](https://github.com/clarencechien/odsh/tree/codex/odsh-s1)

| 公開路徑 | 凍結 run | 資料內容 |
|---|---|---|
| `atlas/` | `atlas-2026-q3-s1-final` | Atlas Semiconductor，2 案場 |
| `meridian/` | `meridian-2026-q3-s1-final` | Meridian Logistics，2 案場 |
| `helios/` | `helios-2026-q3-s1-final` | Helios Cloud，2 案場 |
| `portfolio/` | `demo-2026-q3-s1-final` | 3 客戶／6 案場合成總覽 |

各路徑提供 `dashboard.html`、`report.html`、`report-native.html`、`site/`、`manifest.json` 與 React/Vue iframe 範例。案場頁面由首頁各客戶卡片進入。

公開成品使用 **open-dashboard 0.12.0**、**2026 Q3 合成能源資料**。它是凍結快照，不會隨時間更新資料。Dashboard 的篩選選擇預先計算結果；個人版面保存在瀏覽器；固定週報不受個人編排影響。

o11y／imitator 報告未加入這次公開站。MCP、Node/DuckDB runtime、Silo、Rill 與 ClickHouse 服務也不是 Pages 的一部分。公開 bundle 不包含原始 Parquet、SQL、憑證或 workspace。

## 分支與上線狀態

`codex/odsh-s1` 存程式與文件；`main` 尚未合併這次 S1；`gh-pages` 存產出的靜態網站。更新來源分支不會自動發布，推送 `gh-pages` 也不等於已完成 Pages 的建置／部署。

已確認的是遠端發布分支及檔案內容。本環境連線到 `clarencechien.github.io` 會收到 proxy 403，因此沒有線上渲染驗證，也沒有藉此認定 GitHub 部署失敗。使用者可從 Actions 查看實際 deployment 是否成功，再開啟展示網址；若瀏覽器仍顯示舊畫面，可重新整理並比對 `atlas/manifest.json` 中的 run_id 與 open_dashboard。

## 更新網站

使用已建好的 S1 runs 時，不需重新執行 DuckDB build：

```bash
npm run test:pages
npm run pages:publish
```

第一個指令在本機產生 `.runtime/pages-site/` 並驗證 `/odsh/` 路徑、圖表篩選、嵌入、指南、主題、列印與手機。第二個指令重新組裝 staging、驗證合成標記及 artifact hashes，再以非 force push 更新受管理的 `gh-pages` 分支。新增指南文字不會變更既有 input/build。

只改文件時，更新 `docs/open-dashboard-guide.html` 後同樣執行上述指令；publisher 只會提交實際改變的靜態檔。README、handoff 與 Markdown 留在來源分支，指南連結須指向目前的 S1 分支，不能誤導讀者去看尚未升版的 main。

新環境尚無 run，或確實改了模板／資料時，先建立新版本：

```bash
npm run demo -- --pack energy --suffix=-next
ATLED_RUN_SUFFIX=-next npm run test:e2e
ATLED_RUN_SUFFIX=-next npm run test:themes
ATLED_RUN_SUFFIX=-next npm run test:pages
ATLED_RUN_SUFFIX=-next npm run pages:publish
```

`-next` 是範例，重複修改應選另一個未使用的 suffix。`database.md` 也在模板 hash 內；這次文件修訂後，已存在的 `*-s1-final` 不應拿目前 pack 重建。它們仍可 verify、預覽及原樣發布。單一 run 的 `build`／`verify`／`export-rill` 指令請直接傳入相同新 ID。

## 驗證與回復

發布前核對本機測試與公開資料範圍，記錄來源 commit、發布 commit、run_id 和 data_hash。發布後確認遠端 manifest 與 staging 相符，再於可存取 github.io 的環境檢查首頁、三客戶 Dashboard／Report、案場篩選、guide 與 iframe。原始發布 JSON 是歷史證據；只更新指南時另外記錄，不回寫成「原驗收已重新執行」。

run 的 input/build 是凍結版本；公開的 `/atlas/report.html` 等網址則是展示入口，後續發布會替換，不能當永久報告引用。需要永久交付時使用具版本 ID 的 release 並保留 manifest。

若須回復，從 gh-pages 歷史取回已確認的成品，以新的正常 commit 發布並再次驗證；不要 force push 或改掉已建 run 的 checksum。重新建相同 run 可能有不同 HTML 時間 metadata，不應拿它冒充原始發布 bytes。發布工具若拒絕非受管理的分支，先檢查來源，不要移除保護硬推。
