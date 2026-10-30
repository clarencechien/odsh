# 文件索引

更新：2026-10-30。這組文件對應 **open-dashboard 0.12.0／S1**，來源分支為 [`codex/odsh-s1`](https://github.com/clarencechien/odsh/tree/codex/odsh-s1)；尚未合併 `main`。公司名稱依使用者指定保留 **ATLED Engergy**。

## 依用途閱讀

| 用途 | 文件 | 內容 |
|---|---|---|
| 安裝與快速操作 | [README](../README.md) | pack、run、CLI、驗證指令與限制 |
| 下個 agent 接手 | [handoff](../handoff.md) | canonical sources、工作包狀態、S1 exit、新頁面與新 pack 流程 |
| 查看成品、更新展示 | [Pages 發布指南](deployment.md) | 公開路徑、資料版本、發布／檢查／回復、來源與產物分支 |
| 認識平台與選型 | [科普 HTML 原始檔](open-dashboard-guide.html)／[展示站指南](https://clarencechien.github.io/odsh/guide.html) | 原生能力、odsh 增加的交付流程、互動流程與產物 |
| 理解核心邊界 | [Architecture](architecture.md) | core／packs、原生 CLI/MCP、凍結快照、品牌、指標與 TD |
| 確認實際完成範圍 | [Validation](validation.md) | 已跑測試、機器證據、未驗收與環境阻擋 |
| 追蹤修改 | [S1 changes](s1/changes.md) | W1–W9 與後續發布／文件更新的時間順序 |
| 規劃 agent 與客戶生成 | [Agent／Studio roadmap](agent-studio-roadmap.md) | 原生工具與未實作的 job/revision/compiler/Studio 邊界 |
| 繼續減少私有依賴 | [Upstream proposals](upstream-proposals.md) | export-html、可重現性、host chrome、defineChart template 提案；尚未提交 |
| 撰寫能源 SQL | [Energy contract](../packs/energy/databases/energy/database.md) | 表粒度、時間、單位、指標分母、23 條品質規則與租戶範圍 |
| 撰寫服務觀測 SQL | [o11y contract](../packs/o11y/databases/o11y/database.md) | request schema、三個指標、合成 incident、真實資料入口 |

科普 HTML 的相對連結以發布後的 `/odsh/guide.html` 為基準；直接開 repo 原始檔時，展示連結可能沒有同層成品。請從公開指南或本機 Pages staging 閱讀完整互動版本。

## 當前狀態

S1 energy 成品已推送 `gh-pages`，沿用上一版 v4 完全相同的合成輸入，包含三家客戶、六案場與公開合成總覽。o11y／imitator 品牌可在 repo 本機建置，未加入目前公開站。遠端分支內容已驗證；此環境無法存取 `github.io`，因此實際部署完成與線上畫面尚未確認。

原生 CLI、MCP 讀取／檢查、唯讀 runtime、品質、兩 pack 指標一致性與讀者回歸已驗證。嚴格 S1 仍缺：私有匯出符號 ≤1（目前 3）、真實 o11y、一般桌面 file://。另有 native render_panel 的 browser 下載限制。發布 demo 不代表這些缺口已解決，也不代表 Studio 或正式服務已部署。

## 證據閱讀方式

- [W1](s1/w1-evidence.json)：0.12 升版後基準；[W3](s1/w3-evidence.json)：pack 搬移前後 hash 對照。
- [W4](s1/w4-evidence.json)：新增 o11y 當時 core 未改動；[W6](s1/w6-evidence.json)：imitator 品牌；[W7](s1/w7-evidence.json)：完整輸入 scalar 指標一致性。
- [S1 final checkpoint](s1/final-evidence.json)：首次 Pages 發布前的完整驗收；當中的「未發布」是歷史狀態。
- [首次 S1 Pages 發布](s1/pages-deployment.json)：來源 commit、v4 輸入比對、遠端 bytes 驗證。
- [Core 尺寸](s1/core-size.json)：實體行數對照；不是功能完成率或全部程式碼縮減率。
- [品牌來源](../packs/imitator-brand/brand/provenance.json)：原始 report.css commit、bytes 與 SHA；不得為了更新文件而改寫。

驗收 JSON 與品牌 provenance 保留原始 checkpoint。新的驗收／發布建立新紀錄，不改舊數字或 SHA。修改 pack 內的 database.md 會改 template fingerprint，重建必須使用新 run ID；已發布 run 的 input/build 保留不變。
