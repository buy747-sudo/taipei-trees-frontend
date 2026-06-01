# 帳號管理系統設計 — 基本版

**日期：** 2026-06-01
**目標：** 評選 demo 前（2026-06-20）完成
**範圍：** `/admin.html` 平台帳號管理頁 + 後端 admin_api + 登入密碼顯示切換

---

## 背景

台北市樹木查詢平台未來供 4 家廠商共用。每家廠商有主管帳號可自行管理員工。
怡仁（平台商）有最高權限可管理所有廠商。
台北市政府帳號架構預留，現階段不啟用。

---

## 資料庫

### 使用現有 `platform_users` 表

```sql
platform_users (
  id, username, display_name, password_hash,
  role, contractor_id → companies(id),
  is_active, created_at, failed_login_count, locked_until
)
```

`admins` 表（怡仁內部）維持不動，登入時向下相容。

### 角色定義

| role | 中文 | 權限範圍 |
|------|------|---------|
| `platform_admin` | 平台管理員（怡仁） | 看全部、管所有廠商 |
| `contractor_admin` | 廠商主管 | 只看自己公司 |
| `survey_supervisor` | 普查主管 | 執行普查、看組員報表 |
| `inspect_supervisor` | 巡檢主管 | 執行巡檢、看組員報表 |
| `surveyor` | 普查員 | 執行普查 |
| `inspector` | 巡檢員 | 執行巡檢 |
| `gov_readonly` | 政府帳號 | 保留、現在不啟用 |

---

## 後端：`blueprints/admin_api/`

### 端點

| 方法 | 路徑 | 說明 | 最低角色 |
|------|------|------|---------|
| GET | `/api/admin/users` | 帳號列表（platform_admin 看全部，contractor_admin 只看自己公司） | contractor_admin |
| POST | `/api/admin/users` | 新增帳號 | contractor_admin |
| PATCH | `/api/admin/users/<id>` | 修改角色 / 停用啟用 | contractor_admin |
| POST | `/api/admin/users/<id>/reset-password` | 重設密碼 | contractor_admin |
| GET | `/api/admin/roles` | 可用角色清單（依呼叫者角色過濾，不能指定高於自己） | contractor_admin |

### 安全規則

- `contractor_admin` 只能操作 `contractor_id` 相同的帳號
- 不能修改比自己層級高的角色
- 重設密碼不需要舊密碼（限主管操作）
- 新帳號建立後 `is_active = 1`，`must_change_password = 1`（下次登入強制改密碼，可選）

### 修改登入邏輯（`/api/auth/login`）

```
1. 查 platform_users WHERE username = ? AND is_active = 1
2. 找到 → 直接用，role 欄位直接取
3. 找不到 → 查 admins → 套 _ROLE_MAP（向下相容，怡仁內部帳號繼續可用）
```

---

## 前端：`/admin.html`

### 版面

```
┌──────────────────────────────────────────────┐
│ 🌳 台北樹木查詢 v0.6  [⚙ 帳號管理]  白老闆  登出 │
├──────────────────────────────────────────────┤
│  帳號管理                      [+ 新增帳號]   │
│  [全部廠商 ▾] [全部角色 ▾] [🔍 搜尋帳號]      │
│                                              │
│  帳號      姓名    角色      廠商    狀態 操作 │
│  nash911  白老闆  平台管理  怡仁   ● 啟用      │
│  kelly    Kelly   巡檢員   怡仁   ● 啟用  [重設密碼][停用] │
│  ...                                         │
└──────────────────────────────────────────────┘
```

### 功能清單

| 功能 | 說明 |
|------|------|
| 帳號列表 | 可依廠商、角色篩選；關鍵字搜尋帳號/姓名 |
| 新增帳號 | Modal：帳號、姓名、初始密碼（含眼睛顯示切換）、角色、廠商 |
| 重設密碼 | Modal：直接輸入新密碼（含眼睛顯示切換），不需舊密碼 |
| 修改角色 | inline 下拉選單，存檔即更新 |
| 停用 / 啟用 | 切換 is_active，停用帳號立即無法登入 |

### 入口

- `index.html` 右上角加 **⚙ 帳號** 按鈕，只有 `platform_admin` 與 `contractor_admin` 看得到
- 點後跳至 `/admin.html`，未登入 → 跳 `login.html`，角色不足 → 顯示無權限

### script 載入順序

`config.js → auth.js → admin.js`

---

## 密碼顯示切換（眼睛 icon）

**適用所有密碼欄位：**
- `login.html` 登入頁
- `admin.html` 新增帳號 modal
- `admin.html` 重設密碼 modal

**實作：**
```html
<div class="pw-wrap">
  <input type="password" id="pw" ...>
  <button type="button" class="pw-eye" aria-label="顯示密碼">👁</button>
</div>
```
點擊時切換 `type="password"` ↔ `type="text"`，icon 換成 👁‍🗨。

---

## 不在此版本範圍

- 廠商公司新增/管理介面（`platform_admin` 手動建 companies 表即可）
- gov_readonly 帳號開放
- 各廠商資料隔離的統計報表
- 審計日誌（audit log）

---

## 實作順序

1. **後端**：`admin_api` blueprint（5 支 API）+ 修改登入邏輯
2. **前端**：`/admin.html` + `js/admin.js`
3. **前端**：`login.html` 加眼睛切換
4. **前端**：`index.html` 右上角加 ⚙ 帳號入口
