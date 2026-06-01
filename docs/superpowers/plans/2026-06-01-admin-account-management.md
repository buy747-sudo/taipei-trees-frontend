# 帳號管理系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `/admin.html` 帳號管理頁，支援新增帳號、重設密碼、修改角色、停用；同時修改登入優先查 `platform_users`，並在 `login.html` 加密碼顯示眼睛。

**Architecture:** 後端新增 `blueprints/admin_api/` blueprint（6 支 API），修改 `login()` 向下相容；前端新增 `admin.html` + `js/admin.js`，修改 `login.html` + `index.html`。兩個 repo 分開 commit。

**Tech Stack:** Python/Flask（後端）、純靜態 HTML/JS（前端）、SQLite via `db.py`、JWT auth via `require_platform_auth`

---

## 檔案結構

### 後端 `/Users/nash911/Claude_workProject/tree_app/`
| 動作 | 檔案 |
|------|------|
| 修改 | `db.py` — 新增 `update_platform_user_role()`, `update_platform_user_password()`, 擴充 `PLATFORM_ROLES` |
| 修改 | `blueprints/platform_auth/routes.py` — 修改 `login()` 優先查 platform_users |
| 新增 | `blueprints/admin_api/__init__.py` |
| 新增 | `blueprints/admin_api/routes.py` — 6 支 API |
| 修改 | `app.py` — 註冊 admin_api_bp |

### 前端 `/Users/nash911/taipei-trees-frontend/`
| 動作 | 檔案 |
|------|------|
| 修改 | `login.html` — 密碼欄加眼睛切換 |
| 修改 | `css/style.css` — `.pw-wrap` + `.pw-eye` 樣式 |
| 新增 | `admin.html` |
| 新增 | `js/admin.js` |
| 修改 | `index.html` — 右上角加 ⚙ 帳號按鈕 |

---

## Task 1：後端 — 擴充 db.py

**Files:**
- Modify: `db.py` 在 `set_platform_user_active()` 之後新增函數，並更新 `PLATFORM_ROLES`

- [ ] **Step 1: 更新 PLATFORM_ROLES，加入新角色**

找到 `db.py` 第 7919 行的 `PLATFORM_ROLES`，替換為：

```python
PLATFORM_ROLES = frozenset({
    'platform_admin',
    'contractor_admin',
    'survey_supervisor',
    'inspect_supervisor',
    'surveyor',
    'inspector',
    'gov_readonly',   # 保留，暫不啟用
    # legacy 相容
    'gov_viewer', 'gov_editor',
})
```

- [ ] **Step 2: 新增 `update_platform_user_role()`**

在 `set_platform_user_active()` 函數之後加入：

```python
def update_platform_user_role(user_id: int, role: str) -> bool:
    """更新帳號角色。角色不合法回 False，更新成功回 True。"""
    if role not in PLATFORM_ROLES:
        return False
    with db_conn() as conn:
        conn.execute('UPDATE platform_users SET role=? WHERE id=?', (role, user_id))
    return True
```

- [ ] **Step 3: 新增 `update_platform_user_password()`**

緊接上面繼續加：

```python
def update_platform_user_password(user_id: int, password_hash: str) -> None:
    """重設帳號密碼（主管操作，不需舊密碼）。"""
    with db_conn() as conn:
        conn.execute(
            'UPDATE platform_users SET password_hash=?, failed_login_count=0, locked_until=NULL WHERE id=?',
            (password_hash, user_id)
        )
```

- [ ] **Step 4: 新增 `get_all_platform_users_with_company()`**

```python
def get_all_platform_users_with_company(contractor_id=None):
    """回傳 platform_users（含公司名稱）。contractor_id 不為 None 時只回傳該公司。"""
    with get_conn() as conn:
        if contractor_id is not None:
            rows = conn.execute(
                '''SELECT pu.id, pu.username, pu.display_name, pu.role,
                          pu.contractor_id, c.name AS contractor_name,
                          pu.is_active, pu.created_at
                   FROM platform_users pu
                   LEFT JOIN companies c ON c.id = pu.contractor_id
                   WHERE pu.contractor_id = ?
                   ORDER BY pu.id''',
                (contractor_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                '''SELECT pu.id, pu.username, pu.display_name, pu.role,
                          pu.contractor_id, c.name AS contractor_name,
                          pu.is_active, pu.created_at
                   FROM platform_users pu
                   LEFT JOIN companies c ON c.id = pu.contractor_id
                   ORDER BY pu.id'''
            ).fetchall()
        return [dict(r) for r in rows]
```

- [ ] **Step 5: 驗證語法**

```bash
cd /Users/nash911/Claude_workProject/tree_app
python3 -c "import db; print('PLATFORM_ROLES:', db.PLATFORM_ROLES)"
```

期望輸出：印出包含 `survey_supervisor` 的 frozenset，無 ImportError。

