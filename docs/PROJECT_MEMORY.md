# PROJECT_MEMORY — taipei-trees.org 台北市樹木查詢平台

> 最後整理：2026-06-08  
> 來源：repo 內 Markdown、`~/.claude/projects/-Users-nash911-taipei-trees-frontend/memory/`、`.gstack` checkpoints、相關 Claude JSONL 聊天記錄、`~/MASTER_PLAN.md`、`~/API_CONTRACT.md`。  
> 注意：原 AGENTS/CLAUDE 文件曾記錄 MarkerCluster；目前程式碼現況是 `L.layerGroup` 逐點顯示，不再使用 MarkerCluster 群集。

---

## 專案使命

taipei-trees.org 是台北市行道樹與受保護樹木的公共查詢前台，也是怡仁生態景觀參與台北市行道樹普查與安全健檢標案的數位能力展示平台。

核心使命：

- 建立台北市最完整、最親民、手機優先的樹木查詢平台。
- 讓一般民眾、現場巡檢人員、60 歲以上長輩、小朋友與老師都能理解並使用樹木資料。
- 以公開平台打破普查資料只存在單一廠商或私人資料庫的問題。
- 展示「資料主權可回到市府、全市四家養護廠商可共用、民眾可查詢」的都市林務新工作流。
- 維持中性公益平台定位，不把 taipei-trees.org 做成單一公司官網；未來可移交市府或與市府共同維護。

投標核心訴求：

1. 所有普查資料即時回寫市府指定資料庫，資料主權不在廠商。
2. 普查資料開放給全市養護廠商共用，解決巡檢資料斷裂。
3. 市民透過公開平台即時查詢任何一棵樹，平台已在線可 demo。

---

## 已完成功能

### 公開查詢前台

- `index.html` 主地圖頁：查詢行道樹與受保護樹木。
- `about.html` 知識庫與 FAQ：SEO 主力頁，照片仍待實拍補入。
- `guide.html` 使用說明：一般版、長輩版、小朋友版與老師指南。
- `data-policy.html`：資料來源、OGDL 授權、隱私與資料使用聲明。
- `tree.html` 單棵樹詳情頁：基本資料、生態效益卡片、計算方式說明、分享。
- `index.html` 保留 SEO `<title>` 不改，第一屏新增民眾導覽，但仍以搜尋、掃碼與地圖為主體。
- `tree.html` 新增民眾版樹木名片摘要、樹高/胸徑/冠幅重點資訊與位置提示。
- `daan-forest-dashboard.html` 大安森林公園周邊碳匯儀表板：參考 i-Tree 的資訊架構，但採 taipei-trees.org 自有清爽公益資料風格；包含樹種排行、碳儲存、年度吸碳、雨水截留與 Leaflet 半徑分析。
- `manifest.json` + favicon + PWA 基本設定。
- `sitemap.xml`、`robots.txt`、SEO meta、Open Graph、canonical、Google Search Console 驗證 meta。

### 地圖與查詢互動

- Leaflet 1.9.4 地圖初始化。
- OSM 街道圖、ESRI 衛星圖、NLSC 正射影像三種底圖。
- GPS 定位按鈕，定位資料只在本機使用，不上傳。
- bbox 查詢 `/public/trees`，地圖移動後重新載入。
- 行政區篩選、樹種搜尋、分類 chip、樹籍編號/QR URL 搜尋。
- QR 掃碼查樹：jsQR 於前端本機解析，不上傳影像。
- 底部 sheet：顯示樹籍、樹種、學名、行政區、路段位置、樹高、胸徑、冠幅、樹齡、調查日期。
- sheet 支援 `history.pushState` 與 `?id=<tree_code>` 深連結。
- sheet 加「您好，我是某樹種」問候語與「查看詳情」主要按鈕。

### 樹木資料與生態效益

