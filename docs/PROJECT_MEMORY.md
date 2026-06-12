# PROJECT_MEMORY — taipei-trees.org 台北市樹木查詢平台

> 最後整理：2026-06-11  
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
- **2026-06-11 公開首頁 UX 決策**：首頁改為「民眾查樹優先」資訊架構。頂部只保留站名、搜尋、掃碼、說明與「工作登入」；生態效益、樹種百科、固碳排行、受保護樹木、城市綠資產等知識型入口移到地圖下方 `#explore-section`。這是避免第一屏塞滿功能按鈕，讓一般民眾先完成「找一棵樹」。
- **2026-06-11 專業功能入口決策**：風險評估、普查、紀錄、帳號管理等作業功能維持登入後才透過 `#auth-area` 顯示；非登入民眾不在首頁看到作業入口。固定頂部「通報異常」已移除，保留底部樹木詳情 sheet 的情境式通報入口與 `/report.html` 直接網址。
- **2026-06-11 地圖首屏決策**：`js/map.js` 新增 `prepareInitialMapViewport()`，在第一次 `loadTrees()` 前先依實際 header / data bar / stats bar 高度設定地圖尺寸並置中；`js/config.js` 新增首頁專用 `INITIAL_MAP_CENTER = [24.9915, 121.548]`，讓首批資料點落在視窗中段，避免初始畫面看起來像樹木都從地圖下緣開始顯示。
- **2026-06-11 首頁不顯示範圍清單決策**：移除首頁「此範圍顯示 50 棵」與 50 筆樹木列表。原因是民眾第一眼不會閱讀大量陌生樹籍資料，清單反而像後台資料表；首頁只保留地圖 marker，使用者點選地圖上的樹木後再開底部 sheet 看單棵詳情。右側/下方空間改放 `#explore-section`，引導民眾看綠資產、樹種百科、生態效益與使用說明。
- **2026-06-11 地圖載入量決策**：`js/filters.js` 改為依裝置寬度與 Leaflet zoom 動態設定 `/public/trees?limit=`。一般 zoom 14：手機 300、平板 500、電腦 800；遠景 zoom <= 12 降到最多 300，避免全市視野塞太多 marker；近景 zoom >= 17 提高到手機 500、平板 800、電腦 1200，讓放大查路段時資料更完整。
- **2026-06-11 樹點視覺分類決策**：`js/markers.js` 依樹種名稱與資料欄位分類地圖 marker。優先序：受保護樹（金色星號）> 棕櫚類（淺藍圓）> 針葉樹（墨綠三角）> 開花觀賞樹（粉紅圓）> 落葉闊葉（褐色圓）> 常綠闊葉（深綠圓 fallback）。冠幅 `crown_m` 越大，marker 越大；缺冠幅時用 `dbh_cm` 估大小；兩者都缺時用中等尺寸。例外：像鳳凰木、阿勃勒、木棉同時是落葉與觀花，為了民眾辨識優先歸為「開花觀賞樹」。
- **2026-06-11 地圖移動載入失敗 UX 修正**：使用者移動地圖時若 `/public/trees` 暫時失敗，不再立即清空既有 marker，也不再對已有樹點的背景更新顯示「無法載入樹木資料」toast。`js/app.js` 改為成功取得新資料後才 `clearMarkers()`，失敗時保留目前樹點並安靜重試；若載入中又移動地圖，會在目前請求結束後補一次最新範圍查詢。
- **2026-06-11 RWD 分版決策**：首頁明確區分三種裝置。電腦版（>=1024px）採「左側大地圖 + 右側探索入口」工作台式布局，適合簡報與辦公室查詢；平板版（641–1023px）採大地圖堆疊資訊、探索卡片 2 欄，適合現場與會議展示；手機版（<=640px）隱藏資料數字列、保留搜尋/掃碼觸控優先，探索卡片 2 欄且極窄螢幕改 1 欄。
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
- **2026-06-10 新增**：sheet 底部加入「🚗 導航前往」藍色按鈕（`.btn-nav`），開啟 Google Maps 導航到該樹 GPS 座標，供外業吊車直接導航。

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
- **2026-06-10 更新**：所有員工帳號已從 `admins` 表遷移至 `platform_users`。14 個帳號遷移，密碼不變（werkzeug hash 直接複製）。`admin1` = `platform_admin`，其餘員工 = `inspector`（可做普查+評估），`contractor_id=2`（怡仁）。
- 目前登入優先查 `platform_users`，找不到才 fallback 到 `admins` 表（向後相容）。`platform_users` 保留用於外部廠商或政府帳號。
- token 有效期 8 小時，戶外作業一天足夠。
- **2026-06-07 確認**：Auth 系統 Phase 1–5 完整驗證通過：
  - `/api/auth/login` 回傳 200 + JWT，role 正確
  - `survey.html`、`risk.html` 均有 auth guard（未登入跳 login.html）
  - `survey.js`、`risk.js` 全部使用 `authFetch`（帶 Bearer token）
  - **Role-based UI**：`surveyor` 只顯示「普查」；`inspector` 以上才顯示「評估」
  - `login.html` 已移除測試帳號 demo/demo 提示