- [ ] **Step 6: Commit**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git add db.py
git commit -m "feat: db — 擴充 PLATFORM_ROLES，新增 update_role/update_password/get_all_with_company"
```

---

## Task 2：後端 — 修改登入邏輯（platform_users 優先）

**Files:**
- Modify: `blueprints/platform_auth/routes.py`

- [ ] **Step 1: 在 `login()` 裡新增查 platform_users 的邏輯**

找到 `login()` 函數（第 118 行），把整個函數主體替換為：

```python
@platform_auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 204

    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        return jsonify(error='請輸入帳號和密碼'), 400

    # ── 優先查 platform_users（多廠商帳號）────────────────────────────────────
    pu = DB.get_platform_user_by_username(username)
    if pu:
        pu = dict(pu)
        if not pu.get('is_active', 1):
            return jsonify(error='帳號已停用，請聯絡管理員'), 403
        if pu.get('locked_until'):
            try:
                locked_until = datetime.fromisoformat(pu['locked_until'])
                if datetime.now() < locked_until:
                    remaining = int((locked_until - datetime.now()).total_seconds() / 60) + 1
                    return jsonify(error=f'帳號已鎖定，請 {remaining} 分鐘後再試'), 429
            except (ValueError, TypeError):
                pass
        if not check_password_hash(pu['password_hash'], password):
            DB.update_platform_user_failed_login(username)
            return jsonify(error='帳號或密碼錯誤'), 401
        DB.reset_platform_user_failed_login(username)
        # 查公司名稱
        pu_full = DB.get_platform_user_with_company(username) or pu
        contractor_name = dict(pu_full).get('contractor_name') or ''
        platform_user = {
            'id':             pu['id'],
            'username':       pu['username'],
            'display_name':   pu.get('display_name') or pu['username'],
            'role':           pu['role'],
            'contractor_id':  str(pu['contractor_id']) if pu.get('contractor_id') else 'YR001',
            'contractor_name': contractor_name,
        }
        token = _make_token(platform_user)
        return jsonify(token=token, expires_in=28800, user=platform_user)

    # ── Fallback：查 admins（怡仁內部帳號，向下相容）─────────────────────────
    admin = DB.get_admin_by_username(username)
    if not admin:
        return jsonify(error='帳號或密碼錯誤'), 401

    if admin.get('is_active') == 0:
        return jsonify(error='帳號已停用，請聯絡管理員'), 403

    if admin.get('locked_until'):
        try:
            locked_until = datetime.fromisoformat(admin['locked_until'])
            if datetime.now() < locked_until:
                remaining = int((locked_until - datetime.now()).total_seconds() / 60) + 1
                return jsonify(error=f'帳號已鎖定，請 {remaining} 分鐘後再試'), 429
        except (ValueError, TypeError):
            pass

    if not check_password_hash(admin['password_hash'], password):
        DB.update_admin_failed_login(username)
        return jsonify(error='帳號或密碼錯誤'), 401

    DB.reset_admin_failed_login(admin['id'])
    platform_user = _build_platform_user(admin)
    token = _make_token(platform_user)
    return jsonify(
        token=token,
        expires_in=28800,
        user=dict(
            id=platform_user['id'],
            username=platform_user['username'],
            display_name=platform_user['display_name'],
            role=platform_user['role'],
            contractor_id=platform_user['contractor_id'],
            contractor_name=platform_user['contractor_name'],
        )
    )
```

- [ ] **Step 2: 語法驗證**

```bash
cd /Users/nash911/Claude_workProject/tree_app
python3 -c "import py_compile; py_compile.compile('blueprints/platform_auth/routes.py', doraise=True); print('OK')"
```

期望：`OK`

- [ ] **Step 3: Commit**

```bash
git add blueprints/platform_auth/routes.py
git commit -m "feat: login 優先查 platform_users，fallback 查 admins（向下相容）"
```

---

## Task 3：後端 — admin_api blueprint

**Files:**
- Create: `blueprints/admin_api/__init__.py`
- Create: `blueprints/admin_api/routes.py`

角色層級（高→低）：
```python
_ROLE_LEVEL = {
    'platform_admin': 0,
    'contractor_admin': 1,
    'survey_supervisor': 2,
    'inspect_supervisor': 2,
    'surveyor': 3,
    'inspector': 3,
    'gov_readonly': 3,
}
```
「不能指定高於自己的角色」= 不能指定 _ROLE_LEVEL 比自己的值還小的角色。

- [ ] **Step 1: 建立 `__init__.py`**

```python
# blueprints/admin_api/__init__.py
from flask import Blueprint

admin_api_bp = Blueprint(
    'admin_api',
    __name__,
    url_prefix='/api/admin',
)

from blueprints.admin_api import routes  # noqa: E402, F401
```

- [ ] **Step 2: 建立 `routes.py`**

```python
"""台北市樹木查詢平台 — 帳號管理 API。

端點（均需 JWT 認證，最低 contractor_admin）：
  GET  /api/admin/users              帳號列表
  POST /api/admin/users              新增帳號
  PATCH /api/admin/users/<id>        修改角色 / 停用啟用
  POST  /api/admin/users/<id>/reset  重設密碼
  GET   /api/admin/roles             可用角色清單
  GET   /api/admin/contractors       公司列表（供前端下拉）
"""
from werkzeug.security import generate_password_hash

from flask import jsonify, request

import db as DB
from blueprints.admin_api import admin_api_bp
from blueprints.platform_auth.routes import require_platform_auth

# 角色層級（數字越小越高）
_ROLE_LEVEL = {
    'platform_admin':    0,
    'contractor_admin':  1,
    'survey_supervisor': 2,
    'inspect_supervisor':2,
    'surveyor':          3,
    'inspector':         3,
    'gov_readonly':      3,
}

