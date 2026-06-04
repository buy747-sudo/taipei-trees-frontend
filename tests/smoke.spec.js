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

// ── risk.html ────────────────────────────────────────────────────────────────
test('risk.html 風險選項依扣分與關鍵因子顯示嚴重度色彩', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tt_token', 'fake-token');
    localStorage.setItem('tt_user', JSON.stringify({
      id: 1, username: 'nash911', display_name: '白老闆',
      role: 'platform_admin', contractor_id: 'YR001'
    }));
  });

  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: { trunk: '二、樹幹狀況' },
      env_risk_options: [
        { value: 'low', label: '低風險', desc: '低使用頻率', example: '偏僻綠地' },
        { value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' },
        { value: 'high', label: '高風險', desc: '高頻活動區', example: '捷運出口' },
      ],
      angle_labels: {},
      items: [{
        no: 5,
        key: 'q5',
        section: 'trunk',
        title: '生物性危害',
        type: 'checkbox',
        options: [
          { value: -1, key: 'q5b', label: '寄生植物', hint: '如桑寄生，與樹木爭奪水分養分', cf: false },
          { value: -5, key: 'q5e', label: '樹幹異常流膠或潰瘍', hint: '大量樹液滲出、樹皮下陷腐爛', cf: true },
          { value: -10, key: 'q5g', label: '菇菌類（真菌子實體）', hint: '樹幹出現蕈類，木材已嚴重腐朽', cf: true },
        ],
      }],
    }),
  }));
  await page.route('**/public/tree/JS0750021125', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'JS0750021125',
        species_name: '榕樹',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
      },
    }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await expect(page.locator('#step-tree-info')).toBeVisible();
  await page.locator('#start-assessment-btn').click();

  const parasite = page.locator('.option-item', { hasText: '寄生植物' });
  const canker = page.locator('.option-item', { hasText: '樹幹異常流膠或潰瘍' });
  const fungus = page.locator('.option-item', { hasText: '菇菌類' });

  await expect(parasite).toHaveClass(/score-ok/);
  await expect(canker).toHaveClass(/score-alert/);
  await expect(fungus).toHaveClass(/score-danger/);
  await expect(canker.locator('.cf-badge')).toContainText('關鍵');
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