- **架構決策（2026-06-07）**：台北樹木前台完全沿用 tree-app 現有 JWT 系統，不自建認證。tree-app = 資料庫 + 認證中心 + API 後端；taipei-trees.org = 公開前台 + 作業介面（純前端）。

### iOS Safari 非 JSON 回應保護

- **2026-06-10 修正**：`survey.js` 與 `risk.js` 所有 `res.json()` 呼叫改以 try/catch 包裝。
- 根因：後端 500 時回傳 HTML 錯誤頁，iOS Safari 的 `res.json()` 拋出 `SyntaxError: The string did not match the expected pattern`（Chrome 顯示 `Unexpected token <`）。
- 修正後統一顯示「伺服器錯誤（HTTP 5xx），請稍後重試。」，不再閃退。

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

### 普查清單 survey-list.html（2026-06-10 完整重寫）

- 角色管控：surveyor → 自己；contractor_admin → 同公司；platform_admin → 全部。
- 4 張統計卡：總筆數 / 已送出 / 草稿 / ⚠️ 需注意。
- 異常管理：橘色左邊框 + ⚠️ 徽章；resolve modal（標記已處理 / 填備註）。
- API：`PATCH /api/survey/<id>/resolve`。

### 評估清單 risk-list.html（2026-06-10 完整重寫）

- 同上角色管控，5 張統計卡（加 A 級危害紅卡）。
- 相同異常管理 modal。

### admin.html 帳號管理頁（2026-06-10 新增）

- `platform_admin` 專用。
- 公司列表 + 帳號 CRUD（新增/編輯/停用/啟用/重設密碼）。
- 頁面最上方有 📊 數據總覽：6 張統計卡（啟用帳號/近7天活躍/今日登入/近30天活躍/首頁今日訪客/首頁近30天訪客）。
- 登入記錄表（帳號/顯示名稱/角色色碼/IP/時間）。
- 後端 v2.23 新增：`login_logs`、`page_views` 表；`GET /api/auth/analytics`、`GET /api/auth/analytics/logs`、`POST /api/auth/pageview`。

### 政府中高風險樹木圖層（2026-06-10 新增，內部員工專用）