_ADMIN_ROLES = {'platform_admin', 'contractor_admin'}

ROLE_LABELS = {
    'platform_admin':    '平台管理員',
    'contractor_admin':  '廠商主管',
    'survey_supervisor': '普查主管',
    'inspect_supervisor':'巡檢主管',
    'surveyor':          '普查員',
    'inspector':         '巡檢員',
    'gov_readonly':      '政府（唯讀）',
}


def _pw_hash(password: str) -> str:
    return generate_password_hash(password, method='pbkdf2:sha256', salt_length=16)


def _can_manage(caller: dict) -> bool:
    return caller.get('role') in _ADMIN_ROLES


def _caller_contractor(caller: dict):
    """回傳呼叫者的 contractor_id（int 或 None）。"""
    cid = caller.get('contractor_id')
    try:
        return int(cid) if cid else None
    except (TypeError, ValueError):
        return None


def _can_assign_role(caller_role: str, target_role: str) -> bool:
    """呼叫者能否指定 target_role。不能指定比自己層級高（數字小）的角色。"""
    return _ROLE_LEVEL.get(target_role, 99) >= _ROLE_LEVEL.get(caller_role, 99)


# ── GET /api/admin/users ───────────────────────────────────────────────────────

@admin_api_bp.route('/users', methods=['GET'])
@require_platform_auth
def list_users():
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    if caller['role'] == 'platform_admin':
        users = DB.get_all_platform_users_with_company()
    else:
        contractor_id = _caller_contractor(caller)
        users = DB.get_all_platform_users_with_company(contractor_id=contractor_id)

    return jsonify(users=users)


# ── POST /api/admin/users ──────────────────────────────────────────────────────

@admin_api_bp.route('/users', methods=['POST'])
@require_platform_auth
def create_user():
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    data = request.get_json(silent=True) or {}
    username     = (data.get('username') or '').strip()
    display_name = (data.get('display_name') or '').strip()
    password     = data.get('password') or ''
    role         = (data.get('role') or '').strip()
    contractor_id = data.get('contractor_id')

    if not username or not password or not role:
        return jsonify(error='username、password、role 為必填'), 400
    if len(password) < 6:
        return jsonify(error='密碼至少 6 個字元'), 400
    if role not in DB.PLATFORM_ROLES:
        return jsonify(error=f'無效的角色：{role}'), 400
    if not _can_assign_role(caller['role'], role):
        return jsonify(error='不能指定高於自身層級的角色'), 403

    # contractor_admin 只能建立同公司帳號
    if caller['role'] == 'contractor_admin':
        contractor_id = _caller_contractor(caller)

    new_id = DB.create_platform_user(
        username, display_name, _pw_hash(password), role, contractor_id
    )
    if new_id is None:
        return jsonify(error='帳號名稱已存在'), 409

    return jsonify(id=new_id, username=username, role=role), 201


# ── PATCH /api/admin/users/<id> ────────────────────────────────────────────────

@admin_api_bp.route('/users/<int:user_id>', methods=['PATCH'])
@require_platform_auth
def update_user(user_id: int):
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    target = DB.get_platform_user_by_id(user_id)
    if not target:
        return jsonify(error='帳號不存在'), 404
    target = dict(target)

    # contractor_admin 只能操作同公司帳號
    if caller['role'] == 'contractor_admin':
        if str(target.get('contractor_id')) != str(_caller_contractor(caller)):
            return jsonify(error='無法管理其他公司的帳號'), 403

    data = request.get_json(silent=True) or {}
    changed = False

    if 'role' in data:
        new_role = (data['role'] or '').strip()
        if new_role not in DB.PLATFORM_ROLES:
            return jsonify(error=f'無效的角色：{new_role}'), 400
        if not _can_assign_role(caller['role'], new_role):
            return jsonify(error='不能指定高於自身層級的角色'), 403
        DB.update_platform_user_role(user_id, new_role)
        changed = True

    if 'is_active' in data:
        DB.set_platform_user_active(user_id, bool(data['is_active']))
        changed = True

    if not changed:
        return jsonify(error='沒有可更新的欄位'), 400

    return jsonify(message='已更新'), 200


# ── POST /api/admin/users/<id>/reset ──────────────────────────────────────────

@admin_api_bp.route('/users/<int:user_id>/reset', methods=['POST'])
@require_platform_auth
def reset_password(user_id: int):
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    target = DB.get_platform_user_by_id(user_id)
    if not target:
        return jsonify(error='帳號不存在'), 404
    target = dict(target)

    if caller['role'] == 'contractor_admin':
        if str(target.get('contractor_id')) != str(_caller_contractor(caller)):
            return jsonify(error='無法管理其他公司的帳號'), 403

    data = request.get_json(silent=True) or {}
    new_password = data.get('password') or ''
    if len(new_password) < 6:
        return jsonify(error='密碼至少 6 個字元'), 400

    DB.update_platform_user_password(user_id, _pw_hash(new_password))
    return jsonify(message='密碼已重設'), 200


# ── GET /api/admin/roles ───────────────────────────────────────────────────────

@admin_api_bp.route('/roles', methods=['GET'])
@require_platform_auth
def list_roles():
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    caller_level = _ROLE_LEVEL.get(caller['role'], 99)
    roles = [
        {'role': role, 'label': label}
        for role, label in ROLE_LABELS.items()
        if _ROLE_LEVEL.get(role, 99) >= caller_level
        and role != 'gov_readonly'   # 保留角色，不在 UI 顯示
    ]
    return jsonify(roles=roles)