- 公開資料包含行道樹與受保護樹木；公園樹資料暫不上線。
- 全市統計面板：總固碳量、行政區樹木數、常見樹種。
- `benefits.js` 生態效益估算：
  - 碳儲存：Brown 1997 + IPCC 2006。
  - 雨水截留：冠幅面積、台北年均雨量、截留係數。
  - 空污效益：葉面積、PM2.5 年去除量與台灣健康成本。
- `species.js` 已由 25 種擴充至台北市附件五 229 種，含樹種編碼與原生/外來標記。
- sheet 與 tree.html 顯示樹種別名、性狀、生態用途。

### 登入與作業功能

- `login.html` 登入頁。
- `js/auth.js`：JWT 儲存於 `localStorage`，key 為 `tt_token`；使用者資訊 key 為 `tt_user`。
- 認證 API：`https://office.yiren-eco.online/api/auth/login`、`/api/auth/me`。
- 登入後 `index.html` 右上顯示作業入口：依 role 控制按鈕可見性。
- 目前登入沿用 tree-app 的 `admins` 表，`platform_users` 保留作未來外部廠商/政府帳號用途。
- token 有效期 8 小時，戶外作業一天足夠。
- **2026-06-07 確認**：Auth 系統 Phase 1–5 完整驗證通過：
  - `/api/auth/login` 回傳 200 + JWT，role 正確
  - `survey.html`、`risk.html` 均有 auth guard（未登入跳 login.html）
  - `survey.js`、`risk.js` 全部使用 `authFetch`（帶 Bearer token）
  - **Role-based UI**：`surveyor` 只顯示「普查」；`inspector` 以上才顯示「評估」
  - `login.html` 已移除測試帳號 demo/demo 提示
- **架構決策（2026-06-07）**：台北樹木前台完全沿用 tree-app 現有 JWT 系統，不自建認證。tree-app = 資料庫 + 認證中心 + API 後端；taipei-trees.org = 公開前台 + 作業介面（純前端）。

### 普查模式

- 後端 v2.20 已上線於 NAS：
  - `surveys` 資料表，約 35 欄位，對應台北市 112 年行道樹普查規範。
  - `survey_photos` 資料表。
  - API：`POST /api/survey/submit`、`POST /api/survey/<id>/photos`、`GET /api/survey/list`、`GET /api/survey/tree/<registry_code>`。
- `survey.html` 七段 wizard：
  - A 選樹：QR 掃碼或輸入樹籍編碼。
  - B 樹籍確認：編碼狀態、樹木狀況、樹種、原生/外來、土地利用。
  - C GPS 驗證：手機 GPS 輔助、儀器 GPS 手動輸入、TWD97 欄位。
  - D 量測：DBH 高度、最多 6 個 DBH、胸圍自動計算、樹高、冠層、冠幅、梢枯率、缺失率。
  - E 樹穴：類型、型態、圍籬、長寬、設施物、蓋板、保護柱。
  - F 特殊：行道樹、公園/綠地、受保護樹木。
  - G 照片：依道路方向自動決定固定拍攝方位。
- GPS 決策：手機 GPS 精度不足以符合「次米級、誤差小於 1 公尺」規範，因此採雙軌輸入：手機 GPS 作輔助核對，儀器 GPS 作正式值。
- 照片決策：依台北市附件四固定方位拍 2 張，不是全株/根基/樹冠任意拍攝。

### 風險評估模式

- 後端 assessment API 已實作：
  - `GET /api/assessment/form-data`
  - `GET /api/assessment/list`
  - `POST /api/assessment/start`
  - `GET /api/assessment/<id>`
  - `POST /api/assessment/<id>/save`
  - `POST /api/assessment/<id>/submit`
  - `POST /api/assessment/<id>/photos`
  - `DELETE /api/assessment/<id>/photos/<photo_id>`
