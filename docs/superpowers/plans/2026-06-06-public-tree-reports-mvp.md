# Public Tree Reports MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public citizen tree issue reporting MVP that accepts reports without login, stores them in TreeApp for admin review, and exposes a clear TaipeiTrees frontend flow without implying official dispatch responsibility.

**Architecture:** Implement TreeApp first as the source of truth: database tables, public create API, photo upload, admin list/detail/update APIs, and admin UI. Then implement TaipeiTrees frontend entry points and `report.html`, using API mocks until backend deploy is available. Keep public reports private; only TreeApp admins can see individual cases.

**Tech Stack:** Python/Flask + SQLite in TreeApp, existing TreeApp auth/admin patterns, static HTML/CSS/JS in TaipeiTrees, Leaflet for location picking, Playwright for frontend tests, pytest for backend tests.

---

## File Structure

### Backend: `/Users/nash911/Claude_workProject/tree_app/`

| Action | File | Responsibility |
|---|---|---|
| Modify | `db.py` | Create/migrate `public_reports` and `public_report_photos`; add CRUD helpers and rate-limit helpers. |
| Modify | `app.py` | Register the `public_reports` blueprint. |
| Create | `blueprints/public_reports/__init__.py` | Blueprint package for report APIs if TreeApp blueprint registration is preferred. |
| Create | `blueprints/public_reports/routes.py` | Public create/photo APIs and admin list/detail/update APIs. |
| Create | `templates/admin_public_reports.html` | Admin list page. |
| Create | `templates/admin_public_report_detail.html` | Admin detail/review page. |
| Create | `tests/test_public_reports.py` | Backend DB/API tests. |

### Frontend: `/Users/nash911/taipei-trees-frontend/`

| Action | File | Responsibility |
|---|---|---|
| Create | `report.html` | Public report form and tree/location selection UI. |
| Create | `js/report.js` | Form state, validation, location picking, photo handling, submit API. |
| Modify | `index.html` | Add visible `通報樹木異常` entry. |
| Modify | `js/sheet.js` | Add `通報問題` action for selected tree. |
| Modify | `tree.html` | Add `通報這棵樹` action. |
| Modify | `css/style.css` | Shared report entry/button styles if needed. |
| Modify | `tests/smoke.spec.js` | Playwright coverage for report entry, validation, and submit success. |
| Modify | `docs/PROJECT_MEMORY.md` | Mark MVP implementation status after completion. |

---

## Task 1: Backend DB Schema And Helpers

**Files:**
- Modify: `/Users/nash911/Claude_workProject/tree_app/db.py`
- Test: `/Users/nash911/Claude_workProject/tree_app/tests/test_public_reports.py`

- [ ] **Step 1: Write failing DB tests**

Create `tests/test_public_reports.py` with:

```python
import sqlite3

import db


def test_create_public_report_generates_report_no(monkeypatch, tmp_path):
    test_db = tmp_path / "reports.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db), raising=False)
    db.init_db()
    db.migrate_db()

    report = db.create_public_report({
        "tree_code": "DA001",
        "tree_category": "street",
        "species_name": "樟樹",
        "district": "大安區",
        "managing_unit": "仁愛路",
        "issue_type": "枯枝、斷枝、掉枝風險",
        "urgency": "possible_danger",
        "description": "樹冠上方有枯枝，靠近人行道。",
        "location_text": "",
        "lat": 25.031,
        "lng": 121.535,
        "needs_location_review": False,
        "contact_name": "",
        "contact_info": "",
        "source": "tree_detail",
        "ip_hash": "hash1",
        "user_agent": "pytest",
    })

    assert report["id"] == 1
    assert report["report_no"].startswith("TT-R-")
    assert report["report_no"].endswith("-0001")


def test_unbound_report_requires_location_review(monkeypatch, tmp_path):
    test_db = tmp_path / "reports.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db), raising=False)
    db.init_db()
    db.migrate_db()

    report = db.create_public_report({
        "tree_code": None,
        "tree_category": "unknown",
        "species_name": "",
        "district": "",
        "managing_unit": "",
        "issue_type": "其他問題",
        "urgency": "normal",
        "description": "大安森林公園入口附近有一棵樹看起來有異常。",
        "location_text": "大安森林公園捷運站旁",
        "lat": None,
        "lng": None,
        "needs_location_review": True,
        "contact_name": "",
        "contact_info": "",
        "source": "location_only",
        "ip_hash": "hash2",
        "user_agent": "pytest",
    })

    stored = db.get_public_report(report["id"])
    assert stored["tree_code"] is None
    assert stored["tree_category"] == "unknown"
    assert stored["needs_location_review"] == 1
    assert stored["status"] == "待檢視"
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: FAIL because `create_public_report()` and `get_public_report()` do not exist.

- [ ] **Step 3: Add schema migration**

In `db.py`, add these tables to `init_db()` if that is where current tables are created, and also add guarded `CREATE TABLE IF NOT EXISTS` statements in `migrate_db()`:

```python
CREATE_PUBLIC_REPORTS_SQL = """
CREATE TABLE IF NOT EXISTS public_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_no TEXT UNIQUE,
    tree_code TEXT,
    tree_category TEXT NOT NULL DEFAULT 'unknown',
    species_name TEXT,
    district TEXT,
    managing_unit TEXT,
    issue_type TEXT NOT NULL,
    urgency TEXT NOT NULL,
    description TEXT NOT NULL,
    location_text TEXT,
    lat REAL,
    lng REAL,
    needs_location_review INTEGER NOT NULL DEFAULT 0,
    contact_name TEXT,
    contact_info TEXT,
    status TEXT NOT NULL DEFAULT '待檢視',
    source TEXT NOT NULL DEFAULT 'home_entry',
    ip_hash TEXT,
    user_agent TEXT,
    reviewed_by INTEGER,
    reviewed_at TEXT,
    internal_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_PUBLIC_REPORT_PHOTOS_SQL = """
