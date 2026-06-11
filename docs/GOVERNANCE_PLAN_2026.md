# 平台捐贈公會治理計劃書

> 定案日期：2026-06-11（Nash 拍板）
> 目標：taipei-trees.org 捐贈台北市景觀工程商業同業公會，成為產業共用平台
> 維運模式：網域/Cloudflare/NAS 費用與管理權**不移交**，由 Nash 代公會管理（公會無技術人員）

---

## 一、已定案決策

| # | 議題 | 決定 |
|---|------|------|
| D1 | 資料互通範圍 | 樹籍基本資料＋普查結果**全市共用**；風險評估明細只有「本公司＋政府線＋Nash」可看，其他公司只看該樹**最終評級** |
| D2 | 公會權限深度 | 只做「公司帳號建立＋產業總覽（各公司完成量，不含明細）」，公會是推動者不是監督者 |
| D3 | 資訊室修改權 | **直接改＋強制 audit log**（保留原值），不需 Nash 事前核可 |
| D4 | 公司帳號申請 | 公會線下收件，後台**手動建立**（推廣初期量不大） |
| D5 | 基礎設施 | 網域、Cloudflare、NAS 全部留在 Nash 名下，Nash 代管 |

## 二、角色架構（7 角色定案版）

```
👑 platform_admin（Nash）—— 最高權限：角色指派、功能開關、全平台 audit log
│
├── 🏛 assoc_admin（公會秘書處）—— 建公司帳號、產業總覽儀表板、公告
│     └── 各廠商公司（功能開關由 Nash 控制）
│           ├── contractor_admin —— 自家員工 CRUD、公司營運統計
│           └── inspector / surveyor —— 外業作業（受公司開關控制）
│
└── 🏢 政府線（無公司歸屬）
      ├── gov_clerk —— 全市已送出資料唯讀清單、篩選匯出、通報處理
      ├── gov_supervisor —— 風險總覽儀表板、廠商比較、趨勢報告
      └── gov_it —— 資料品質主控台、直接修正資料（強制 audit log）
```

角色技術說明：沿用現有 `platform_users.role` 欄位，新增 4 個角色值：
`assoc_admin`、`gov_clerk`、`gov_supervisor`、`gov_it`。
現有 `platform_admin`（nash911、admin1）即最高權限，不另設 super_admin。

## 三、公司功能開關

`companies` 表新增 4 個旗標，**後端 API 層強制檢查**（非僅前端隱藏）：

| 欄位 | 預設 | 控制範圍 |
|------|------|---------|
| `survey_enabled` | 1 | `POST /api/survey/*` 寫入端點＋前端普查入口 |
| `assessment_enabled` | 1 | `POST /api/assessment/*` 寫入端點＋前端評估入口 |
| `risk_layer_enabled` | 0 | `GET /api/risk-flags`（政府風險圖層，敏感，預設關） |
| `export_enabled` | 1 | 匯出端點 |

開關只有 `platform_admin` 能切（`PATCH /api/auth/companies/<id>/features`）。
政府線角色不受公司開關限制（他們無公司歸屬）。

## 四、資料可見性矩陣

| 資料 | 民眾 | 廠商員工 | 他廠商 | 公會 | gov_clerk | gov_supervisor | gov_it | Nash |
|------|------|---------|--------|------|-----------|----------------|--------|------|
| 樹籍基本資料 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 普查結果（已送出） | ❌ | ✅ | ✅ | 量化統計 | ✅ | ✅ | ✅ | ✅ |
| 評估明細（已送出） | ❌ | 本公司✅ | **僅最終評級** | 量化統計 | ✅ | ✅ | ✅ | ✅ |
| 草稿 | ❌ | 本人/本公司 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 政府風險圖層 | ❌ | 開關控制 | 開關控制 | ❌ | ✅ | ✅ | ✅ | ✅ |
| audit log | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 自己的 | ✅ |

## 五、audit log 設計

新表 `audit_logs`（tree_app SQLite）：

```sql
CREATE TABLE audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id      INTEGER NOT NULL,        -- platform_users.id
    actor_username TEXT NOT NULL,
    actor_role    TEXT NOT NULL,
    action        TEXT NOT NULL,           -- update / delete / toggle_feature / create_company / assign_role
    target_table  TEXT NOT NULL,           -- trees / surveys / assessments / companies / platform_users
    target_id     TEXT NOT NULL,
    old_value     TEXT,                    -- JSON，修改前的欄位值
    new_value     TEXT,                    -- JSON，修改後
    note          TEXT,                    -- gov_it 必填修改原因
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);
```

寫入時機：gov_it 資料修正、功能開關切換、公司建立、角色指派、刪除操作。
原則：**只增不改不刪**，Nash 可全查，gov_it 可查自己的。

## 六、開發階段

### Phase 1 — 後端權限地基（tree_app）
1. migration：`companies` 加 4 個旗標欄；建 `audit_logs` 表
2. `DB.log_audit()` helper
3. 角色常數擴充：認證/授權 decorator 接受新 4 角色
4. 功能開關 enforcement：survey / assessment / risk-flags 寫入端點檢查公司旗標
5. `GET/PATCH /api/auth/companies/<id>/features`（platform_admin 限定）
6. `/api/auth/me` 回傳公司功能旗標（前端隱藏入口用）
7. 評估明細可見性：list/detail 端點按 D1 規則過濾

### Phase 2 — 管理介面（taipei-trees-frontend）
1. admin.html：公司列表加功能開關 UI、帳號角色選項加 4 個新角色
2. index.html：作業入口按鈕同時看 role ＋公司旗標
3. 公會視圖：產業總覽（各公司普查/評估完成量統計卡）

### Phase 3 — 政府端三視圖
1. gov_clerk：全市資料唯讀清單（survey-list / risk-list 的 gov 模式）
2. gov_supervisor：風險總覽儀表板（願景文件 P1「風險樹處理進度」的政府版）
3. gov_it：資料品質主控台（GPS 離群值、照片缺漏、重複樹籍、空值率）＋修正工具

### Phase 4 — 公會營運配套
1. assoc_admin 建公司流程（複用 admin.html 公司 CRUD，限縮權限版）
2. 公告功能（公會發、全廠商登入後可見）

**順序理由**：Phase 1 是地基，後面全部依賴；Phase 2 讓 Nash 立刻能管理開關；
Phase 3 等政府帳號實際需求出現再細調；Phase 4 配合公會推廣時程。

## 七、不做的事

- ❌ 不做線上公司申請表單（D4：手動建立）
- ❌ 公會看不到任何作業明細（D2）
- ❌ 不另設 super_admin 角色（platform_admin 即最高權限）
- ❌ 基礎設施帳號不移交（D5）
- ❌ 民眾端不受任何影響（公開查詢照常）