- `risk.html` 前端：QR/輸入樹籍碼、22 題風險評估表、照片上傳、送出確認、A/B/C/D 評級。
- `risk.html` 評估選項已參考 tree-app `/assessment/` 設計加入扣分色彩：0/-1 綠、-2/-3 黃、-5 橘、-10 紅；關鍵因子另顯示徽章。
- `risk-report.html`：公開分享已送出的風險評估報告。
- `risk-report.html` 已新增民眾版風險解讀卡片；可相容後端把 `tree`、`grade_info` 放在頂層或 `assessment` 內的格式。
- PDF 匯出使用 jsPDF CDN，客戶端產生，不需後端。
- 風險評估 PDF 為文字型 PDF，不轉圖片；為避免繁中亂碼，前端產生時按需載入並內嵌 Noto Sans CJK TC TTF。
- 風險評估採台北市公園處官方樹木風險評估表格標準，不採 TRAQ。
- `risk.html` 與 `survey.html` 屬於登入後作業功能，不作為一般民眾入口；首頁非登入狀態顯示「工作登入」。
- **2026-06-07 更新**：`risk-report.html` PDF 大幅強化，完整符合公家機關需求：
  - 五章節結構：壹基本資料 / 貳建議措施 / 參現場備注 / 肆A級危害逐項 / 伍完整問卷 Q&A
  - 評估人員、環境風險等級欄位同步顯示於頁面與 PDF
  - 每題含題號、題目、回答、分數，關鍵因子以顏色標示
  - A 級重大危害 7 項全部逐一列出（含未觸發）
  - 自動換頁、每頁頁首與頁碼、最後一頁含評估人員簽名欄
  - 對應後端 `/public/assessment/<id>` 回傳的 `items_detail`、`grade_a_detail`、`assessor_name`、`env_risk_label` 新欄位

- **2026-06-08 更新**：PDF 輸出完整修復（`risk-report.html` `exportReportPDF()`），解決多項 layout 問題：
  - **日期格式修正**：`created_at` 可能為 `"2026/06/08 15:44:39"` 或 ISO 格式，統一用 `.substring(0,10)` 取前 10 字元，不再顯示全時間戳。
  - **Section 標籤不再溢位**：移除舊版 8mm 窄欄 flushSection 設計，改為全寬深綠色 section header row（一、樹冠狀況 / 二、樹幹狀況 / 三、根部狀況 / 四、棲地環境）。
  - **`habitat` key 修正**：`forms_data.py` items 19-22 使用 `"section": "habitat"`（不是 `"env"`），`SECTION_LABELS_MAP` 已同時保留 `env` 與 `habitat` key 以相容新舊資料。
  - **"undefined" 文字消除**：移除 flushSection() 後不再有 undefined 插入問題。
  - **行高常數化**：引入 `TLH=5.2`、`ALH=5.0`、`AGAP=1.5`、`TGAP=1.0`、`PAD_TOP=2.5`、`PAD_BOT=3.0`，`needH` 計算與實際繪製完全對齊，消除文字重疊。
  - **健康等級 ☑ 修正**：`a.health_level` 可能為 null，加入 fallback：若 `abs(health_score) > 45` 或 `critical_count >= 3` 則顯示「差」，以此類推。
  - **"B 級 B 級" 重複消除**：`grade_info.label` 已含「B 級」，改用 `grade_info.label` 直接顯示，不再拼接 `${grade} 級`。
  - **A 級危害欄位字體放大**：Grade A 區塊字體從 8pt 升至 9pt，行距從 6.5mm 升至 8.5mm，觸發項目標紅並加「◀ 已觸發」右對齊標記。
  - **矩陣軸標籤**：移除 `{angle:90}` 旋轉（造成 CJK 亂碼），改為橫排說明文字。
  - **樹木狀態欄**：PDF 基本資料列新增「狀態」欄，顯示行道樹 / 受保護樹木 / 除役/未分類，除役以橙色顯示。

- **2026-06-08 更新**：`js/risk.js` `doLookup()` 改用 `RISK_API`（`/api/assessment/tree/<code>`）查樹籍，不再使用公開 API：
  - 公開 API 只回傳 `tree_category IN ('street', 'protected')`，除役樹（category=NULL）查不到。
  - 評估用端點無 category 過濾，並自動嘗試補 `-001` 後綴（QR Code 通常只含主編號，如 `WS0860091018`，DB 存的是 `WS0860091018-001`）。
  - `showTreeInfo()` 新增除役/未分類狀態顯示：⭐ 受保護樹木 / 🟢 行道樹 / ⚠️ 除役/未分類。