# ── GET /api/admin/contractors ────────────────────────────────────────────────

@admin_api_bp.route('/contractors', methods=['GET'])
@require_platform_auth
def list_contractors():
    caller = request.platform_user
    if not _can_manage(caller):
        return jsonify(error='權限不足'), 403

    with DB.get_conn() as conn:
        rows = conn.execute(
            'SELECT id, name, contract_name FROM companies ORDER BY id'
        ).fetchall()
    return jsonify(contractors=[dict(r) for r in rows])
```

- [ ] **Step 3: 語法驗證**

```bash
cd /Users/nash911/Claude_workProject/tree_app
python3 -c "
import py_compile
py_compile.compile('blueprints/admin_api/__init__.py', doraise=True)
py_compile.compile('blueprints/admin_api/routes.py', doraise=True)
print('OK')
"
```

期望：`OK`

- [ ] **Step 4: Commit**

```bash
git add blueprints/admin_api/
git commit -m "feat: admin_api blueprint — 帳號管理 6 支 API"
```

---

## Task 4：後端 — 在 app.py 註冊 blueprint + 部署

**Files:**
- Modify: `app.py`

- [ ] **Step 1: 在 app.py 加入 blueprint 註冊**

找到：
```python
from blueprints.survey_api import survey_api_bp  # noqa: E402
app.register_blueprint(survey_api_bp)
```

在後面加入：
```python
from blueprints.admin_api import admin_api_bp  # noqa: E402
app.register_blueprint(admin_api_bp)
```

- [ ] **Step 2: 語法驗證**

```bash
cd /Users/nash911/Claude_workProject/tree_app
python3 -c "import py_compile; py_compile.compile('app.py', doraise=True); print('OK')"
```

- [ ] **Step 3: Commit 並 push**

```bash
git add app.py
git commit -m "feat: 註冊 admin_api_bp"
git push origin main
```

- [ ] **Step 4: 部署到 NAS**

```bash
ssh buy747@100.84.82.22 "cd /volume1/docker/tree-app && git pull && sudo /usr/local/bin/docker compose up -d --build 2>&1 | tail -8"
```

期望最後幾行包含 `Container tree-app  Started`

- [ ] **Step 5: 確認端點回 401（未登入時的正確行為）**

```bash
curl -s -o /dev/null -w "%{http_code}" https://office.yiren-eco.online/api/admin/users
# 期望：401
curl -s -o /dev/null -w "%{http_code}" https://office.yiren-eco.online/api/admin/roles
# 期望：401
```

---

## Task 5：前端 — login.html 密碼眼睛切換

**Files:**
- Modify: `login.html`
- Modify: `css/style.css`

- [ ] **Step 1: 在 `css/style.css` 加入 `.pw-wrap` 樣式**

在現有 `.form-group input` 規則之後加入（`css/style.css` 末尾即可）：

```css
/* ── 密碼顯示切換 ── */
.pw-wrap {
  position: relative;
}
.pw-wrap input {
  padding-right: 44px !important;
}
.pw-eye {
  position: absolute; right: 10px; top: 50%;
  transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  font-size: 1.1rem; padding: 4px; line-height: 1;
  color: #888;
}
.pw-eye:hover { color: #1a5c2a; }
```

- [ ] **Step 2: 修改 `login.html` 密碼欄位**

找到：
```html
        <div class="form-group">
          <label for="password">密碼</label>
          <input id="password" type="password" autocomplete="current-password"
                 placeholder="請輸入密碼">
        </div>
```

替換為：
```html
        <div class="form-group">
          <label for="password">密碼</label>
          <div class="pw-wrap">
            <input id="password" type="password" autocomplete="current-password"
                   placeholder="請輸入密碼">
            <button type="button" class="pw-eye" id="pw-toggle" aria-label="顯示密碼">👁</button>
          </div>
        </div>
```

- [ ] **Step 3: 在 `login.html` 的 `<script>` 區塊加入切換邏輯**

在 `form.addEventListener('submit', ...)` 之前加入：

```javascript
    // 密碼顯示/隱藏切換
    document.getElementById('pw-toggle').addEventListener('click', function() {
      const input = document.getElementById('password');
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      this.textContent = isHidden ? '🙈' : '👁';
      this.setAttribute('aria-label', isHidden ? '隱藏密碼' : '顯示密碼');
    });
```

- [ ] **Step 4: 驗證（瀏覽器確認）**

```bash
python3 -m http.server 8080
```

開啟 `http://localhost:8080/login.html`，確認：
1. 密碼欄右側有 👁 圖示
2. 點擊後密碼明文顯示，圖示變 🙈
3. 再點恢復隱藏

- [ ] **Step 5: Commit**

```bash
cd /Users/nash911/taipei-trees-frontend
git add login.html css/style.css
git commit -m "feat: login.html 加密碼顯示/隱藏切換（眼睛 icon）"
```

---

## Task 6：前端 — 建立 admin.html + js/admin.js

**Files:**
- Create: `admin.html`
- Create: `js/admin.js`

### admin.html

- [ ] **Step 1: 建立 `admin.html`**

```html
<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="theme-color" content="#1a5c2a">
  <title>帳號管理｜台北市樹木查詢</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { background: #f0f4f1; min-height: 100vh; }
    .adm-header {
      background: #1a5c2a; color: #fff;
      padding: 14px 16px; display: flex; align-items: center; gap: 10px;
      position: sticky; top: 0; z-index: 100;
    }
    .adm-header a { color: rgba(255,255,255,0.8); text-decoration: none; font-size: 0.9rem; }
    .adm-header h1 { font-size: 1rem; font-weight: 700; flex: 1; }
    .adm-header .huser { font-size: 0.78rem; color: rgba(255,255,255,0.75); }
    .adm-body { max-width: 900px; margin: 0 auto; padding: 16px; }

    .toolbar {
      display: flex; gap: 10px; flex-wrap: wrap;
      align-items: center; margin-bottom: 14px;
    }
    .toolbar h2 { font-size: 1.1rem; font-weight: 700; color: #1a5c2a; flex: 1; margin: 0; }
    .toolbar select, .toolbar input[type=search] {
      padding: 8px 12px; border: 1.5px solid #d0d0d0; border-radius: 8px;
      font-size: 0.88rem; background: #fff; outline: none;
    }
    .toolbar select:focus, .toolbar input:focus { border-color: #1a5c2a; }
    .btn-add {
      padding: 9px 16px; background: #1a5c2a; color: #fff;
      border: none; border-radius: 8px; font-size: 0.88rem;
      font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .btn-add:hover { background: #14491f; }

    /* table */
    .adm-table-wrap { overflow-x: auto; }
    table.adm-table {
      width: 100%; border-collapse: collapse; font-size: 0.88rem;
      background: #fff; border-radius: 12px; overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.07);
    }
    .adm-table th {
      background: #f5f5f5; padding: 10px 12px; text-align: left;
      font-weight: 700; color: #444; border-bottom: 2px solid #e8e8e8;
    }
    .adm-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    .adm-table tr:last-child td { border-bottom: none; }
    .adm-table tr:hover td { background: #f9fdf9; }

    .badge-active   { background: #e8f5e9; color: #1a5c2a; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700; }
    .badge-inactive { background: #fce8e8; color: #c00; padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 700; }

    .btn-sm {
      padding: 5px 10px; border-radius: 6px; font-size: 0.78rem;
      font-weight: 600; cursor: pointer; border: 1.5px solid;
      white-space: nowrap;
    }
    .btn-reset  { color: #1a5c2a; border-color: #1a5c2a; background: #fff; }
    .btn-reset:hover  { background: #e8f5e9; }
    .btn-disable { color: #c00; border-color: #c00; background: #fff; }
    .btn-disable:hover { background: #fce8e8; }
    .btn-enable  { color: #1a5c2a; border-color: #1a5c2a; background: #e8f5e9; }
    .btn-enable:hover  { background: #d0efd0; }

    .role-select {
      padding: 4px 8px; border: 1.5px solid #d0d0d0; border-radius: 6px;
      font-size: 0.82rem; background: #fafafa; outline: none;
    }
    .role-select:focus { border-color: #1a5c2a; }

    /* modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 500; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 16px;
      padding: 24px 22px; width: 100%; max-width: 420px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .modal-title { font-size: 1rem; font-weight: 700; color: #1a5c2a; margin-bottom: 16px; }
    .mrow { margin-bottom: 14px; }
    .mrow label { display: block; font-size: 0.82rem; font-weight: 600; color: #444; margin-bottom: 5px; }
    .mrow input, .mrow select {
      width: 100%; padding: 10px 12px; font-size: 0.95rem;
      border: 1.5px solid #d0d0d0; border-radius: 10px; outline: none;
      background: #fafafa; box-sizing: border-box;
    }
    .mrow input:focus, .mrow select:focus { border-color: #1a5c2a; background: #fff; }
    .modal-actions { display: flex; gap: 10px; margin-top: 6px; }
    .btn-modal-ok {
      flex: 2; padding: 12px; background: #1a5c2a; color: #fff;
      border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; cursor: pointer;
    }
    .btn-modal-ok:hover { background: #14491f; }
    .btn-modal-cancel {
      flex: 1; padding: 12px; background: #f5f5f5; color: #555;
      border: none; border-radius: 10px; font-size: 0.88rem; font-weight: 600; cursor: pointer;
    }
    .modal-error { color: #c00; font-size: 0.82rem; margin-bottom: 10px; display: none; }

    [hidden] { display: none !important; }
  </style>
</head>
<body>

  <header class="adm-header">
    <a href="/">&#8592; 地圖</a>
    <h1>&#9881;&#65039; 帳號管理</h1>
    <span class="huser" id="huser"></span>
    <button id="adm-logout" style="padding:4px 10px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.4);background:transparent;color:rgba(255,255,255,0.8);font-size:0.78rem;cursor:pointer;">登出</button>
  </header>

  <div class="adm-body">
    <div id="no-perm" hidden style="text-align:center;padding:60px 20px;color:#888;">您的帳號沒有管理權限。</div>

    <div id="adm-main">
      <div class="toolbar">
        <h2>帳號列表</h2>
        <select id="filter-contractor"><option value="">全部廠商</option></select>
        <select id="filter-role"><option value="">全部角色</option></select>
        <input type="search" id="filter-search" placeholder="🔍 搜尋帳號/姓名" style="min-width:160px;">
        <button class="btn-add" id="btn-add">+ 新增帳號</button>
      </div>

      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead>
            <tr>
              <th>帳號</th><th>姓名</th><th>角色</th><th>廠商</th><th>狀態</th><th>操作</th>
            </tr>
          </thead>
          <tbody id="user-tbody"></tbody>
        </table>
      </div>
      <div id="empty-msg" hidden style="text-align:center;padding:40px;color:#aaa;">沒有符合條件的帳號</div>
    </div>
  </div>

  <!-- 新增帳號 Modal -->
  <div class="modal-overlay" id="modal-create" hidden>
    <div class="modal-box">
      <div class="modal-title">新增帳號</div>
      <div class="modal-error" id="create-err"></div>
      <div class="mrow"><label>帳號 *</label><input type="text" id="c-username" autocomplete="off" autocapitalize="none"></div>
      <div class="mrow"><label>姓名 / 顯示名稱</label><input type="text" id="c-display"></div>
      <div class="mrow">
        <label>初始密碼 *</label>
        <div class="pw-wrap">
          <input type="password" id="c-password" autocomplete="new-password">
          <button type="button" class="pw-eye" onclick="togglePw('c-password',this)">👁</button>
        </div>
      </div>
      <div class="mrow"><label>角色 *</label><select id="c-role"></select></div>
      <div class="mrow" id="c-contractor-row"><label>廠商</label><select id="c-contractor"></select></div>
      <div class="modal-actions">
        <button class="btn-modal-cancel" id="create-cancel">取消</button>
        <button class="btn-modal-ok" id="create-ok">建立帳號</button>
      </div>
    </div>
  </div>

  <!-- 重設密碼 Modal -->
  <div class="modal-overlay" id="modal-reset" hidden>
    <div class="modal-box">
      <div class="modal-title">重設密碼</div>
      <div id="reset-username-hint" style="font-size:0.85rem;color:#555;margin-bottom:12px;"></div>
      <div class="modal-error" id="reset-err"></div>
      <div class="mrow">
        <label>新密碼 *</label>
        <div class="pw-wrap">
          <input type="password" id="r-password" autocomplete="new-password">
          <button type="button" class="pw-eye" onclick="togglePw('r-password',this)">👁</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-modal-cancel" id="reset-cancel">取消</button>
        <button class="btn-modal-ok" id="reset-ok">確認重設</button>
      </div>
    </div>
  </div>

  <script src="js/config.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/admin.js"></script>
</body>
</html>
```

### js/admin.js

- [ ] **Step 2: 建立 `js/admin.js`**

```javascript
/**
 * admin.js — 帳號管理頁
 * 依賴：config.js (API_BASE), auth.js (Auth)
 */

const ADMIN_API = API_BASE.replace('/public', '') + '/api/admin';
const ADMIN_ROLES = ['platform_admin', 'contractor_admin'];

let _allUsers = [];
let _roles = [];
let _contractors = [];
let _resetTargetId = null;

// ── 初始化 ───────────────────────────────────────────────────────────────────
(async function init() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname);
    return;
  }
  const user = Auth.getUser();
  document.getElementById('huser').textContent = user.display_name || user.username || '';
  document.getElementById('adm-logout').addEventListener('click', () => {
    Auth.logout(); window.location.href = '/';
  });

  if (!ADMIN_ROLES.includes(user.role)) {
    document.getElementById('adm-main').hidden = true;
    document.getElementById('no-perm').hidden = false;
    return;
  }

  await Promise.all([loadRoles(), loadContractors()]);
  buildFilters();
  await loadUsers();
  bindEvents();
})();

// ── 資料載入 ─────────────────────────────────────────────────────────────────
async function loadUsers() {
  const res = await Auth.authFetch(`${ADMIN_API}/users`);
  if (!res) return;
  const data = await res.json();
  _allUsers = data.users || [];
  renderTable();
}

async function loadRoles() {
  const res = await Auth.authFetch(`${ADMIN_API}/roles`);
  if (!res) return;
  const data = await res.json();
  _roles = data.roles || [];
}

async function loadContractors() {
  const res = await Auth.authFetch(`${ADMIN_API}/contractors`);
  if (!res) return;
  const data = await res.json();
  _contractors = data.contractors || [];
}

// ── 篩選器 ───────────────────────────────────────────────────────────────────
function buildFilters() {
  const fc = document.getElementById('filter-contractor');
  _contractors.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    fc.appendChild(o);
  });

  const fr = document.getElementById('filter-role');
  _roles.forEach(r => {
    const o = document.createElement('option');
    o.value = r.role; o.textContent = r.label;
    fr.appendChild(o);
  });
}

// ── 表格渲染 ─────────────────────────────────────────────────────────────────
function renderTable() {
  const contractorFilter = document.getElementById('filter-contractor').value;
  const roleFilter       = document.getElementById('filter-role').value;
  const searchVal        = document.getElementById('filter-search').value.toLowerCase();

  const filtered = _allUsers.filter(u => {
    if (contractorFilter && String(u.contractor_id) !== contractorFilter) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    if (searchVal && !u.username.toLowerCase().includes(searchVal) &&
        !(u.display_name || '').toLowerCase().includes(searchVal)) return false;
    return true;
  });

  const tbody = document.getElementById('user-tbody');
  const caller = Auth.getUser();

  tbody.innerHTML = filtered.map(u => {
    const isSelf   = u.username === caller.username;
    const roleLbl  = _roles.find(r => r.role === u.role)?.label || u.role;
    const statusBadge = u.is_active
      ? `<span class="badge-active">● 啟用</span>`
      : `<span class="badge-inactive">● 停用</span>`;

    const roleOptions = _roles.map(r =>
      `<option value="${r.role}" ${r.role === u.role ? 'selected' : ''}>${r.label}</option>`
    ).join('');

    const toggleBtn = isSelf ? '' : (u.is_active
      ? `<button class="btn-sm btn-disable" onclick="toggleActive(${u.id},false)">停用</button>`
      : `<button class="btn-sm btn-enable"  onclick="toggleActive(${u.id},true)">啟用</button>`);

    return `<tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td>${esc(u.display_name || '—')}</td>
      <td>
        <select class="role-select" onchange="changeRole(${u.id},this.value)" ${isSelf ? 'disabled' : ''}>
          ${roleOptions}
        </select>
      </td>
      <td>${esc(u.contractor_name || '—')}</td>
      <td>${statusBadge}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn-sm btn-reset" onclick="openReset(${u.id},'${esc(u.username)}')">重設密碼</button>
        ${toggleBtn}
      </td>
    </tr>`;
  }).join('');

  document.getElementById('empty-msg').hidden = filtered.length > 0;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── 角色修改 ─────────────────────────────────────────────────────────────────
async function changeRole(userId, newRole) {
  const res = await Auth.authFetch(`${ADMIN_API}/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role: newRole }),
  });
  if (!res) return;
  if (!res.ok) {
    const d = await res.json();
    alert(d.error || '修改失敗');
    await loadUsers();
    return;
  }
  const u = _allUsers.find(u => u.id === userId);
  if (u) u.role = newRole;
}