CREATE TABLE IF NOT EXISTS public_report_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    photo_url TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(report_id) REFERENCES public_reports(id)
);
"""
```

Then execute both SQL strings inside `init_db()` and `migrate_db()` using the same connection pattern as nearby schema code:

```python
conn.execute(CREATE_PUBLIC_REPORTS_SQL)
conn.execute(CREATE_PUBLIC_REPORT_PHOTOS_SQL)
```

- [ ] **Step 4: Add constants and helpers**

In `db.py`, add near other tree/public helpers:

```python
PUBLIC_REPORT_ISSUE_TYPES = frozenset({
    "枯枝、斷枝、掉枝風險",
    "樹木明顯傾斜或倒伏",
    "病蟲害或菇菌異常",
    "樹穴、支架、鋪面問題",
    "樹牌或 QR Code 損壞",
    "遮擋交通號誌、路牌、民宅",
    "其他問題",
})

PUBLIC_REPORT_URGENCIES = frozenset({
    "normal",
    "possible_danger",
    "affecting_safety",
})

PUBLIC_REPORT_STATUSES = frozenset({
    "待檢視",
    "已確認",
    "需現勘",
    "已轉交",
    "已結案",
    "不受理 / 重複通報",
})
```

Add:

```python
def _today_report_prefix():
    from datetime import datetime
    return "TT-R-" + datetime.now().strftime("%Y%m%d")


def _next_public_report_no(conn):
    prefix = _today_report_prefix()
    row = conn.execute(
        "SELECT report_no FROM public_reports WHERE report_no LIKE ? ORDER BY report_no DESC LIMIT 1",
        (prefix + "-%",)
    ).fetchone()
    if not row:
        return prefix + "-0001"
    last = int(row["report_no"].rsplit("-", 1)[1])
    return f"{prefix}-{last + 1:04d}"


def create_public_report(payload):
    with db_conn() as conn:
        report_no = _next_public_report_no(conn)
        cur = conn.execute(
            """INSERT INTO public_reports (
                report_no, tree_code, tree_category, species_name, district, managing_unit,
                issue_type, urgency, description, location_text, lat, lng,
                needs_location_review, contact_name, contact_info, source, ip_hash, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                report_no,
                payload.get("tree_code"),
                payload.get("tree_category") or "unknown",
                payload.get("species_name") or "",
                payload.get("district") or "",
                payload.get("managing_unit") or "",
                payload["issue_type"],
                payload["urgency"],
                payload["description"],
                payload.get("location_text") or "",
                payload.get("lat"),
                payload.get("lng"),
                1 if payload.get("needs_location_review") else 0,
                payload.get("contact_name") or "",
                payload.get("contact_info") or "",
                payload.get("source") or "home_entry",
                payload.get("ip_hash") or "",
                payload.get("user_agent") or "",
            ),
        )
        report_id = cur.lastrowid
        return {"id": report_id, "report_no": report_no}


def get_public_report(report_id):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM public_reports WHERE id=?", (report_id,)).fetchone()
        return dict(row) if row else None
```

- [ ] **Step 5: Run tests and verify pass**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit backend DB task**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git add db.py tests/test_public_reports.py
git commit -m "feat: add public report schema"
```

---

## Task 2: Backend Public Report API

**Files:**
- Modify: `/Users/nash911/Claude_workProject/tree_app/app.py`
- Create: `/Users/nash911/Claude_workProject/tree_app/blueprints/public_reports/__init__.py`
- Create: `/Users/nash911/Claude_workProject/tree_app/blueprints/public_reports/routes.py`
- Modify: `/Users/nash911/Claude_workProject/tree_app/db.py`
- Test: `/Users/nash911/Claude_workProject/tree_app/tests/test_public_reports.py`

- [ ] **Step 1: Add failing API tests**

Append to `tests/test_public_reports.py`:

```python
def test_public_report_api_creates_report(client):
    res = client.post("/public/reports", json={
        "tree_code": "DA001",
        "tree_category": "street",
        "species_name": "樟樹",
        "district": "大安區",
        "managing_unit": "仁愛路",
        "issue_type": "樹牌或 QR Code 損壞",
        "urgency": "normal",
        "description": "樹牌上的 QR Code 已經模糊，無法掃描。",
        "location_text": "",
        "lat": 25.031,
        "lng": 121.535,
        "source": "tree_detail",
        "website": "",
    })

    assert res.status_code == 201
    data = res.get_json()
    assert data["report_no"].startswith("TT-R-")
    assert "緊急事項" in data["message"]


def test_public_report_api_rejects_honeypot(client):
    res = client.post("/public/reports", json={
        "issue_type": "其他問題",
        "urgency": "normal",
        "description": "這是一筆測試通報描述。",
        "location_text": "大安森林公園",
        "website": "spam",
    })

    assert res.status_code == 400
    assert res.get_json()["error"] == "無法送出通報"


def test_public_report_api_requires_valid_location(client):
    res = client.post("/public/reports", json={
        "issue_type": "其他問題",
        "urgency": "normal",
        "description": "這是一筆測試通報描述。",
        "website": "",
    })

    assert res.status_code == 400
    assert "位置" in res.get_json()["error"]
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: FAIL because `POST /public/reports` does not exist.

- [ ] **Step 3: Add request validation helper**

Create `blueprints/public_reports/routes.py` and add:

```python
def _clean_text(value):
    return (value or "").strip()