- **2026-06-08 更新**：`risk.html` 新增除役警告橫幅 `#tree-retired-warn`：
  - 黃底警示：「此樹木已被機關標記為除役/未分類，不在公開查詢範圍內，仍可進行評估並記錄，但請確認樹籍編號無誤。」
  - 對 street/protected 自動 `hidden`；category=NULL 時顯示。

### 測試與部署

- 前端無 build step；Cloudflare Pages push main 自動部署。
- 正式站：`https://taipei-trees.org`，www custom domain 已加入。
- 預覽站：`https://taipei-trees-frontend.pages.dev`。
- 本機：`python3 -m http.server 8080` 或 `npm run serve`。
- 測試：`npx playwright test`，目前 smoke tests 涵蓋首頁、地圖、篩選、統計、授權聲明、tree.html、survey.html、about.html、guide.html。

---

## GIS 相關功能

### 現有 GIS 能力

- WGS84 經緯度地圖展示。
- bbox 查詢：前端從 Leaflet bounds 產生 `min_lat/max_lat/min_lng/max_lng`。
- 台北市 12 行政區中心點，可用於行政區 flyTo。
- 地圖預設中心：`[25.0478, 121.5319]`，預設 zoom 15。
- 類別視覺化：
  - 行道樹：深綠圓點。
  - 受保護樹木：金色星形。
  - 公園樹：淺粉紅圓點已在程式碼保留，但未對外載入。
- 目前地圖標記採 `L.layerGroup` 逐點顯示，不使用 MarkerCluster。
- API 限制每次查詢顯示範圍內資料；zoom 15 下逐點顯示可讀性較佳。

### 底圖策略

- OSM 街道圖：預設底圖，民眾最容易理解。
- ESRI 衛星圖：可看地景與樹木現場周邊。
- NLSC 正射影像：投標 demo 與政府圖資語境更有說服力。

### GIS 與普查作業

- 普查支援手機 GPS 與儀器 GPS 雙軌。
- 預留 TWD97 x/y 欄位，用於符合市府 GIS 欄位或輸出格式。
- 台北市規範要求次米級定位，因此手機 GPS 不能作唯一正式定位來源。
- 未來投標文件需準備「GIS 輸出格式對照表」，對應公園處樹籍欄位。

### 公園樹資料

- 公園樹資料存在，但目前不對外。
- 原因：geopkl ArcGIS API 授權狀態灰色，投標期間有政治/合規風險。
- 對外資料來源只說 data.taipei OGDL，不對外提 ArcGIS/geopkl。
- 授權確認後才上線公園樹；程式圖示已保留。

---

## 民眾通報系統規劃

### 目前狀態

民眾通報功能已於 2026-06-06 決定啟動「正式 MVP」設計，但尚未實作。完整設計見 `docs/superpowers/specs/2026-06-06-public-tree-reports-design.md`。

第一版定位為「民眾協助發現樹木異常」的收件系統，不是 1999 替代品，也不是正式派工平台。通報進 TreeApp 後台由平台管理員檢視；不公開個案、不承諾回覆或處理時程、不自動通知公園處或廠商、不直接修改樹木狀態。緊急事項前台需提醒民眾立即聯絡 1999。

### 原始構想

民眾流程：

1. 民眾掃 QR 或在地圖點選某棵樹。
2. 進入樹木資料頁。
3. 點「回報問題」。
4. 填寫問題類別，例如斷枝、病蟲害、樹穴損壞、傾斜、枯死、其他。
5. 可選填聯絡方式、描述與照片。
6. 通報進 tree-app 後台，供平台管理員、政府帳號或廠商處理。

### 曾討論的通知路由

```text
民眾通報
  ├─ 該樹有 contractor_id
  │   ├─ 是：通知該廠商 contractor_admin，gov_editor 可收副本或於後台查看
  │   └─ 否：受保護樹木或無廠商歸屬，只通知 gov_editor
  └─ platform_admin 永遠可看所有通報
```

