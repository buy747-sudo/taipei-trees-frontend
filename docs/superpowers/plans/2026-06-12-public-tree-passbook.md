# Public Tree Passbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the public single-tree bottom sheet into a citizen-facing ecological passbook with local "tree mailbox" blessing tags and no public maintenance-record promise.

**Architecture:** Keep the existing static frontend and bottom-sheet flow. Add passbook markup to `index.html`, render it from `js/sheet.js`, store blessing tags in `localStorage` keyed by tree registry code, and style the module in `css/style.css`. No backend changes in this phase.

**Tech Stack:** Static HTML/CSS/JavaScript, Leaflet, Playwright smoke tests.

---

### Task 1: Cover The Passbook In Tests

**Files:**
- Modify: `tests/smoke.spec.js`

- [ ] **Step 1: Write the failing test**

Add a Playwright test that opens a mocked tree sheet, expects ecological passbook text, expects no public maintenance-record section, creates one blessing tag, and verifies it appears in the mailbox.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/smoke.spec.js -g "首頁底部 sheet 顯示民眾版生態存摺與樹的信箱"`

Expected: FAIL because `#sheet-passbook` and `#tree-mailbox` do not exist.

### Task 2: Add Passbook Markup

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add containers**

Add `#sheet-passbook` and `#tree-mailbox` inside `#sheet-content`, between the title/story area and the old table/actions, so the new citizen-facing content appears first and detailed data remains below.

### Task 3: Render Passbook And Local Blessing Tags

**Files:**
- Modify: `js/sheet.js`

- [ ] **Step 1: Add localStorage helpers**

Add helpers to read/write messages under `tt_tree_mailbox:<registry_code>`, clamp nickname to 10 characters, clamp message to 100 characters, escape HTML, and re-render after submit.

- [ ] **Step 2: Render ecological passbook**

In `openSheet(tree)`, render district/DBH/category chips, annual CO2, and a citizen-facing explanation. Do not render maintenance records.

- [ ] **Step 3: Render mailbox form**

Render mood buttons, nickname input, 100-character textarea, character counter, and submit button. On submit, save a local blessing tag and re-render.

### Task 4: Style The Module

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Add compact mobile-first passbook styles**

Style the ecological card, mailbox section, mood buttons, blessing tags, inputs, and submit button with the existing green palette and 8px radius.

### Task 5: Verify And Ship

**Files:**
- Test: `tests/smoke.spec.js`
- Modify: `docs/PROJECT_MEMORY.md`

- [ ] **Step 1: Run targeted and full tests**

Run:
`npx playwright test tests/smoke.spec.js -g "首頁底部 sheet 顯示民眾版生態存摺與樹的信箱"`
`npx playwright test tests/smoke.spec.js`

- [ ] **Step 2: Record project memory**

Add a short note explaining that public maintenance records are intentionally omitted, and the first passbook phase uses local browser blessing tags only.

- [ ] **Step 3: Commit and push**

Commit message: `feat: add public tree passbook mailbox`