def _validate_public_report_payload(data):
    if _clean_text(data.get("website")):
        return None, "honeypot"

    issue_type = _clean_text(data.get("issue_type"))
    urgency = _clean_text(data.get("urgency"))
    description = _clean_text(data.get("description"))
    location_text = _clean_text(data.get("location_text"))
    tree_code = _clean_text(data.get("tree_code"))
    lat = data.get("lat")
    lng = data.get("lng")

    if issue_type not in DB.PUBLIC_REPORT_ISSUE_TYPES:
        return None, "請選擇有效的問題類型"
    if urgency not in DB.PUBLIC_REPORT_URGENCIES:
        return None, "請選擇有效的緊急程度"
    if len(description) < 10 or len(description) > 500:
        return None, "問題描述需為 10 到 500 字"

    has_coordinate = lat is not None and lng is not None
    if not tree_code and not location_text and not has_coordinate:
        return None, "請提供位置資訊"

    tree_category = _clean_text(data.get("tree_category")) or ("unknown" if not tree_code else "street")
    if tree_category not in {"street", "protected", "park", "unknown"}:
        tree_category = "unknown"

    payload = {
        "tree_code": tree_code or None,
        "tree_category": tree_category,
        "species_name": _clean_text(data.get("species_name")),
        "district": _clean_text(data.get("district")),
        "managing_unit": _clean_text(data.get("managing_unit")),
        "issue_type": issue_type,
        "urgency": urgency,
        "description": description,
        "location_text": location_text,
        "lat": lat,
        "lng": lng,
        "needs_location_review": not bool(tree_code),
        "contact_name": _clean_text(data.get("contact_name")),
        "contact_info": _clean_text(data.get("contact_info")),
        "source": _clean_text(data.get("source")) or "home_entry",
    }
    return payload, None
```

- [ ] **Step 4: Add public create route**

Add:

```python
@public_reports_bp.route("/public/reports", methods=["POST"])
def public_reports_create():
    data = request.get_json(silent=True) or {}
    payload, error = _validate_public_report_payload(data)
    if error == "honeypot":
        return jsonify(error="無法送出通報"), 400
    if error:
        return jsonify(error=error), 400

    ip_raw = request.headers.get("CF-Connecting-IP") or request.remote_addr or ""
    payload["ip_hash"] = hashlib.sha256((ip_raw + app.config.get("SECRET_KEY", "")).encode("utf-8")).hexdigest()
    payload["user_agent"] = request.headers.get("User-Agent", "")[:300]

    report = DB.create_public_report(payload)
    return jsonify(
        report_id=report["id"],
        report_no=report["report_no"],
        message=f"已收到您的通報，案件編號 {report['report_no']}。通報將由管理人員檢視。若為緊急事項，例如樹木倒伏、枝幹即將掉落、已影響人車安全，請立即聯絡 1999。",
    ), 201
```

- [ ] **Step 5: Import dependencies and blueprint**

At the top of `blueprints/public_reports/routes.py`, add:

```python
import hashlib
from flask import Blueprint, jsonify, request
import db as DB

public_reports_bp = Blueprint("public_reports", __name__)
```

- [ ] **Step 6: Register blueprint in `app.py`**

In `app.py`, after other blueprint imports, add:

```python
from blueprints.public_reports.routes import public_reports_bp
```

After the Flask app is created and existing blueprints are registered, add:

```python
app.register_blueprint(public_reports_bp)
```

- [ ] **Step 7: Run API tests**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit public API**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git add app.py db.py blueprints/public_reports tests/test_public_reports.py
git commit -m "feat: add public report api"
```

---

## Task 3: Backend Rate Limit And Photo Upload

**Files:**
- Modify: `/Users/nash911/Claude_workProject/tree_app/db.py`
- Modify: `/Users/nash911/Claude_workProject/tree_app/blueprints/public_reports/routes.py`
- Test: `/Users/nash911/Claude_workProject/tree_app/tests/test_public_reports.py`

- [ ] **Step 1: Add failing tests**

Append:

```python
def test_public_report_api_limits_description_length(client):
    res = client.post("/public/reports", json={
        "issue_type": "其他問題",
        "urgency": "normal",
        "description": "太短",
        "location_text": "大安森林公園",
        "website": "",
    })

    assert res.status_code == 400
    assert "10 到 500" in res.get_json()["error"]


def test_add_public_report_photo_records_photo(monkeypatch, tmp_path):
    test_db = tmp_path / "reports.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db), raising=False)
    db.init_db()
    db.migrate_db()
    report = db.create_public_report({
        "tree_code": "DA001",
        "tree_category": "street",
        "species_name": "樟樹",
        "district": "大安區",
        "managing_unit": "仁愛路",
        "issue_type": "其他問題",
        "urgency": "normal",
        "description": "測試通報描述文字足夠長。",
        "location_text": "",
        "lat": 25.031,
        "lng": 121.535,
        "needs_location_review": False,
        "source": "tree_detail",
        "ip_hash": "hash",
        "user_agent": "pytest",
    })

    db.add_public_report_photo(report["id"], "public_reports/1/demo.jpg")
    photos = db.get_public_report_photos(report["id"])
    assert photos[0]["photo_url"] == "public_reports/1/demo.jpg"
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: FAIL because photo helpers do not exist.

- [ ] **Step 3: Add photo DB helpers**

In `db.py`, add:

```python
def add_public_report_photo(report_id, photo_url):
    with db_conn() as conn:
        existing = conn.execute(
            "SELECT COUNT(*) AS c FROM public_report_photos WHERE report_id=?",
            (report_id,)
        ).fetchone()["c"]
        if existing >= 3:
            raise ValueError("最多只能上傳 3 張照片")
        cur = conn.execute(
            "INSERT INTO public_report_photos (report_id, photo_url) VALUES (?, ?)",
            (report_id, photo_url)
        )
        return cur.lastrowid