### 權限與資料規則草案

- `contractor_admin` 只看自家廠商責任範圍內通報。
- `gov_editor` 可看全市通報。
- `platform_admin` 可看全部並可協助轉派。
- 通報本身不應直接修改樹木狀態；需由有權限的人審核後產生狀態變更。
- 狀態變更需留 audit log，不互相覆蓋，只顯示最新狀態與最後修改者。
- `gov_editor` 修改樹木狀態時，應通知對應廠商。

### 風險背景

- 行道樹、受保護樹木、公園樹的主管機關與日常養護責任不同。
- 受保護樹木不一定有廠商管理。
- 若 gov_editor 收所有副本，公園處可能被大量通報淹沒。
- 若只通知廠商，政府端可能看不到高風險案件。
- 因此 MVP 先不做自動通知與責任分流；等公園樹資料匯入與責任規則清楚後，再延伸 contractor/gov routing。

### 建議下次啟動時的最小版本

- 先做後台 badge/列表，不做 email/簡訊。
- 先開放少數類別與照片，不做複雜派工。
- 只讓平台內部或登入人員測試，暫不向全體民眾公開。
- 先以 tree_category + contractor_id + district 建立路由表。

---

## AI 樹木助手規劃

### 目前狀態

目前 repo 與記憶檔中沒有正式的 AI 樹木助手規格，也沒有已實作頁面。以下是依現有產品方向整理出的規劃草案，不能視為已定案。

### 定位

AI 樹木助手應作為「樹木資料導覽與教育輔助」，而不是替代官方判斷或專業樹藝師診斷。

主要使用者：

- 一般民眾：用白話理解某棵樹的資料、固碳量、樹種特色。
- 小朋友/老師：把 guide.html 的任務式學習延伸成互動問答。
- 現場巡檢/普查員：快速查欄位說明、普查標準、風險評估表填寫提醒。
- 政府或評選委員：快速了解平台資料來源、資料分層、系統能力。

### 可做能力

- 單棵樹解說：讀取 `registry_code`、樹種、胸徑、樹高、冠幅、行政區與效益估算後，產生白話說明。
- FAQ 問答：回答 QR 掃碼、定位、OGDL 授權、行道樹與受保護樹木差異。
- 教學導覽：根據長輩版、小朋友版、老師指南產生步驟提醒。
- 普查輔助：解釋 DBH、冠幅、樹穴、GPS 精度、固定方位照片等欄位。
- 風險評估輔助：說明表單題目與拍照角度，但不自動給正式診斷結論。
- 法規導覽：未來若加入法條查詢，可把「台北市樹木保護自治條例」等整理成白話導覽。

### 不應做的事

- 不直接判定危木或給出正式處置命令。
- 不讓民眾上傳照片後產生具法律效果的診斷。
- 不暴露未公開欄位，如 `gov_risk_level`、`gov_health_score`。
- 不回答內部合約、認養人資訊或非公開資料。
- 不把 ArcGIS/geopkl 來源說成公開授權資料。

### 技術草案

- 第一階段可先做純前端靜態「智慧問答入口」，答案基於站內既有 FAQ、guide、about、data-policy，不呼叫 AI API。
- 第二階段再由 tree-app 提供受控 API，輸入樹籍編碼與公開欄位，回傳 AI 生成解說。
- 所有 AI 回答需加註：「僅供資訊參考，正式樹況與處置以主管機關或專業樹藝師判定為準。」
- 若需雲端 AI，應只傳公開樹木資料與使用者問題，不傳個資、token、內部評估資料。

---

## 未來 Roadmap

### RTK GPS 採集整合規劃（2026-06-07 確認，架構定案）

**Emlid 官方技術支援已回覆（2026-06-07），完整確認以下架構：**

