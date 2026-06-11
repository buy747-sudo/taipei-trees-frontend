# Homepage Public UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public homepage feel like a citizen tree lookup entry point while keeping professional work features behind login.

**Architecture:** Keep the static HTML/CSS/JS architecture. Move public education links out of the header into an "探索台北樹木" card section, keep the header focused on title, search, scan, help, and login/work area, and preserve existing pages/routes. Adjust map sizing before first load so the initial bbox is based on the real visible map area.

**Tech Stack:** Static HTML/CSS/JS, Leaflet 1.9.4, Playwright smoke tests, Cloudflare Pages.

---

### Task 1: Header and Public Exploration Layout

**Files:**
- Modify: `/Users/nash911/taipei-trees-frontend/index.html`
- Modify: `/Users/nash911/taipei-trees-frontend/css/style.css`
- Test: `/Users/nash911/taipei-trees-frontend/tests/smoke.spec.js`

- [x] **Step 1: Update tests for the new public IA**

Change the homepage navigation smoke test to assert that `#page-nav-strip` no longer appears in the top header, and that the public feature links appear in `#explore-section`.

- [x] **Step 2: Move public links to an explore section**

Remove `#page-nav-strip` from `#top-title-row`. Add a new `#explore-section` after the map/list area with six cards: 城市綠資產、樹種百科、生態效益、固碳排行、受保護樹木、使用說明.

- [x] **Step 3: Keep professional work behind login**

Remove the always-visible top `通報異常` link from the public header. Keep `auth-area` as the login/work entry. Keep the per-tree sheet report button because it is contextual to a selected tree.

- [x] **Step 4: Style the header and explore cards**

Make the header compact and focused. Add responsive 2-column explore cards with clear labels and short descriptions. Avoid putting professional-only actions into public navigation.

- [x] **Step 5: Run homepage smoke tests**

Run `npx playwright test tests/smoke.spec.js -g "首頁|地圖|Filter|report.html"` and fix failures.

### Task 2: First Map View and Count Label Polish

**Files:**
- Modify: `/Users/nash911/taipei-trees-frontend/js/app.js`
- Modify: `/Users/nash911/taipei-trees-frontend/js/map.js`
- Test: `/Users/nash911/taipei-trees-frontend/tests/smoke.spec.js`

- [x] **Step 1: Ensure map size is finalized before first tree load**

Call `fitMapToViewport()` synchronously before the first `loadTrees()`, then invalidate size and center the homepage at `INITIAL_MAP_CENTER = [24.9915, 121.548]` so the first data points appear near the middle of the map.

- [x] **Step 2: Keep the list capped at 50 trees**

Preserve `trees.slice(0, 50)` and the `此範圍顯示 50 棵` style count label.

- [x] **Step 3: Run full smoke tests**

Run `npx playwright test`. Expected: all tests pass.

### Task 3: Project Memory Record

**Files:**
- Modify: `/Users/nash911/taipei-trees-frontend/docs/PROJECT_MEMORY.md`

- [x] **Step 1: Add a 2026-06-11 homepage UX note**

Record that the homepage is now public-first, that public learning links moved into an explore section, and that professional work actions remain behind login.

- [ ] **Step 2: Commit and push**

Commit with `feat: refresh homepage public UX` and push `main` after verification.