def get_public_report_photos(report_id):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM public_report_photos WHERE report_id=? ORDER BY id",
            (report_id,)
        ).fetchall()
        return [dict(r) for r in rows]
```

- [ ] **Step 4: Add upload route**

Follow the existing upload/storage pattern in TreeApp. Add route:

```python
@public_reports_bp.route("/public/reports/<int:report_id>/photos", methods=["POST"])
def public_report_photo_upload(report_id):
    report = DB.get_public_report(report_id)
    if not report:
        return jsonify(error="找不到通報案件"), 404
    if "photo" not in request.files:
        return jsonify(error="缺少 photo"), 400

    photo = request.files["photo"]
    if not photo.filename:
        return jsonify(error="缺少 photo"), 400
    if not allowed(photo.filename):
        return jsonify(error="不支援的檔案格式"), 400

    filename = secure_filename(photo.filename)
    ext = filename.rsplit(".", 1)[-1].lower()
    stored_name = f"public_reports/{report_id}/{uuid.uuid4().hex}.{ext}"
    photo_url = save_uploaded_image(photo, stored_name)
    photo_id = DB.add_public_report_photo(report_id, photo_url)
    return jsonify(photo_id=photo_id, photo_url=photo_url), 201
```

Use TreeApp's existing `storage.py` upload helper and `image_utils.py` compression pattern from the current `/api/assessment/<id>/photos` route. The implemented function must return a `photo_url` string that can be opened from the admin detail page.

- [ ] **Step 5: Run tests**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit photo/rate validation task**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git add app.py db.py tests/test_public_reports.py
git commit -m "feat: add public report photos"
```

---

## Task 4: Backend Admin List, Detail, And Status Update

**Files:**
- Modify: `/Users/nash911/Claude_workProject/tree_app/db.py`
- Modify: `/Users/nash911/Claude_workProject/tree_app/blueprints/public_reports/routes.py`
- Create: `/Users/nash911/Claude_workProject/tree_app/templates/admin_public_reports.html`
- Create: `/Users/nash911/Claude_workProject/tree_app/templates/admin_public_report_detail.html`
- Test: `/Users/nash911/Claude_workProject/tree_app/tests/test_public_reports.py`

- [ ] **Step 1: Add failing DB tests for admin queries**

Append:

```python
def test_list_public_reports_filters_status(monkeypatch, tmp_path):
    test_db = tmp_path / "reports.db"
    monkeypatch.setattr(db, "DB_PATH", str(test_db), raising=False)
    db.init_db()
    db.migrate_db()

    first = db.create_public_report({
        "tree_code": "DA001", "tree_category": "street", "species_name": "樟樹",
        "district": "大安區", "managing_unit": "仁愛路", "issue_type": "其他問題",
        "urgency": "normal", "description": "測試通報描述文字足夠長。",
        "location_text": "", "lat": 25.031, "lng": 121.535,
        "needs_location_review": False, "source": "tree_detail",
        "ip_hash": "hash", "user_agent": "pytest",
    })
    db.update_public_report_status(first["id"], "已確認", reviewed_by=1, internal_note="已檢視")

    rows = db.list_public_reports({"status": "已確認"})
    assert len(rows) == 1
    assert rows[0]["status"] == "已確認"
    assert rows[0]["internal_note"] == "已檢視"
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: FAIL because admin helpers do not exist.

- [ ] **Step 3: Add admin DB helpers**

In `db.py`, add:

```python
def list_public_reports(filters=None, limit=100):
    filters = filters or {}
    clauses = []
    params = []
    if filters.get("status"):
        clauses.append("status=?")
        params.append(filters["status"])
    if filters.get("issue_type"):
        clauses.append("issue_type=?")
        params.append(filters["issue_type"])
    if filters.get("urgency"):
        clauses.append("urgency=?")
        params.append(filters["urgency"])
    if filters.get("district"):
        clauses.append("district=?")
        params.append(filters["district"])
    if filters.get("unbound") == "1":
        clauses.append("tree_code IS NULL")
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"""SELECT r.*,
              (SELECT COUNT(*) FROM public_report_photos p WHERE p.report_id=r.id) AS photo_count
              FROM public_reports r
              {where}
              ORDER BY r.created_at DESC, r.id DESC
              LIMIT ?"""
    params.append(limit)
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


def update_public_report_status(report_id, status, reviewed_by=None, internal_note=None):
    if status not in PUBLIC_REPORT_STATUSES:
        return False
    with db_conn() as conn:
        conn.execute(
            """UPDATE public_reports
               SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP,
                   internal_note=COALESCE(?, internal_note), updated_at=CURRENT_TIMESTAMP
               WHERE id=?""",
            (status, reviewed_by, internal_note, report_id),
        )
    return True
```

- [ ] **Step 4: Add admin list route**

Add authenticated admin route:

```python
@public_reports_bp.route("/admin/public-reports")
@admin_required
def admin_public_reports():
    filters = {
        "status": request.args.get("status") or "",
        "issue_type": request.args.get("issue_type") or "",
        "urgency": request.args.get("urgency") or "",
        "district": request.args.get("district") or "",
        "unbound": request.args.get("unbound") or "",
    }
    reports = DB.list_public_reports(filters)
    return render_template("admin_public_reports.html", reports=reports, filters=filters)
```

- [ ] **Step 5: Add admin detail/status routes**

Add:

```python
@public_reports_bp.route("/admin/public-reports/<int:report_id>")
@admin_required
def admin_public_report_detail(report_id):
    report = DB.get_public_report(report_id)
    if not report:
        abort(404)
    photos = DB.get_public_report_photos(report_id)
    return render_template("admin_public_report_detail.html", report=report, photos=photos, statuses=DB.PUBLIC_REPORT_STATUSES)