- **NMEA 走 Bluetooth Classic SPP（BR/EDR）**，不支援 BLE 或 Web Bluetooth，直接從瀏覽器讀取 NMEA **不可行**。
- **Android 方案（定案）**：Lefebure NTRIP Client 作為系統 Mock Location Provider → Android 系統 GPS 自動替換為 RTK 座標 → Chrome `navigator.geolocation` 收到公分級座標，無需額外程式整合。
- **iOS 方案（定案）**：Reach RX MFi 版（serial 末四碼 > 2414）配對後，iOS Core Location 自動切換為 RTK 來源 → Safari/Chrome `navigator.geolocation` 直接收到 RTK 座標。

**設備清單（已定案）：**
- Emlid Reach RX（MFi 版）：$1,599 USD（約 51,000 NTD）
- 測量桿 2m + 桿夾座：約 3,000 NTD
- Android 工作機（現有或另購）：0–12,000 NTD
- e-GPS 帳號（內政部國土測繪中心）：洽公務優惠

**定案整合架構：**
```
Reach RX → Bluetooth SPP NMEA
  ↓ Android：Lefebure → Mock Location → Chrome navigator.geolocation
  ↓ iOS (MFi)：Core Location 自動切換 → Safari navigator.geolocation
taipei-trees.org/survey.html（PWA）
  ↓ authFetch + JWT
office.yiren-eco.online → tree_app.db
```

**規劃功能（已進入開發 Backlog）：**

1. **離線快取 + 批次異步上傳**（IndexedDB + Service Worker Background Sync）
   - 外業無網路時：資料存 IndexedDB，標記 `status: 'pending'`
   - 恢復連線後：Service Worker 自動批次 POST，同步完成後更新狀態
   - UI 狀態指示：📴 已存本機 / 🔄 上傳中 / ✅ 已同步

2. **偏移量測模式**（高樓多路徑偏移補救）
   - 適用場景：台北市區高樓玻璃帷幕旁，Reach RX 無法取得 FIX
   - 流程：站開闊處鎖定 RTK FIX 基準點 → 雷射測距儀量距離 + 指北針量方位角 → 系統自動計算樹木座標
   - 資料庫記錄 `gps_source: 'offset'`，保留基準點、距離、方位角原始值

3. **GPS 精度指示燈**（`gps-survey.html` 或整合進 `survey.html`）
   - 🟢 FIX（RTK）：精度 ±1–3cm，可正式採集
   - 🟡 FLOAT：精度 ±30–50cm，標記待確認
   - 🔴 一般 GPS：精度 ±3–10m，不符合次米級規範

4. **Shapefile 匯出**（tree-app 後端，`/api/survey/export-shp`）
   - pyshp 產生 .shp/.dbf/.prj，支援 WGS84 + TWD97
   - 下載 shapefile.zip，直接交付市府 GIS 系統

**標書文字（定案版）：**
> 本團隊採用 Emlid Reach RX 多頻 RTK GNSS 接收器，搭配內政部國土測繪中心 e-GNSS 即時動態定位服務，於外業現場取得公分級定位成果。調查資料透過自建 PWA 行動調查平台即時寫入雲端資料庫，全程無須紙本記錄及事後人工輸入。針對台北市區高樓密集帶之多路徑干擾問題，本系統另設計「偏移量測模式」，確保全路段樹木均能達到次米級定位標準。系統支援離線作業模式，資料暫存於裝置本地端，待網路恢復後自動批次同步至雲端。成果可直接輸出 Shapefile、GeoJSON 及 CSV 等標準 GIS 格式，符合機關 GIS 圖資建置需求。定位精度可達 1–3 公分，遠優於本案要求之 1 公尺內定位精度標準。

### 評選前優先事項（目標 2026-06-20）

- about.html 補 8 張實拍照片：
  - 整排行道樹街景。
  - 樹葉透光特寫。
  - 受保護樹木橢圓標牌。
  - 百年老樹根部。
  - 榕樹氣根。
  - 樟樹葉片逆光。
  - 手機掃 QR 動作。
  - 樹牌 QR Code 特寫。
