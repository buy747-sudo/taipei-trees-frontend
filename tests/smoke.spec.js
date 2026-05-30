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
