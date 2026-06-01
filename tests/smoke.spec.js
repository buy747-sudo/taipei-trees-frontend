const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8080';

test('頁面標題正確', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/台北市樹木查詢/);
});

test('地圖容器存在且 Leaflet 初始化', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#map-container')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 5000 });
});

test('搜尋欄和掃碼按鈕存在', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#search-input')).toBeVisible();
  await expect(page.locator('#scan-btn')).toBeVisible();
});

test('Filter chips 存在且可切換', async ({ page }) => {
  await page.goto(BASE);
  const streetChip = page.locator('.chip[data-cat="street"]');
  await expect(streetChip).toBeVisible();
  await streetChip.click();
  await expect(streetChip).toHaveClass(/active/);
});

test('統計面板可展開', async ({ page }) => {
  await page.goto(BASE);
  await page.locator('#stats-toggle').click();
  await expect(page.locator('#stats-panel')).toBeVisible();
  await expect(page.locator('#stats-table')).toBeVisible();
});

test('授權聲明頁底存在且含 OGDL 字樣', async ({ page }) => {
  await page.goto(BASE);
  const footer = page.locator('#license-footer');
  await expect(footer).toBeVisible();
  await expect(footer).toContainText('OGDL');
  await expect(footer).toContainText('data.taipei');
});

test('行政區下拉選單有 12 個選項', async ({ page }) => {
  await page.goto(BASE);
  const options = await page.locator('#filter-district option').count();
  expect(options).toBe(13); // 1 empty + 12 districts
});

// ── tree.html ────────────────────────────────────────────────────────────────
test('tree.html 無 code 參數顯示錯誤訊息', async ({ page }) => {
  await page.goto(BASE + '/tree.html');
  await expect(page.locator('#error-msg')).toBeVisible({ timeout: 5000 });
});

test('tree.html 有效 code 顯示效益卡片', async ({ page }) => {
  await page.goto(BASE + '/tree.html?code=JS0750021125');
  await expect(page.locator('#tree-content')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#benefit-section')).toBeVisible();
  await expect(page.locator('#bc-co2')).not.toHaveText('—');
});

test('tree.html 計算說明折疊區存在', async ({ page }) => {
  await page.goto(BASE + '/tree.html?code=JS0750021125');
  await expect(page.locator('details summary')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('details summary')).toContainText('計算方式說明');
});

// ── survey.html ───────────────────────────────────────────────────────────────
test('survey.html 未登入自動跳登入頁', async ({ page }) => {
  // 清除 localStorage 確保未登入
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/survey.html');
  await expect(page).toHaveURL(/login\.html/, { timeout: 5000 });
});

test('survey.html 登入後顯示步驟列', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => {
    localStorage.setItem('tt_token', 'fake-token');
    localStorage.setItem('tt_user', JSON.stringify({
      id: 1, username: 'nash911', display_name: '白老闆',
      role: 'platform_admin', contractor_id: 'YR001'
    }));
  });
  await page.goto(BASE + '/survey.html');
  await expect(page.locator('#step-bar')).toBeVisible();
  await expect(page.locator('[data-step="0"].active')).toBeVisible();
  await expect(page.locator('#qr-btn')).toBeVisible();
});

// ── about.html + guide.html ──────────────────────────────────────────────────
test('about.html 頁面載入正常', async ({ page }) => {
  await page.goto(BASE + '/about.html');
  await expect(page).toHaveTitle(/知識庫|台北市樹木/);
});

test('guide.html 頁面載入正常', async ({ page }) => {
  await page.goto(BASE + '/guide.html');
  await expect(page).toHaveTitle(/說明|台北市樹木/);
});