- iOS Safari + Android Chrome 實機 QA：
  - 地圖。
  - 掃碼。
  - 定位。
  - `survey.html`。
  - `tree.html`。
- `survey.html` 用真實帳號與真實樹籍編碼測試送出。
- 確認地圖初始標記置中修正於實機表現正常。
- 準備 taipei-trees.org demo 影片或現場展示流程。

### GPS 整合功能 Backlog（評選後 Week 1–4）

| 優先 | 功能 | 時程 |
|------|------|------|
| 🔴 | 後端新增 `gps_source` 欄位（direct_rtk / float / offset / manual）| Week 1 |
| 🔴 | IndexedDB 離線暫存 + Service Worker Background Sync | Week 1 |
| 🟡 | GPS 精度指示燈整合進 `survey.html` C 段 | Week 2 |
| 🟡 | 偏移量測模式 UI + 座標計算公式 | Week 2 |
| 🟠 | `/api/survey/export-shp` Shapefile 匯出（pyshp）| Week 3–4 |
| 🟠 | Lefebure 設定 SOP 文件（圖文並茂，給外業人員）| Week 2 |

### 中期功能

- 各行政區獨立介紹頁 12 頁，用於 SEO 長尾與區域樹木統計。
- 常見樹種百科頁，優先前 10 或前 30-50 大樹種。
- 各行政區固碳量分析頁，顯示排行、樹種分布、碳匯統計。
- 法條查詢或法規整理頁，涵蓋台北市樹木保護自治條例、行道樹管理相關規範。
- 民眾通報功能的內測版。
- 公園樹上線，前提是授權與對外說明風險處理完成。

### 六個月投標備戰

- 6 月：完成平台地基、登入、單棵樹詳情、關於我們、訓練班提案、PiCUS 詢價、確認公司營業項目。
- 7 月：第一次樹木普查教育訓練班，包含官方風險評估表、平台實機操作、現場實習。
- 8 月：示範普查 500 棵，產出正式報告；應力波檢測儀到貨與內訓。
- 9 月：第二次訓練班，加入應力波實機；邀請其他廠商巡檢員；寄信給公園處；聯繫張育森教授合作意向。
- 10 月：投標文件備齊，包含 ISA 證書、示範普查報告、訓練班紀錄、demo 影片、應力波報告、人力計畫、合作意向書、公會背書、GIS 欄位對照表。
- 11 月：等標案公告，服務建議書主軸為「解決普查資料結構性斷裂問題」，簡報以現場 demo 為主。

---

## 所有重要決策

### 架構與部署

- 前端維持純靜態 HTML/CSS/JS，不引入 React/Vue，不做 SSR。
- 所有 library 由 CDN 載入，維持無 build step。
- Cloudflare Pages push main 自動部署，約 30 秒。
- taipei-trees.org、tree-app、yiren-eco.online 是三套不同定位的系統。
- taipei-trees.org 不自建後端，所有讀寫透過 tree-app API。
- 普查模式與風險評估模式的前端都在 taipei-trees.org，不在 tree-app 重複做前端。
- tree-app 是 Flask + SQLite + NAS Docker，是資料庫與 API 後端。
- 同一對話可同時管理 taipei-trees-frontend 與 tree-app，避免跨對話傳話。

### 資料來源與公開層

- 對外只引用 data.taipei OGDL 資料。
- 行道樹與受保護樹木可公開。
- 公園樹暫不上線，因 geopkl ArcGIS API 授權狀態未明。
- 不公開 `gov_risk_level`、`gov_health_score` 等未授權或敏感欄位。
- 公開層可見樹種、位置、樹高等基本資料；健康診斷細節、風險評估、認養人與合約資料需登入或更高權限。
- 資料主權敘事：普查/風險評估資料集中於 tree-app NAS，未來可移交市府或同步至市府指定資料庫。

### 地圖與圖示

- 預設 zoom 15，街道層級比 zoom 12 更適合樹木密集資料。
- 目前採逐點顯示，不使用 MarkerCluster。
- 行道樹使用深綠圓點。
- 受保護樹木使用金色星形，代表珍貴且與圓點明顯區分。
- 公園樹未來使用淺粉紅圓點。
- 圖例宜簡潔，避免遮住地圖。