- 資料來源：114 年南區行道樹健檢（大安/信義/文山），1,144 棵（高風險 420 / 中風險 724）。
- 已匯入 NAS `gov_risk_flags` 表，API：`GET /api/risk-flags`（JWT protected，不對外公開）。
- 前端：`js/risk-layer.js`，登入後地圖左上角出現深紅色 ⚠️ 按鈕才能切換顯示。
- 圖示：高風險 = 紅色大圓 (#dc2626)、中風險 = 橘色小圓 (#ea580c)。
- popup 含：樹種/路段/傾斜/缺失率/關鍵因子/🚗 導航。
- **安全原則**：未登入用戶完全看不到此圖層，也不會發出 `/api/risk-flags` 請求。

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

- **2026-06-10 更新**：所有員工帳號已遷移到 `platform_users`，`admins` 表僅作 fallback。
- `platform_users` 為主帳號來源；外部廠商與政府帳號也將在此表建立。
- JWT 由 tree-app 發行，前端存在 `localStorage`。
- token 8 小時有效。
- role 對應：
  - `owner` → `platform_admin`
  - `manager` → `contractor_admin`
  - `inspector` → inspector（普查 + 評估，既是普查員也是評估員）
  - `surveyor` → 只做普查
  - `gov_viewer` / `gov_editor` → 政府唯讀/編輯
- **2026-06-10 確認**：`inspector` 可同時做普查（survey.html）和評估（risk.html），不需要兩個角色。
- 角色色碼徽章已在 admin.html 實作：platform_admin=深藍、contractor_admin=藍、inspector=綠、surveyor=青、gov_viewer=灰、gov_editor=橘。

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

## 2026-06-10 NAS 重開機穩定性

### Cloudflare Tunnel 設定（已確認正常）

config.yml 位置：`/volume1/docker/cloudflared-config/config.yml`
```yaml
tunnel: 50257270-c783-42c5-ab5a-683a4b9467f2
credentials-file: /etc/cloudflared/50257270-c783-42c5-ab5a-683a4b9467f2.json
ingress:
  - hostname: office.yiren-eco.online
    service: http://tree-app:5000
  - hostname: yiren-eco.online
    service: http://app:3000
  - hostname: "*.yiren-eco.online"
    service: http://app:3000
  - service: http_status:404
```

**關鍵原則**：cloudflared 用 Docker container name 連線（不用 IP），本機 IP 改變不影響。但 config.yml 的 tunnel ID 必須與 `/etc/cloudflared/<ID>.json` 檔名一致。

**重開機後若掛掉的排查順序**：
1. `sudo docker ps` 確認 tree-app-tunnel 是 Up 還是 Restarting
2. `sudo docker logs tree-app-tunnel` 看錯誤
3. 常見問題：credentials file not found → config.yml tunnel ID 不符
4. 修正後：`sudo docker restart tree-app-tunnel`

**待做（防患未然）**：在路由器設定 DHCP 保留，NAS MAC 位址 → 固定本機 IP。

## 2026-06-10 全站功能 QA 檢查（正式站）

完整報告：`.gstack/qa-reports/qa-report-taipei-trees-org-2026-06-10.md`（含截圖）。
測試對象為 https://taipei-trees.org 正式站，桌面 1280×800 與手機 375×812 雙視窗。

### 結果總覽

- 健康分數 **90 / 100**，17 項核心功能全部通過。
- 通過項目：地圖載入（2 秒內 500 標記）、標記點擊詳情視窗、深層連結 `?id=`、導航前往（Google Maps 座標正確）、通報預填參數、tree.html 詳情頁、受保護樹篩選（星形標記）、樹籍編號搜尋、無效搜尋友善提示、進階查詢（行政區＋樹種）、統計總覽面板、QR 掃碼無相機時的錯誤處理、9 個子頁面（report/guide/about/login/eco-benefits/species/carbon-ranking/law/data-policy）全部正常、carbon-ranking 動態資料、通報表單空白驗證、手機版排版、OGDL 授權聲明。

### 問題與處理結果

1. **【高】API 間歇性失效時地圖靜默空白** → ✅ 已修正（commit `362fceb`）。測試中觀察到一次 `/public/trees` 與 `/api/auth/pageview` 同時被 CORS 擋下（後端回應缺 ACAO header），地圖 0 標記且無自動重試。真正根因有兩層：(a) NAS 後端短暫異常（見本頁「NAS 重開機穩定性」）；(b) 前端 bug——`loadTrees` 失敗時 `_lastBboxKey` 已被設定，同一範圍永遠不會重新查詢。修正：失敗後重置 key ＋ 自動重試 2 次（2s/4s 退避），本機模擬「失敗兩次後成功」驗證通過。
2. **【低】統計面板空白行政區列** → ✅ 已修正（同 commit）。Nash 確認原始資料就沒有行政區、GPS 位置顯示正常即可；前端把空字串顯示為「未分區」。
3. **【資訊→已修正】匯出按鈕「看不到」** → ✅ 已修正（commit `8eeed8e`）。Nash 回報首頁找不到匯出按鈕，追查後是版面 bug：`fitMapToViewport()` 計算地圖高度時沒扣掉底部統計列 48px，整條 stats-bar（含 📥 匯出與統計總覽）剛好被推出視窗外，桌機手機都看不到。修正：JS 計算多扣 stats-bar 高度，CSS 三個斷點同步調整。Nash 已實機確認 Excel 可正常下載、傾斜圖層登入後顯示正常（2026-06-10）。

### 後續新增功能（同日）

- **「主幹傾斜>30度」藍色獨立圖層**（commit `476181c`，員工登入後專用）：地圖左側高/中風險按鈕下方新增藍色「∠斜」切換按鈕，篩選 `tilt_status` 含「＞30」「>30」的樹（涵蓋全形/半形與「且臨近園路」變體），依 114 年清冊約 115 棵。藍色圓形 ∠ 標記、popup 同風險圖層（含導航）。
- 資料來源確認：114行道樹大表（大安/文山/信義）「樹木傾斜狀況」欄位值有 9 種變體，>30度共 115 筆（102+1+12）。

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

## 2026-06-11 教育部校園樹木 Open Data 授權註記

- `data-policy.html` 新增「延伸開放資料來源」區塊，標明教育部「校園樹木資訊平臺」Open Data / Open API。
- 目前可公開取得的 API 為 `School/GetTrees`，內容是校園編號、校園名稱、樹種名稱與數量統計；不是單棵樹點位、照片、胸徑、樹高或冠幅資料。
- 頁尾補上資料來源與政府資料開放授權條款（Open Government Data License，OGDL）1.0 版連結，避免未來引用校園樹木統計時來源不清。

## 2026-06-11 綠資產頁加入校園樹木延伸統計來源

- 曾在 `green-assets.html` 新增 `#campus-assets` 區塊，放在主儀表板與「樹木為城市做了什麼」敘事區之間。
- Nash 指出若只列台北市，目前教育部校園編號對應表僅有 2 所可查校園（銘傳大學、康寧大學），資料量過少，放在綠資產頁會造成誤導與頁面失焦。
- 已從 `green-assets.html` 移除整段校園樹木區塊與頁尾校園資料來源；教育部 Open Data 授權說明仍保留在 `data-policy.html` 作為資料來源總表。

## 2026-06-12 首頁通報入口位置決策

- `report.html` 不放回首頁頂部 nav，也不做浮動紅色按鈕，避免公開站第一印象變成申訴或派工平台。
- 首頁 `#explore-section` 新增低干擾的「通報樹木異常」卡片，連到 `/report.html`，文案包含「緊急狀況請聯絡 1999」。
- 點選單棵樹後底部 sheet 仍保留情境式「通報異常」入口，這是資料品質最高的通報方式，因為可帶入樹籍與座標。

## 2026-06-12 颱風安全與民眾版樹木風險

- 新增 `typhoon-safety.html`，以台北常見颱風、豪雨、強陣風情境說明颱風前、中、後如何安全觀察樹木異常。
- 新增 `tree-risk-guide.html`，把專業樹木風險三軸改成台灣民眾通俗語言：「會不會斷或倒」「會不會打到人車」「後果嚴不嚴重」，避免公開頁直接使用 ISA 術語。
- `report.html`、`guide.html`、`law.html` 已串連兩個安全教育頁；所有文案維持「緊急狀況請聯絡 1999」「本站接受通報，不保證回覆、處理時程或派工結果」。
- 2026-06-12 補強首頁可見性：`index.html` 探索區新增「颱風樹木安全」與「樹木風險怎麼看」兩張卡片，避免新頁只藏在通報/說明/法規頁。
- P5「樹木作業透明看板」列為未來待辦：需等平台有正式修剪、移除、樹樁、派工或預定工程資料後再做；目前不建立空看板。

## 2026-06-12 民眾版生態存摺與樹的信箱

- `index.html` 底部樹木 sheet 新增 `#sheet-passbook` 與 `#tree-mailbox`，點選單棵樹後先呈現「台北行道樹生態存摺」摘要、每年固碳量與祈福牌留言。
- 公開維護紀錄先不放上公開站：目前沒有完整、即時、可信的跨機關/跨廠商維護資料，避免民眾誤解「沒有資料＝沒有維護」。
- 祈福牌第一版採本機 `localStorage`，只在使用者自己的瀏覽器保存；未來若要全站公開留言，需另做公開留言 API、審核/檢舉與個資防護機制。

## 2026-06-12 公開祈福牌與防濫用

- 單棵樹 sheet 的效益區標題改為「這棵樹的城市貢獻」，避免「生態存摺」被理解成正式、完整、可查帳的官方帳本。
- `js/api.js` 預留公開祈福牌 API：`GET /public/tree/<code>/messages`、`POST /public/tree/<code>/messages`。API 回傳格式以 `{ messages: [...] }` 與 `{ message: {...} }` 為主。
- `js/sheet.js` 會優先讀寫公開 API；若 API 尚未上線或暫時失敗，會明確顯示「暫存在本裝置」，並退回 `localStorage`，不把本機留言偽裝成已公開。
- 前端先擋下常見廣告/欺騙性內容：網址、email、電話、LINE/Telegram/私訊、投資貸款、保證獲利、賭博、匯款、虛擬貨幣、股票群與過度重複字元。正式公開前仍建議後端做同樣檢查、頻率限制、隱藏留言與檢舉管理。
- 首頁地圖新增「有祈福牌的樹」篩選按鈕；前端會送 `has_messages=1`，並在 marker 上以小徽章顯示 `message_count`。
- NAS `tree-app` 已完成公開祈福牌後端：`public_tree_messages` schema、`DB.get_public_tree_messages()`、`DB.add_public_tree_message()`、`/public/tree/<code>/messages` GET/POST，以及 `/public/trees` 的 `message_count` 與 `has_messages` 篩選。
- 後端 commit `e64ca9c feat: add public tree prayer messages` 已推到 `buy747-sudo/tree-trimming-app`；後續另一個 AI 補上 commit `c6598e4`，讓 `/public/tree/<code>/messages` POST 通過 CSRF 窄範圍豁免。
- 2026-06-12 12:56 NAS root 排程 `tree-app` auto-update 已部署 `c6598e4`（v2.25.2）。正式 API 驗證：GET messages 200、POST messages 201、`/public/trees?has_messages=1` 可回傳 `message_count`、廣告/詐騙留言回 400。端到端測試用留言已從正式 DB 刪除。