@public_reports_bp.route("/admin/public-reports/<int:report_id>/status", methods=["POST"])
@admin_required
def admin_public_report_update_status(report_id):
    status = request.form.get("status") or ""
    internal_note = request.form.get("internal_note") or ""
    admin_id = session.get("admin_id")
    if not DB.update_public_report_status(report_id, status, reviewed_by=admin_id, internal_note=internal_note):
        flash("狀態不合法", "error")
        return redirect(url_for("admin_public_report_detail", report_id=report_id))
    flash("通報狀態已更新", "success")
    return redirect(url_for("admin_public_report_detail", report_id=report_id))
```

- [ ] **Step 6: Create admin list template**

Create `templates/admin_public_reports.html`:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>民眾通報</title>
</head>
<body>
  <h1>民眾通報</h1>
  <form method="get">
    <input name="status" placeholder="狀態" value="{{ filters.status }}">
    <input name="issue_type" placeholder="問題類型" value="{{ filters.issue_type }}">
    <input name="district" placeholder="行政區" value="{{ filters.district }}">
    <label><input type="checkbox" name="unbound" value="1" {% if filters.unbound == '1' %}checked{% endif %}> 只看未綁定</label>
    <button type="submit">篩選</button>
  </form>
  <table>
    <thead>
      <tr><th>案件</th><th>時間</th><th>類型</th><th>緊急</th><th>樹籍</th><th>行政區</th><th>狀態</th><th>照片</th></tr>
    </thead>
    <tbody>
      {% for r in reports %}
      <tr>
        <td><a href="/admin/public-reports/{{ r.id }}">{{ r.report_no }}</a></td>
        <td>{{ r.created_at }}</td>
        <td>{{ r.issue_type }}</td>
        <td>{{ r.urgency }}</td>
        <td>{{ r.tree_code or '未綁定' }}</td>
        <td>{{ r.district }}</td>
        <td>{{ r.status }}</td>
        <td>{{ r.photo_count }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</body>
</html>
```

- [ ] **Step 7: Create admin detail template**

Create `templates/admin_public_report_detail.html`:

```html
<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ report.report_no }}｜民眾通報</title>
</head>
<body>
  <a href="/admin/public-reports">← 民眾通報</a>
  <h1>{{ report.report_no }}</h1>
  <p><strong>狀態：</strong>{{ report.status }}</p>
  <p><strong>問題類型：</strong>{{ report.issue_type }}</p>
  <p><strong>緊急程度：</strong>{{ report.urgency }}</p>
  <p><strong>樹籍：</strong>{{ report.tree_code or '未綁定位置通報' }}</p>
  <p><strong>位置：</strong>{{ report.district }} {{ report.managing_unit }} {{ report.location_text }}</p>
  <p><strong>描述：</strong>{{ report.description }}</p>
  <p><strong>聯絡方式：</strong>{{ report.contact_name }} {{ report.contact_info }}</p>
  <p><strong>IP Hash：</strong>{{ report.ip_hash }}</p>
  <p><strong>User Agent：</strong>{{ report.user_agent }}</p>

  <h2>照片</h2>
  {% for p in photos %}
    <p><a href="{{ p.photo_url }}" target="_blank">{{ p.photo_url }}</a></p>
  {% else %}
    <p>無照片</p>
  {% endfor %}

  <h2>更新狀態</h2>
  <form method="post" action="/admin/public-reports/{{ report.id }}/status">
    <select name="status">
      {% for s in statuses %}
      <option value="{{ s }}" {% if s == report.status %}selected{% endif %}>{{ s }}</option>
      {% endfor %}
    </select>
    <textarea name="internal_note" rows="4" placeholder="內部備註">{{ report.internal_note or '' }}</textarea>
    <button type="submit">儲存</button>
  </form>
</body>
</html>
```

- [ ] **Step 8: Run tests**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
```

Expected: PASS.

- [ ] **Step 9: Commit admin MVP**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git add app.py db.py templates/admin_public_reports.html templates/admin_public_report_detail.html tests/test_public_reports.py
git commit -m "feat: add public report admin review"
```

---

## Task 5: Frontend Report Page Shell And Validation

**Files:**
- Create: `/Users/nash911/taipei-trees-frontend/report.html`
- Create: `/Users/nash911/taipei-trees-frontend/js/report.js`
- Modify: `/Users/nash911/taipei-trees-frontend/tests/smoke.spec.js`

- [ ] **Step 1: Add failing frontend tests**

Append to `tests/smoke.spec.js`:

```javascript
test('report.html 顯示民眾通報表單與 1999 提醒', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await expect(page).toHaveTitle(/通報樹木異常/);
  await expect(page.locator('h1')).toContainText('通報樹木異常');
  await expect(page.locator('#report-notice')).toContainText('不保證個案回覆');
  await expect(page.locator('#report-emergency-note')).toContainText('1999');
  await expect(page.locator('#issue-type')).toBeVisible();
  await expect(page.locator('#urgency')).toBeVisible();
});

test('report.html 未填必填欄位會提示', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('請選擇問題類型');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test tests/smoke.spec.js -g "report.html"
```

Expected: FAIL because `report.html` does not exist.

- [ ] **Step 3: Create `report.html`**

Create:

```html
<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <meta name="theme-color" content="#1a5c2a">
  <title>通報樹木異常｜台北市樹木查詢</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { background:#f0f4f1; min-height:100vh; }
    .report-header { background:#1a5c2a; color:#fff; padding:14px 16px; display:flex; gap:10px; align-items:center; }
    .report-header a { color:rgba(255,255,255,0.86); text-decoration:none; }
    .report-wrap { max-width:760px; margin:0 auto; padding:16px; }
    .report-card { background:#fff; border-radius:8px; padding:18px; margin-bottom:14px; box-shadow:0 2px 12px rgba(0,0,0,0.07); }
    .report-card h1 { color:#173f24; font-size:1.45rem; margin-bottom:8px; }
    .report-card p { color:#3f5948; line-height:1.7; }
    .report-field { display:grid; gap:6px; margin-bottom:14px; }
    .report-field label { color:#173f24; font-weight:800; font-size:0.9rem; }
    .report-field input, .report-field select, .report-field textarea {
      width:100%; border:1px solid #cfe0d2; border-radius:8px; padding:10px; font-size:1rem; background:#fff;
    }
    .report-field textarea { min-height:120px; resize:vertical; }
    .report-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .report-primary { border:0; border-radius:8px; padding:12px 16px; background:#1a5c2a; color:#fff; font-weight:900; cursor:pointer; }
    .report-secondary { border:1px solid #1a5c2a; border-radius:8px; padding:12px 16px; background:#fff; color:#1a5c2a; text-decoration:none; font-weight:800; }
    .report-alert { border-left:5px solid #d97706; background:#fff8e6; padding:12px; border-radius:8px; color:#6b430c; line-height:1.7; }
    .report-error { color:#b91c1c; font-weight:800; min-height:1.4em; }
    .hp-field { position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden; }
  </style>
</head>
<body>
  <header class="report-header">
    <a href="/">← 地圖</a>
    <strong>民眾通報</strong>
  </header>
  <main class="report-wrap">
    <section class="report-card">
      <h1>通報樹木異常</h1>
      <p id="report-notice">本平台協助收集樹木異常資訊，通報內容將提供管理人員檢視；本平台不保證個案回覆或處理時程。</p>
      <p id="report-emergency-note" class="report-alert">若為緊急事項，例如樹木倒伏、枝幹即將掉落、已影響人車安全，請立即聯絡 1999。</p>
    </section>
    <form class="report-card" id="report-form">
      <div class="hp-field">
        <label for="website">Website</label>
        <input id="website" name="website" autocomplete="off">
      </div>
      <div class="report-field">
        <label for="issue-type">問題類型</label>
        <select id="issue-type" name="issue_type">
          <option value="">請選擇</option>
          <option>枯枝、斷枝、掉枝風險</option>
          <option>樹木明顯傾斜或倒伏</option>
          <option>病蟲害或菇菌異常</option>
          <option>樹穴、支架、鋪面問題</option>
          <option>樹牌或 QR Code 損壞</option>
          <option>遮擋交通號誌、路牌、民宅</option>
          <option>其他問題</option>
        </select>
      </div>
      <div class="report-field">
        <label for="urgency">緊急程度</label>
        <select id="urgency" name="urgency">
          <option value="normal">一般</option>
          <option value="possible_danger">可能危險</option>
          <option value="affecting_safety">已影響人車安全</option>
        </select>
      </div>
      <div class="report-field">
        <label for="description">問題描述</label>
        <textarea id="description" name="description" maxlength="500" placeholder="請描述你看到的狀況，至少 10 個字。"></textarea>
      </div>
      <div class="report-field">
        <label for="location-text">位置描述</label>
        <input id="location-text" name="location_text" placeholder="例如：大安森林公園捷運站旁、仁愛路二段人行道">
      </div>
      <div class="report-field">
        <label for="photos">照片（選填，最多 3 張）</label>
        <input id="photos" name="photos" type="file" accept="image/*" multiple>
        <small>請避免拍到人臉、車牌、門牌等個資。</small>
      </div>
      <div class="report-field">
        <label for="contact-info">聯絡方式（選填）</label>
        <input id="contact-info" name="contact_info" placeholder="電話或 Email，可留空">
      </div>
      <div id="report-error" class="report-error" role="alert"></div>
      <div class="report-actions">
        <button id="report-submit" class="report-primary" type="submit">送出通報</button>
        <a class="report-secondary" href="/">回到地圖</a>
      </div>
    </form>
  </main>
  <script src="js/config.js"></script>
  <script src="js/report.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create `js/report.js` validation**

Create:

```javascript
const REPORT_API = `${API_BASE}/reports`;

function getReportPayload() {
  const params = new URLSearchParams(location.search);
  return {
    tree_code: params.get('tree_code') || '',
    tree_category: params.get('tree_category') || (params.get('tree_code') ? 'street' : 'unknown'),
    species_name: params.get('species_name') || '',
    district: params.get('district') || '',
    managing_unit: params.get('managing_unit') || '',
    source: params.get('source') || (params.get('tree_code') ? 'tree_detail' : 'home_entry'),
    issue_type: document.getElementById('issue-type').value,
    urgency: document.getElementById('urgency').value,
    description: document.getElementById('description').value.trim(),
    location_text: document.getElementById('location-text').value.trim(),
    contact_info: document.getElementById('contact-info').value.trim(),
    website: document.getElementById('website').value,
  };
}

function validateReport(payload) {
  if (!payload.issue_type) return '請選擇問題類型';
  if (payload.description.length < 10) return '問題描述需至少 10 個字';
  if (!payload.tree_code && !payload.location_text) return '請提供位置描述，或先從地圖選擇一棵樹';
  const photos = document.getElementById('photos').files;
  if (photos.length > 3) return '照片最多 3 張';
  return '';
}

async function submitReport(event) {
  event.preventDefault();
  const errorEl = document.getElementById('report-error');
  const payload = getReportPayload();
  const error = validateReport(payload);
  if (error) {
    errorEl.textContent = error;
    return;
  }
  errorEl.textContent = '';
  const button = document.getElementById('report-submit');
  button.disabled = true;
  button.textContent = '送出中…';
  try {
    const res = await fetch(REPORT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '通報送出失敗');
    document.getElementById('report-form').innerHTML = `
      <div class="report-alert">
        ${data.message || `已收到您的通報，案件編號 ${data.report_no}。若為緊急事項請立即聯絡 1999。`}
      </div>
      <div class="report-actions" style="margin-top:14px">
        <a class="report-secondary" href="/">回到地圖</a>
      </div>
    `;
  } catch (err) {
    errorEl.textContent = err.message || '通報送出失敗';
    button.disabled = false;
    button.textContent = '送出通報';
  }
}