// ── 停用 / 啟用 ──────────────────────────────────────────────────────────────
async function toggleActive(userId, active) {
  const res = await Auth.authFetch(`${ADMIN_API}/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: active }),
  });
  if (!res) return;
  if (!res.ok) { alert('操作失敗'); return; }
  const u = _allUsers.find(u => u.id === userId);
  if (u) u.is_active = active ? 1 : 0;
  renderTable();
}

// ── 重設密碼 Modal ────────────────────────────────────────────────────────────
function openReset(userId, username) {
  _resetTargetId = userId;
  document.getElementById('reset-username-hint').textContent = `帳號：${username}`;
  document.getElementById('r-password').value = '';
  document.getElementById('reset-err').style.display = 'none';
  document.getElementById('modal-reset').hidden = false;
}

// ── 新增帳號 Modal ────────────────────────────────────────────────────────────
function openCreate() {
  const caller = Auth.getUser();
  ['c-username','c-display','c-password'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('create-err').style.display = 'none';

  // 角色下拉
  const roleSelect = document.getElementById('c-role');
  roleSelect.innerHTML = _roles.map(r =>
    `<option value="${r.role}">${r.label}</option>`
  ).join('');

  // 廠商下拉（platform_admin 可選，contractor_admin 不顯示）
  const contRow = document.getElementById('c-contractor-row');
  if (caller.role === 'platform_admin') {
    const contSelect = document.getElementById('c-contractor');
    contSelect.innerHTML = '<option value="">— 不指定 —</option>' +
      _contractors.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    contRow.hidden = false;
  } else {
    contRow.hidden = true;
  }

  document.getElementById('modal-create').hidden = false;
}

// ── 事件綁定 ─────────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('btn-add').addEventListener('click', openCreate);
  document.getElementById('create-cancel').addEventListener('click', () => {
    document.getElementById('modal-create').hidden = true;
  });
  document.getElementById('reset-cancel').addEventListener('click', () => {
    document.getElementById('modal-reset').hidden = true;
  });

  ['filter-contractor','filter-role'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTable);
  });
  document.getElementById('filter-search').addEventListener('input', renderTable);

  // 建立帳號
  document.getElementById('create-ok').addEventListener('click', async () => {
    const errEl = document.getElementById('create-err');
    errEl.style.display = 'none';
    const caller = Auth.getUser();

    const body = {
      username:     document.getElementById('c-username').value.trim(),
      display_name: document.getElementById('c-display').value.trim(),
      password:     document.getElementById('c-password').value,
      role:         document.getElementById('c-role').value,
    };
    if (caller.role === 'platform_admin') {
      body.contractor_id = document.getElementById('c-contractor').value || null;
    }

    if (!body.username || !body.password) {
      errEl.textContent = '帳號和密碼為必填'; errEl.style.display = 'block'; return;
    }

    const res = await Auth.authFetch(`${ADMIN_API}/users`, {
      method: 'POST', body: JSON.stringify(body),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || '建立失敗'; errEl.style.display = 'block'; return;
    }
    document.getElementById('modal-create').hidden = true;
    await loadUsers();
  });

  // 重設密碼
  document.getElementById('reset-ok').addEventListener('click', async () => {
    const errEl = document.getElementById('reset-err');
    errEl.style.display = 'none';
    const password = document.getElementById('r-password').value;
    if (password.length < 6) {
      errEl.textContent = '密碼至少 6 個字元'; errEl.style.display = 'block'; return;
    }
    const res = await Auth.authFetch(`${ADMIN_API}/users/${_resetTargetId}/reset`, {
      method: 'POST', body: JSON.stringify({ password }),
    });
    if (!res) return;
    if (!res.ok) {
      const d = await res.json();
      errEl.textContent = d.error || '重設失敗'; errEl.style.display = 'block'; return;
    }
    document.getElementById('modal-reset').hidden = true;
    alert('密碼已重設');
  });
}

// ── 密碼顯示切換 ─────────────────────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? '🙈' : '👁';
}
```

- [ ] **Step 3: 語法驗證（Node）**

```bash
cd /Users/nash911/taipei-trees-frontend
node -e "
const fs = require('fs');
const code = fs.readFileSync('js/admin.js','utf8');
new Function(code)();
console.log('syntax OK');
" 2>&1 || true
# 因為程式碼依賴瀏覽器全域變數，預期 ReferenceError 但不應有 SyntaxError
```

期望：出現 `ReferenceError: API_BASE is not defined`，不應出現 `SyntaxError`。

- [ ] **Step 4: Commit**

```bash
git add admin.html js/admin.js
git commit -m "feat: admin.html + admin.js — 帳號管理頁（新增/重設/角色/停用）"
```

---

## Task 7：前端 — index.html 加 ⚙ 帳號入口

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 修改 `renderAuthArea` 裡的登入狀態 HTML**

在 `index.html` 找到：

```javascript
          `<a href="/survey.html" id="auth-survey-btn">📝 普查</a>` +
          `<a href="/risk.html" id="auth-risk-btn">📋 評估</a>` +
          `<span id="auth-user">${label}</span>` +
```

替換為：

```javascript
          `<a href="/survey.html" id="auth-survey-btn">📝 普查</a>` +
          `<a href="/risk.html" id="auth-risk-btn">📋 評估</a>` +
          (['platform_admin','contractor_admin'].includes(user.role)
            ? `<a href="/admin.html" id="auth-admin-btn">⚙ 帳號</a>` : '') +
          `<span id="auth-user">${label}</span>` +
```

- [ ] **Step 2: 在 `css/style.css` 加 `#auth-admin-btn` 樣式**

在 `#auth-survey-btn, #auth-risk-btn` 規則中加入 `#auth-admin-btn`：

找到：
```css
#auth-survey-btn, #auth-risk-btn {
```
替換為：
```css
#auth-survey-btn, #auth-risk-btn, #auth-admin-btn {
```

同樣更新 hover：
```css
#auth-survey-btn:hover, #auth-risk-btn:hover { background: rgba(255,255,255,0.15); }
```
替換為：
```css
#auth-survey-btn:hover, #auth-risk-btn:hover, #auth-admin-btn:hover { background: rgba(255,255,255,0.15); }
```

- [ ] **Step 3: Commit**

```bash
git add index.html css/style.css
git commit -m "feat: index.html 頂部加 ⚙ 帳號管理入口（管理員角色可見）"
```

---

## Task 8：整合測試 + 部署

- [ ] **Step 1: 本機 Playwright 測試全跑**

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test
```

期望：14 個測試全過（`14 passed`）。若有失敗，修正後再跑。

- [ ] **Step 2: 新增 admin.html smoke test**

在 `tests/smoke.spec.js` 末尾加入：

```javascript
test('admin.html 未登入跳轉登入頁', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/admin.html');
  await expect(page).toHaveURL(/login\.html/, { timeout: 5000 });
});

test('admin.html 登入後顯示帳號列表', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('tt_token', 'fake-token');
    localStorage.setItem('tt_user', JSON.stringify({
      id: 1, username: 'nash911', display_name: '白老闆',
      role: 'platform_admin', contractor_id: 'YR001'
    }));
  });
  await page.goto(BASE + '/admin.html');
  await expect(page.locator('.toolbar h2')).toContainText('帳號列表');
  await expect(page.locator('#btn-add')).toBeVisible();
});
```

- [ ] **Step 3: 再跑全部測試（含新增 2 個）**

```bash
npx playwright test
```

期望：`16 passed`

- [ ] **Step 4: Push 前端**

```bash
cd /Users/nash911/taipei-trees-frontend
git push origin main
```

- [ ] **Step 5: 實機驗證（正式站）**

瀏覽 `https://taipei-trees.org`，用 `nash911 / admin1` 登入，確認：
1. 右上角出現 **⚙ 帳號** 按鈕
2. 點擊進入 `admin.html`，帳號列表顯示（若 platform_users 表有資料）
3. 新增一個測試帳號，確認建立成功
4. 重設該帳號密碼，確認不需舊密碼
5. `login.html` 密碼欄有眼睛，點擊可顯示/隱藏

---

## 自我驗收 Checklist

- [ ] 後端：`platform_users` 登入優先，`admins` 向下相容（nash911 仍可用 admin1 登入）
- [ ] 後端：`contractor_admin` 只能看/管自己公司帳號
- [ ] 後端：不能指定比自己層級高的角色
- [ ] 前端：密碼眼睛切換在 login.html、admin.html 新增、admin.html 重設 3 處都有
- [ ] 前端：⚙ 帳號按鈕只有 platform_admin 與 contractor_admin 看得到
- [ ] 前端：inspector / surveyor 登入後看不到 ⚙ 帳號按鈕
- [ ] Playwright：16/16 全過
