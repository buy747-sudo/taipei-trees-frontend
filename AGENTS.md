# AGENTS.md — taipei-trees.org 台北市樹木查詢前台

> **完整開發脈絡見記憶檔案：`~/.Codex/projects/-Users-nash911-taipei-trees-frontend/memory/`**
> 修改前先讀 `ARCHITECTURE.md` 了解模組依賴關係。

---

## 專案概述

**網站**：`https://taipei-trees.org`（Cloudflare Pages 自動部署）
**Repo**：`https://github.com/buy747-sudo/taipei-trees-frontend`
**目的**：台北市行道樹與受保護樹木的公開查詢前台，評選 demo 約 2026-06-20

**設計原則**：
- 台北市最完整、最親民的樹木查詢平台
- 手機優先、戶外高對比
- 照顧所有使用者：一般民眾、現場巡檢、60歲長輩、小朋友/老師

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | 純靜態 HTML/CSS/JS（無框架、無 build step）|
| 地圖 | Leaflet 1.9.4 + Leaflet.markercluster 1.5.3（CDN）|
| 掃碼 | jsQR 1.4.0（CDN）|
| 部署 | Cloudflare Pages（push main → 自動部署）|
| 測試 | Playwright（`npx playwright test`）|

**API 後端**：`https://office.yiren-eco.online/public`（tree-app NAS）
- `GET /public/trees` — bbox + 篩選條件
- `GET /public/tree/<code>` — 單棵樹詳情
- `GET /public/stats` — 統計資料（10 分鐘快取）

---

## 檔案結構

```
taipei-trees-frontend/
├── index.html          # 主地圖頁
├── about.html          # 知識庫 + FAQ（照片佔位待填）
├── guide.html          # 使用說明（一般/長輩/小朋友三版）
├── sitemap.xml
├── robots.txt
├── _headers            # Cloudflare Pages 安全 headers
├── css/
│   └── style.css       # 全站樣式（含 [hidden] fix）
├── js/
│   ├── config.js       # API_BASE、常數、行政區中心
│   ├── api.js          # apiFetchTrees / apiFetchTree / apiFetchStats
│   ├── map.js          # Leaflet init、三種底圖、定位按鈕
│   ├── markers.js      # MarkerCluster、圖示、addTreeMarkers
│   ├── sheet.js        # 底部 sheet、history.pushState
│   ├── filters.js      # filterState、getFilterParams、搜尋列
│   ├── qr.js           # jsQR camera scanner
│   ├── stats.js        # 統計面板
│   └── app.js          # 主進入點：showToast、loadTrees、init
└── tests/
    └── smoke.spec.js   # Playwright 7 tests（全過）
```

**JS 載入順序（依賴關係）**：
`config → api → map → markers → sheet → filters → qr → stats → app`

---

## 圖示設計

| 類型 | 圖示 | 顏色 | 狀態 |
|------|------|------|------|
| 行道樹 | 圓點 | 深綠 #1a5c2a | ✅ 上線 |
| 受保護樹木 | 星形 ★ | 金色 #f59e0b | ✅ 上線 |
| 公園樹（未來）| 圓點 | 淺粉紅 #fbcfe8 | ⏳ 待公園處授權 |
| 聚合群組 | 數字圓圈 | 黃/橘/紅（markercluster 預設）| ✅ |

---

## 關鍵設計決策

| 決策 | 理由 |
|------|------|
| 純靜態 HTML（無框架） | 無 build step，Cloudflare Pages 直接部署，維護最簡單 |
| CDN 載入所有 library | 不需 npm install，部署零複雜度 |
| `[hidden] { display: none !important; }` | #qr-overlay flex 覆蓋 hidden，加此規則修正 |
| 公園樹不對外 | geopkl 未明確授權，投標期間政治風險 |
| 受保護樹用星形（非圓點）| 視覺區分明確，代表「珍貴」意義 |
| QR 掃碼排最前 | 巡檢人員最常用，guide.html 所有版本均置頂 |

---

## 部署流程

```bash
git add .
git commit -m "feat: ..."
git push origin main
# Cloudflare Pages 自動部署，約 30 秒
```

**驗證**：`https://taipei-trees-frontend.pages.dev`（即時）
**正式站**：`https://taipei-trees.org`（DNS Active 後）

---

## SEO 配置

- `lang="zh-Hant-TW"`
- `<title>`、`<meta description>`、`<meta keywords>` 均已優化
- Open Graph + Twitter Card
- `canonical` URL
- Google Search Console 驗證 meta tag 已加（待驗證通過）
- `sitemap.xml` 含 3 個頁面

---

## 待辦事項

### 緊急
- [ ] 確認 taipei-trees.org DNS 從 Verifying → Active
- [ ] 加 www.taipei-trees.org 自訂網域
- [ ] Google Search Console 驗證通過後送出 sitemap

### 照片（拍完傳給 Codex 放進 about.html）
- [ ] 整排行道樹街景（路中間往前拍）
- [ ] 樹葉透光特寫（逆光）
- [ ] 受保護樹木橢圓標牌
- [ ] 百年老樹根部
- [ ] 榕樹氣根特寫
- [ ] 樟樹葉片逆光
- [ ] 掃碼動作（手持手機對 QR Code）
- [ ] 樹牌 QR Code 特寫

### 未來功能
- [ ] 公園樹上線（待公園處授權）
- [ ] 各行政區獨立介紹頁（SEO 長尾）
- [ ] 常見樹種百科頁（榕樹、樟樹等）

---

## 明確不做

- ❌ 引入 React/Vue 等框架（維護複雜度不值得）
- ❌ 後端 SSR（靜態優先）
- ❌ 放公園樹或 gov_risk_level（未授權，政治風險）
- ❌ 使用者登入功能（公開查詢不需要）