document.getElementById('report-form').addEventListener('submit', submitReport);
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test tests/smoke.spec.js -g "report.html"
```

Expected: PASS.

- [ ] **Step 6: Commit frontend shell**

```bash
cd /Users/nash911/taipei-trees-frontend
git add report.html js/report.js tests/smoke.spec.js
git commit -m "feat: add public report form"
```

---

## Task 6: Frontend Entrypoints And Tree Context

**Files:**
- Modify: `/Users/nash911/taipei-trees-frontend/index.html`
- Modify: `/Users/nash911/taipei-trees-frontend/js/sheet.js`
- Modify: `/Users/nash911/taipei-trees-frontend/tree.html`
- Modify: `/Users/nash911/taipei-trees-frontend/js/tree.js`
- Modify: `/Users/nash911/taipei-trees-frontend/tests/smoke.spec.js`

- [ ] **Step 1: Add failing entrypoint tests**

Append:

```javascript
test('首頁顯示通報樹木異常入口', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('a[href="/report.html"]')).toContainText('通報樹木異常');
});

test('tree.html 顯示綁定樹木的通報按鈕', async ({ page }) => {
  await page.route('**/public/tree/TT0000000002', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'TT0000000002',
        species_name: '樟樹',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        height_m: 10,
        dbh_cm: 30,
      },
    }),
  }));
  await page.goto(BASE + '/tree.html?code=TT0000000002');
  const href = await page.locator('#tree-report-btn').getAttribute('href');
  expect(href).toContain('tree_code=TT0000000002');
  expect(href).toContain('species_name=');
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test tests/smoke.spec.js -g "通報"
```

Expected: FAIL because entrypoints do not exist.

- [ ] **Step 3: Add homepage entry**

In `index.html`, in `#public-intro .intro-steps`, add:

```html
<a class="intro-action-link" href="/report.html">通報樹木異常</a>
```

In `css/style.css`, style it with the existing intro pill language:

```css
.intro-action-link {
  display: inline-flex; align-items: center; min-height: 32px;
  padding: 6px 12px; border-radius: 18px;
  background: #1a5c2a; border: 1px solid #1a5c2a;
  color: #fff; font-size: 0.78rem; font-weight: 800;
  text-decoration: none; white-space: nowrap;
}
```

- [ ] **Step 4: Add tree detail report button**

In `tree.html`, in the bottom action area near share/back buttons, add:

```html
<a id="tree-report-btn" class="btn-report" href="/report.html">通報這棵樹</a>
```

Add page-local style:

```css
.btn-report {
  display:block; text-align:center; padding:12px 14px; border-radius:8px;
  background:#d97706; color:#fff; text-decoration:none; font-weight:900;
}
```

In `js/tree.js`, after tree data is loaded, set:

```javascript
const reportUrl = new URL('/report.html', location.origin);
reportUrl.searchParams.set('tree_code', tree.registry_code || '');
reportUrl.searchParams.set('tree_category', tree.tree_category || 'street');
reportUrl.searchParams.set('species_name', tree.species_name || '');
reportUrl.searchParams.set('district', tree.district || '');
reportUrl.searchParams.set('managing_unit', tree.managing_unit || '');
reportUrl.searchParams.set('source', 'tree_detail');
document.getElementById('tree-report-btn').href = reportUrl.pathname + reportUrl.search;
```

- [ ] **Step 5: Add map sheet action**

In `js/sheet.js`, when rendering the selected tree actions, add a report URL with the same query params:

```javascript
function buildReportUrlForTree(tree, source = 'map_sheet') {
  const url = new URL('/report.html', location.origin);
  url.searchParams.set('tree_code', tree.registry_code || '');
  url.searchParams.set('tree_category', tree.tree_category || 'street');
  url.searchParams.set('species_name', tree.species_name || '');
  url.searchParams.set('district', tree.district || '');
  url.searchParams.set('managing_unit', tree.managing_unit || '');
  url.searchParams.set('source', source);
  return url.pathname + url.search;
}
```

Then include a visible `通報問題` link in the sheet actions.

- [ ] **Step 6: Run entrypoint tests**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test tests/smoke.spec.js -g "通報"
```

Expected: PASS.

- [ ] **Step 7: Commit entrypoints**

```bash
cd /Users/nash911/taipei-trees-frontend
git add index.html css/style.css tree.html js/tree.js js/sheet.js tests/smoke.spec.js
git commit -m "feat: add public report entrypoints"
```

---

## Task 7: Frontend Submit Success, Location-Only Flow, And Photo Guard

**Files:**
- Modify: `/Users/nash911/taipei-trees-frontend/report.html`
- Modify: `/Users/nash911/taipei-trees-frontend/js/report.js`
- Modify: `/Users/nash911/taipei-trees-frontend/tests/smoke.spec.js`

- [ ] **Step 1: Add failing submit tests**

Append:

```javascript
test('report.html 可送出未綁定位置通報', async ({ page }) => {
  await page.route('**/public/reports', route => route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({
      report_id: 1,
      report_no: 'TT-R-20260606-0001',
      message: '已收到您的通報，案件編號 TT-R-20260606-0001。若為緊急事項請立即聯絡 1999。',
    }),
  }));
  await page.goto(BASE + '/report.html');
  await page.selectOption('#issue-type', '遮擋交通號誌、路牌、民宅');
  await page.fill('#description', '這棵樹的枝葉遮擋交通號誌，晚上不容易看到。');
  await page.fill('#location-text', '仁愛路與建國南路附近');
  await page.click('#report-submit');
  await expect(page.locator('#report-form')).toContainText('TT-R-20260606-0001');
  await expect(page.locator('#report-form')).toContainText('1999');
});