### 使用者與 UX

- QR 掃碼排在使用說明最前，因巡檢人員與現場使用最常用。
- 手機優先、戶外高對比。
- guide.html 需照顧一般民眾、長輩、小朋友/老師三種語氣。
- 定位與掃碼都不應上傳個資或影像。
- 樹木 sheet 用問候語增加親近感，但不犧牲資料可讀性。

### 認證與權限

- 登入沿用 tree-app `admins` 表，員工不需另外註冊。
- `platform_users` 保留備用，用於未來外部廠商或政府帳號。
- JWT 由 tree-app 發行，前端存在 `localStorage`。
- token 8 小時有效。
- role 對應：
  - `owner` → `platform_admin`
  - `manager` → `contractor_admin`
  - `planner` → `surveyor`
  - `inspector` / `inspector_reviewer` → `inspector`
- 未來角色曾規劃包含：`public`、`surveyor`、`inspector`、`contractor_admin`、`gov_viewer`、`gov_editor`、`platform_admin`。
- 帳號管理規劃包含平台管理員、廠商主管、普查主管、巡檢主管、普查員、巡檢員、政府唯讀保留角色，但目前不是評選前主線。

### 普查規範

- 普查功能按台北市 112 年規範設計。
- 手機 GPS 只能輔助，儀器 GPS 才是正式定位值。
- DBH 量測標準高度為 130 cm，精度至小數點第一位，最多 6 分枝。
- 叢生多株 DBH 使用平方和開根號。
- 生長狀況為良好/不良/危木/死亡缺株；危木必填備註，死亡缺株可免填部分量測與照片。
- 照片依道路方向固定拍攝方位，符合附件四。

### 風險評估

- 風險評估採台北市公園處官方表格標準，不採 TRAQ。
- 伺服器端計算評級，前端不自行決定正式風險級別。
- 已送出報告可公開分享。
- PDF 匯出走客戶端 jsPDF。
- 對外公開前仍需注意官方表格使用合規性。

### 民眾通報

- 曾規劃作為投標展示「民眾參與都市林務」。
- 目前使用者已決定暫時不開放民眾通報。
- 暫緩主因是通知路由複雜與公園處可能被通報淹沒。
- 未來若做，先做後台待辦與路由表，不急著做 email/簡訊。

### SEO 與內容

- 目標關鍵字：台北市行道樹、行道樹 QR Code、台北市受保護樹木、行道樹查詢。
- about.html 是 SEO 主力，需持續補內容與照片。
- guide.html 主打 QR 掃碼教學與教育用途。
- 未來行政區頁與樹種百科頁是 SEO 長尾主線。

### 安全與 CSS 修正

- `_headers` 用於 Cloudflare Pages 安全 headers。
- `[hidden] { display: none !important; }` 必須保留。原因：`#qr-overlay` 曾因 `display:flex` 覆蓋 hidden，導致遮擋 filter chips 與統計面板。
- 敏感操作如帳號管理未來應加二次確認。
- AI 或未來問答功能不得傳送 token、個資或內部評估資料。

### 明確不做

- 不引入 React/Vue 等框架。
- 不做後端 SSR。
- 不公開未授權公園樹或政府風險欄位。
- 不做一般使用者登入；公開查詢不需要登入。
- 不在 tree-app 重複做普查/風險評估前端。

---

## 後續接手提醒

- 修改前先確認目前程式碼現況，因部分舊記憶與 AGENTS/CLAUDE 內容已落後。
- 若變更前後端 API，需同步更新 `~/API_CONTRACT.md`。
- 若 tree-app 有部署，NAS 指令為：

```bash
ssh buy747@100.84.82.22
cd /volume1/docker/tree-app
git pull
sudo /usr/local/bin/docker compose up -d --build
```

- 前端本機驗證：

```bash
npm run serve
npx playwright test
```