test('report.html 照片超過三張會提示', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await page.evaluate(() => {
    const input = document.getElementById('photos');
    Object.defineProperty(input, 'files', { value: [{}, {}, {}, {}], configurable: true });
  });
  await page.selectOption('#issue-type', '其他問題');
  await page.fill('#description', '這是一筆描述足夠長的測試通報。');
  await page.fill('#location-text', '大安森林公園');
  await page.click('#report-submit');
  await expect(page.locator('#report-error')).toContainText('照片最多 3 張');
});
```

- [ ] **Step 2: Run tests and verify current behavior**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test tests/smoke.spec.js -g "report.html"
```

Expected: first submit test may pass if Task 5 already implemented success state; photo test should pass after validation exists. If a test fails, update `js/report.js` to match the expected behavior exactly.

- [ ] **Step 3: Add bound tree context display**

In `report.html`, above the form fields, add:

```html
<div class="report-alert" id="tree-context" hidden></div>
```

In `js/report.js`, add:

```javascript
function renderTreeContext() {
  const params = new URLSearchParams(location.search);
  const code = params.get('tree_code');
  if (!code) return;
  const species = params.get('species_name') || '這棵樹';
  const district = params.get('district') || '';
  const managingUnit = params.get('managing_unit') || '';
  const el = document.getElementById('tree-context');
  el.hidden = false;
  el.textContent = `你正在通報 ${species}（${code}）${district ? '，' + district : ''}${managingUnit ? '，' + managingUnit : ''}`;
}

renderTreeContext();
```

- [ ] **Step 4: Run all frontend tests**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test
```

Expected: PASS.

- [ ] **Step 5: Commit report polish**

```bash
cd /Users/nash911/taipei-trees-frontend
git add report.html js/report.js tests/smoke.spec.js
git commit -m "feat: complete public report form flow"
```

---

## Task 8: Cross-Project Integration And Deployment

**Files:**
- Modify: `/Users/nash911/API_CONTRACT.md`
- Modify: `/Users/nash911/taipei-trees-frontend/docs/PROJECT_MEMORY.md`
- Modify: `/Users/nash911/Claude_workProject/tree_app/docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Update API contract**

In `/Users/nash911/API_CONTRACT.md`, add a section:

```markdown
## Public Tree Reports

### POST /public/reports

Creates a citizen tree issue report. Public, no login.

Request JSON fields:
- `tree_code` nullable
- `tree_category`: `street/protected/park/unknown`
- `species_name` nullable
- `district` nullable
- `managing_unit` nullable
- `issue_type`
- `urgency`: `normal/possible_danger/affecting_safety`
- `description`
- `location_text` nullable
- `lat` nullable
- `lng` nullable
- `contact_name` nullable
- `contact_info` nullable
- `source`
- `website` honeypot

Response 201:
```json
{
  "report_id": 1,
  "report_no": "TT-R-20260606-0001",
  "message": "已收到您的通報..."
}
```
```

- [ ] **Step 2: Update project memories**

In both project memories, record:

```markdown
民眾通報 MVP 已實作。定位為公開收件與後台審核，不是 1999 替代品，不公開個案，不承諾處理時程。前台入口位於首頁、地圖 sheet、tree.html；後台由 TreeApp platform_admin 檢視。
```

- [ ] **Step 3: Run backend tests**

Run:

```bash
cd /Users/nash911/Claude_workProject/tree_app
pytest tests/test_public_reports.py -q
pytest tests/test_public_api.py tests/test_security.py -q
```

Expected: PASS.

- [ ] **Step 4: Run frontend tests**

Run:

```bash
cd /Users/nash911/taipei-trees-frontend
npx playwright test
```

Expected: PASS.

- [ ] **Step 5: Commit docs**

```bash
cd /Users/nash911/taipei-trees-frontend
git add docs/PROJECT_MEMORY.md /Users/nash911/API_CONTRACT.md
git commit -m "docs: document public report api"

cd /Users/nash911/Claude_workProject/tree_app
git add docs/PROJECT_MEMORY.md
git commit -m "docs: record public reports mvp"
```

- [ ] **Step 6: Push both repos**

```bash
cd /Users/nash911/Claude_workProject/tree_app
git push origin main

cd /Users/nash911/taipei-trees-frontend
git push origin main
```

Expected: GitHub push succeeds. Cloudflare Pages deploys frontend automatically. TreeApp still requires NAS deployment using the project’s existing NAS deployment flow.

---

## Self-Review

Spec coverage:

- Public no-login reporting: Tasks 2, 5, 7.
- Tree-bound reports: Tasks 5, 6.
- Unbound location reports: Tasks 1, 2, 7.
- Seven issue types: Tasks 1, 2, 5.
- Optional contact: Tasks 1, 2, 5.
- Optional photos max three: Tasks 3, 7.
- 1999 warning and no guaranteed response copy: Tasks 5, 7.
- Honeypot/rate-limit validation: Tasks 2 and 3. Rate-limit implementation should reuse TreeApp's existing limiter where available.
- Admin list/detail/statuses: Task 4.
- Park tree future support: Task 1 schema.
- API contract and memory updates: Task 8.

Placeholder scan:

- No placeholder markers remain in the plan.
- No placeholder markers remain in the plan.

Type consistency:

- `tree_category`, `issue_type`, `urgency`, `needs_location_review`, `report_no`, `source`, and status labels match the approved design spec.
