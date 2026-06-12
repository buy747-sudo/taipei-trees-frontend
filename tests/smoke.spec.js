const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8080';

async function loginAsTester(page) {
  await page.addInitScript(() => {
    localStorage.setItem('tt_token', 'fake-token');
    localStorage.setItem('tt_user', JSON.stringify({
      id: 1, username: 'demo', display_name: 'Demo 測試帳號',
      role: 'inspector', contractor_id: 'YR001'
    }));
  });
}

async function installPdfFontMocks(page) {
  await page.evaluate(() => {
    window.__pdfCalls = [];
    window.fetch = async (url) => {
      window.__pdfCalls.push(['fetch', url]);
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      };
    };
    window.loadScript = async (src) => {
      window.__pdfCalls.push(['loadScript', src]);
    };
    class FakePdf {
      constructor(opts) {
        window.__pdfCalls.push(['newPDF', opts]);
        this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
      }
      addFileToVFS(...args) { window.__pdfCalls.push(['addFileToVFS', ...args]); }
      addFont(...args) { window.__pdfCalls.push(['addFont', ...args]); }
      addPage() { window.__pdfCalls.push(['addPage']); }
      save(name) { window.__pdfCalls.push(['save', name]); }
      setFillColor() {}
      rect() {}
      setTextColor() {}
      setFontSize() {}
      setFont(...args) { window.__pdfCalls.push(['setFont', ...args]); }
      text(...args) { window.__pdfCalls.push(['text', ...args]); }
      roundedRect() {}
      splitTextToSize(text) { return [text]; }
    }
    window.jspdf = { jsPDF: FakePdf };
  });
}

test('頁面標題正確', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle(/台北市樹木查詢/);
});

test('首頁保留 SEO 標題並顯示民眾探索入口', async ({ page }) => {
  await page.goto(BASE);
  await expect(page).toHaveTitle('台北市樹木查詢｜行道樹 & 受保護樹｜掃碼即時查詢');
  await expect(page.locator('#page-nav-strip')).toHaveCount(0);
  await expect(page.locator('#tree-list')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('此範圍顯示');
  await expect(page.locator('#explore-section')).toContainText('城市綠資產');
  await expect(page.locator('#explore-section')).toContainText('樹種百科');
  await expect(page.locator('#explore-section')).toContainText('受保護樹木');
  await expect(page.locator('#explore-section a[href="/typhoon-safety.html"]')).toContainText('颱風樹木安全');
  await expect(page.locator('#explore-section a[href="/tree-risk-guide.html"]')).toContainText('樹木風險怎麼看');
  await expect(page.locator('#auth-login-btn')).toContainText('工作登入');
});

test('首頁電腦版採地圖加右側探索欄', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto(BASE);
  const layout = await page.evaluate(() => {
    const map = document.getElementById('map-container').getBoundingClientRect();
    const explore = document.getElementById('explore-section').getBoundingClientRect();
    const grid = getComputedStyle(document.getElementById('explore-section').querySelector('.explore-grid'));
    return {
      mapLeft: map.left,
      mapRight: map.right,
      exploreLeft: explore.left,
      columns: grid.gridTemplateColumns.split(' ').length,
    };
  });
  expect(layout.exploreLeft).toBeGreaterThan(layout.mapRight - 2);
  expect(layout.columns).toBe(1);
});

test('首頁平板版採堆疊地圖與雙欄探索', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto(BASE);
  const layout = await page.evaluate(() => {
    const map = document.getElementById('map-container').getBoundingClientRect();
    const explore = document.getElementById('explore-section').getBoundingClientRect();
    const grid = getComputedStyle(document.getElementById('explore-section').querySelector('.explore-grid'));
    return {
      exploreTop: explore.top,
      mapBottom: map.bottom,
      columns: grid.gridTemplateColumns.split(' ').length,
    };
  });
  expect(layout.exploreTop).toBeGreaterThan(layout.mapBottom - 2);
  expect(layout.columns).toBe(2);
});

test('首頁手機版隱藏資料列並維持觸控優先', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE);
  const layout = await page.evaluate(() => {
    const dataBar = getComputedStyle(document.getElementById('data-bar')).display;
    const map = document.getElementById('map-container').getBoundingClientRect();
    const search = document.getElementById('search-input').getBoundingClientRect();
    const scan = document.getElementById('scan-btn').getBoundingClientRect();
    const grid = getComputedStyle(document.getElementById('explore-section').querySelector('.explore-grid'));
    return {
      dataBar,
      mapHeight: map.height,
      searchHeight: search.height,
      scanHeight: scan.height,
      columns: grid.gridTemplateColumns.split(' ').length,
    };
  });
  expect(layout.dataBar).toBe('none');
  expect(layout.mapHeight).toBeGreaterThan(420);
  expect(layout.searchHeight).toBeGreaterThanOrEqual(44);
  expect(layout.scanHeight).toBeGreaterThanOrEqual(44);
  expect(layout.columns).toBe(2);
});

test('首頁依裝置與 zoom 動態調整地圖載入量', async ({ context }) => {
  async function firstLimitFor(width, zoom) {
    const page = await context.newPage();
    const limits = [];
    await page.setViewportSize({ width, height: 820 });
    await page.route('**/public/trees**', route => {
      const url = new URL(route.request().url());
      limits.push(url.searchParams.get('limit'));
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ total: 0, trees: [] }),
      });
    });
    await page.addInitScript(z => {
      window.__TT_TEST_ZOOM__ = z;
    }, zoom);
    await page.goto(BASE);
    await expect.poll(() => limits[0]).toBeTruthy();
    const limit = Number(limits[0]);
    await page.close();
    return limit;
  }

  expect(await firstLimitFor(390, 14)).toBe(300);
  expect(await firstLimitFor(820, 14)).toBe(500);
  expect(await firstLimitFor(1280, 14)).toBe(800);
  expect(await firstLimitFor(1280, 12)).toBe(300);
  expect(await firstLimitFor(1280, 17)).toBe(1200);
});

test('首頁地圖樹點依樹種分類與冠幅呈現顏色形狀大小', async ({ page }) => {
  await page.route('**/public/trees**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      total: 6,
      trees: [
        { registry_code: 'EV001', species_name: '樟樹', tree_category: 'street', lat: 24.991, lng: 121.548, crown_m: 4 },
        { registry_code: 'DE001', species_name: '楓香', tree_category: 'street', lat: 24.992, lng: 121.548, crown_m: 8 },
        { registry_code: 'PA001', species_name: '大王椰子', tree_category: 'street', lat: 24.993, lng: 121.548, crown_m: 6 },
        { registry_code: 'CO001', species_name: '黑松', tree_category: 'street', lat: 24.994, lng: 121.548, crown_m: 5 },
        { registry_code: 'FL001', species_name: '鳳凰木', tree_category: 'street', lat: 24.995, lng: 121.548, crown_m: 7 },
        { registry_code: 'PR001', species_name: '榕樹', tree_category: 'protected', lat: 24.996, lng: 121.548, crown_m: 10 },
      ],
    }),
  }));

  await page.goto(BASE);
  await expect(page.locator('.tree-marker')).toHaveCount(6);
  await expect(page.locator('.tree-marker.evergreen')).toHaveAttribute('title', /樟樹/);
  await expect(page.locator('.tree-marker.deciduous')).toHaveAttribute('title', /楓香/);
  await expect(page.locator('.tree-marker.palm')).toHaveAttribute('title', /大王椰子/);
  await expect(page.locator('.tree-marker.conifer')).toHaveAttribute('title', /黑松/);
  await expect(page.locator('.tree-marker.flowering')).toHaveAttribute('title', /鳳凰木/);
  await expect(page.locator('.tree-marker.protected')).toHaveAttribute('title', /榕樹/);

  const sizes = await page.evaluate(() => {
    const evergreen = document.querySelector('.tree-marker.evergreen').getBoundingClientRect();
    const deciduous = document.querySelector('.tree-marker.deciduous').getBoundingClientRect();
    return { evergreen: evergreen.width, deciduous: deciduous.width };
  });
  expect(sizes.deciduous).toBeGreaterThan(sizes.evergreen);
});

test('首頁移動地圖遇到暫時載入失敗時保留既有樹點且不打擾', async ({ page }) => {
  let calls = 0;
  await page.route('**/public/trees**', route => {
    calls += 1;
    if (calls === 1) {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          total: 1,
          trees: [
            { registry_code: 'KEEP001', species_name: '樟樹', tree_category: 'street', lat: 24.991, lng: 121.548, crown_m: 4 },
          ],
        }),
      });
      return;
    }
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'temporary unavailable' }),
    });
  });

  await page.goto(BASE);
  await expect(page.locator('.tree-marker')).toHaveCount(1);
  await page.evaluate(() => window.getMap().panTo([25.03, 121.56], { animate: false }));
  await page.waitForTimeout(7000);

  await expect(page.locator('.tree-marker')).toHaveCount(1);
  await expect(page.locator('#toast')).not.toContainText('無法載入樹木資料');
  await expect(page.locator('#count-label')).toContainText('點選地圖上的樹木查看詳情');
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

test('data-policy.html 標明教育部校園樹木 Open Data 來源與授權', async ({ page }) => {
  await page.goto(BASE + '/data-policy.html');
  await expect(page.locator('body')).toContainText('教育部校園樹木資訊平臺');
  await expect(page.locator('body')).toContainText('School/GetTrees');
  await expect(page.locator('body')).toContainText('Open Government Data License');
  await expect(page.locator('a[href="https://edutreemap.moe.edu.tw/trees/#/OpenData"]')).toBeVisible();
  await expect(page.locator('a[href="https://data.gov.tw/license"]').first()).toBeVisible();
});

test('進階查詢行政區下拉選單有 12 個選項', async ({ page }) => {
  await page.goto(BASE);
  const options = await page.locator('#adv-district option').count();
  expect(options).toBe(13); // 1 empty + 12 districts
});

test('daan-forest-dashboard.html 顯示大安森林公園碳匯儀表板', async ({ page }) => {
  await page.route('**/public/trees**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      total: 4,
      trees: [
        { registry_code: 'DA001', species_name: '樟樹', dbh_cm: 40, height_m: 12, crown_m: 8, lat: 25.031, lng: 121.535, carbon_kg: 500, annual_co2_kg: 20 },
        { registry_code: 'DA002', species_name: '樟樹', dbh_cm: 35, height_m: 11, crown_m: 7, lat: 25.030, lng: 121.536, carbon_kg: 390, annual_co2_kg: 15 },
        { registry_code: 'DA003', species_name: '榕樹', dbh_cm: 62, height_m: 17, crown_m: 13, lat: 25.029, lng: 121.537, carbon_kg: 1180, annual_co2_kg: 48 },
        { registry_code: 'DA004', species_name: '茄苳', dbh_cm: 32, height_m: 10, crown_m: 6, lat: 25.032, lng: 121.534, carbon_kg: 260, annual_co2_kg: 10 },
      ],
    }),
  }));

  await page.goto(BASE + '/daan-forest-dashboard.html');
  await expect(page).toHaveTitle(/大安森林公園碳匯儀表板/);
  await expect(page.locator('h1')).toContainText('大安森林公園');
  await expect(page.locator('#data-status')).toContainText('即時資料');
  await expect(page.locator('#metric-count')).toContainText('4');
  await expect(page.locator('#species-bars')).toContainText('樟樹');
  await expect(page.locator('#daan-map')).toBeVisible();
});

test('green-assets.html 不顯示校園樹木區塊避免資料量過少造成誤導', async ({ page }) => {
  await page.route('**/public/stats', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      total: 100,
      street: 96,
      protected: 4,
      total_carbon_tonnes: 1200,
      total_annual_co2_tonnes: 80,
      by_district: {
        '大安區': { total: 60, street: 58, protected: 2, carbon_tonnes: 700 },
        '中正區': { total: 40, street: 38, protected: 2, carbon_tonnes: 500 },
      },
      top_species: [
        { name: '樟樹', count: 40 },
        { name: '榕樹', count: 30 },
      ],
    }),
  }));

  await page.goto(BASE + '/green-assets.html');
  await expect(page.locator('#campus-assets')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('校園樹木延伸統計');
  await expect(page.locator('body')).not.toContainText('校園樹木資料可用性統計');
  await expect(page.locator('body')).not.toContainText('銘傳大學');
  await expect(page.locator('body')).not.toContainText('康寧大學');
  await expect(page.locator('body')).not.toContainText('校園樹木延伸資料來源');
});

// ── report.html ─────────────────────────────────────────────────────────────
test('首頁公開頂部不顯示通報大按鈕', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('#report-nav-btn')).toHaveCount(0);
  await expect(page.locator('.intro-report-link')).toHaveCount(0);
});

test('首頁探索區提供低干擾的樹木異常通報入口', async ({ page }) => {
  await page.goto(BASE);
  const reportCard = page.locator('#explore-section a[href="/report.html"]');
  await expect(reportCard).toBeVisible();
  await expect(reportCard).toContainText('通報樹木異常');
  await expect(reportCard).toContainText('緊急狀況請聯絡 1999');
});

test('report.html 顯示民眾通報表單與 1999 提醒', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await expect(page).toHaveTitle(/通報樹木異常/);
  await expect(page.locator('h1')).toContainText('通報樹木異常');
  await expect(page.locator('#report-notice')).toContainText('不保證個案回覆');
  await expect(page.locator('#report-emergency-note')).toContainText('1999');
  await expect(page.locator('a[href="/typhoon-safety.html"]')).toContainText('颱風前後樹木安全');
  await expect(page.locator('#issue-type-group')).toContainText('遮擋交通號誌、路牌、民宅');
  await expect(page.locator('#urgency')).toBeVisible();
});

test('typhoon-safety.html 顯示颱風前中後樹木安全與 1999 分流', async ({ page }) => {
  await page.goto(BASE + '/typhoon-safety.html');
  await expect(page).toHaveTitle(/颱風前後樹木安全/);
  await expect(page.locator('h1')).toContainText('颱風前後樹木安全');
  await expect(page.locator('body')).toContainText('颱風前');
  await expect(page.locator('body')).toContainText('颱風中');
  await expect(page.locator('body')).toContainText('颱風後');
  await expect(page.locator('body')).toContainText('1999');
  await expect(page.locator('body')).toContainText('本站接受通報，不保證回覆、處理時程或派工結果');
  await expect(page.locator('a[href="/report.html"]')).toBeVisible();
  await expect(page.locator('a[href="/tree-risk-guide.html"]')).toBeVisible();
});

test('tree-risk-guide.html 以台灣通俗語言說明樹木風險三件事', async ({ page }) => {
  await page.goto(BASE + '/tree-risk-guide.html');
  await expect(page).toHaveTitle(/樹木風險怎麼看/);
  await expect(page.locator('h1')).toContainText('樹木風險怎麼看');
  await expect(page.locator('body')).toContainText('會不會斷或倒');
  await expect(page.locator('body')).toContainText('會不會打到人車');
  await expect(page.locator('body')).toContainText('後果嚴不嚴重');
  await expect(page.locator('body')).toContainText('緊急狀況請聯絡 1999');
  await expect(page.locator('body')).not.toContainText('失效可能性');
  await expect(page.locator('body')).not.toContainText('衝擊可能性');
  await expect(page.locator('body')).not.toContainText('International Society of Arboriculture');
  await expect(page.locator('a[href="/report.html"]')).toBeVisible();
});

test('report.html 未填必填欄位會提示', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('請選擇問題類型');
});

test('report.html 未指定樹木且無位置會提示', async ({ page }) => {
  await page.goto(BASE + '/report.html');
  await page.locator('input[name="issue_type"][value="其他問題"]').check();
  await page.locator('#description').fill('樹木旁邊看起來有異常狀況，需要管理人員協助查看。');
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('請提供位置描述');
});

test('report.html 照片超過 3 張會提示', async ({ page }) => {
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLq2SAAAAABJRU5ErkJggg==',
    'base64'
  );
  await page.goto(BASE + '/report.html?tree_code=TT0000000001&tree_category=street');
  await page.locator('input[name="issue_type"][value="其他問題"]').check();
  await page.locator('#description').fill('樹木旁邊看起來有異常狀況，需要管理人員協助查看。');
  await page.locator('#photos').setInputFiles([1, 2, 3, 4].map(i => ({
    name: `photo-${i}.png`,
    mimeType: 'image/png',
    buffer: tinyPng,
  })));
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('照片最多 3 張');
});

test('report.html 照片超過 8MB 會提示', async ({ page }) => {
  await page.goto(BASE + '/report.html?tree_code=TT0000000001&tree_category=street');
  await page.locator('input[name="issue_type"][value="其他問題"]').check();
  await page.locator('#description').fill('樹木旁邊看起來有異常狀況，需要管理人員協助查看。');
  await page.locator('#photos').setInputFiles({
    name: 'large.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  });
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('超過 8MB');
});

test('report.html 非圖片檔案會在送出前提示', async ({ page }) => {
  await page.goto(BASE + '/report.html?tree_code=TT0000000001&tree_category=street');
  await page.locator('input[name="issue_type"][value="其他問題"]').check();
  await page.locator('#description').fill('樹木旁邊看起來有異常狀況，需要管理人員協助查看。');
  await page.locator('#photos').setInputFiles({
    name: 'note.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await page.locator('#report-submit').click();
  await expect(page.locator('#report-error')).toContainText('不是支援的圖片格式');
});

test('report.html 可從樹木頁帶入樹籍資料', async ({ page }) => {
  await page.goto(BASE + '/report.html?tree_code=TT0000000001&tree_category=street&species_name=%E6%A6%95%E6%A8%B9&district=%E5%A4%A7%E5%AE%89%E5%8D%80&managing_unit=%E4%BB%81%E6%84%9B%E8%B7%AF');
  await expect(page.locator('#context-title')).toContainText('榕樹｜TT0000000001');
  await expect(page.locator('#location-text')).toHaveValue(/大安區/);
});

test('首頁底部 sheet 提供帶樹籍的通報入口', async ({ page }) => {
  await page.route('**/public/tree/TT0000000001', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'TT0000000001',
        species_name: '榕樹',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        lat: 25.03,
        lng: 121.54,
      },
    }),
  }));

  await page.goto(BASE + '/?id=TT0000000001');
  await expect(page.locator('#detail-sheet')).toBeVisible({ timeout: 5000 });
  const reportLink = page.locator('#sheet-report-btn');
  await expect(reportLink).toBeVisible();
  await expect(reportLink).toHaveAttribute('href', /tree_code=TT0000000001/);
  await expect(reportLink).toHaveAttribute('href', /species_name=/);
});

test('首頁底部 sheet 顯示民眾版生態存摺與樹的信箱', async ({ page }) => {
  await page.route('**/public/tree/TT0000000002', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'TT0000000002',
        species_name: '臺灣欒樹',
        scientific_name: 'Koelreuteria elegans',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        height_m: 8,
        dbh_cm: 29,
        crown_m: 5,
        annual_co2_kg: 0.7,
        lat: 25.03,
        lng: 121.54,
      },
    }),
  }));

  await page.goto(BASE + '/?id=TT0000000002');
  await expect(page.locator('#detail-sheet')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#sheet-passbook')).toContainText('台北行道樹生態存摺');
  await expect(page.locator('#sheet-passbook')).toContainText('每年固碳量');
  await expect(page.locator('#sheet-carbon')).toBeHidden();
  await expect(page.locator('#tree-mailbox')).toContainText('樹的信箱');
  await expect(page.locator('#tree-mailbox')).toContainText('這棵樹還沒有留言');
  await expect(page.locator('#detail-sheet')).not.toContainText('公開維護紀錄');

  await page.locator('#tree-mailbox input[name="nickname"]').fill('小樹友');
  await page.locator('#tree-mailbox textarea[name="message"]').fill('謝謝你陪大家走路回家');
  await page.locator('#tree-mailbox button[type="submit"]').click();

  await expect(page.locator('#tree-mailbox')).toContainText('小樹友');
  await expect(page.locator('#tree-mailbox')).toContainText('謝謝你陪大家走路回家');
});

test('report.html 送出通報後上傳照片且不需要 angle', async ({ page }) => {
  let reportPayload = null;
  let photoContentType = '';
  let photoPostText = '';

  await page.route('**/public/reports', async route => {
    reportPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        report_id: 42,
        report_no: 'TR-20260606-0001',
        message: '已收到您的通報，案件編號 TR-20260606-0001。若為緊急事項請立即聯絡 1999。',
      }),
    });
  });
  await page.route('**/public/reports/42/photos', async route => {
    photoContentType = route.request().headers()['content-type'] || '';
    photoPostText = (route.request().postDataBuffer() || Buffer.from('')).toString('latin1');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, photo_id: 7, url: '/uploads/public_reports/42/demo.png' }),
    });
  });

  await page.goto(BASE + '/report.html?tree_code=TT0000000001&tree_category=street&species_name=%E6%A6%95%E6%A8%B9&district=%E5%A4%A7%E5%AE%89%E5%8D%80&managing_unit=%E4%BB%81%E6%84%9B%E8%B7%AF');
  await page.locator('input[name="issue_type"][value="遮擋交通號誌、路牌、民宅"]').check();
  await page.locator('#urgency').selectOption('possible_danger');
  await page.locator('#description').fill('樹枝遮擋交通號誌，轉彎時不容易看到紅綠燈。');
  await page.locator('#photos').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLq2SAAAAABJRU5ErkJggg==',
      'base64'
    ),
  });
  await page.locator('#report-submit').click();

  await expect(page.locator('#report-form')).toContainText('案件編號 TR-20260606-0001');
  expect(reportPayload.issue_type).toBe('遮擋交通號誌、路牌、民宅');
  expect(reportPayload.urgency).toBe('possible_danger');
  expect(reportPayload.tree_code).toBe('TT0000000001');
  await expect.poll(() => photoContentType).toContain('multipart/form-data');
  expect(photoPostText).toContain('photo');
  expect(photoPostText).not.toContain('angle');
});

// ── login.html ───────────────────────────────────────────────────────────────
test('login.html 不顯示 demo 測試帳密（2026-06-07 已移除）', async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/login.html');
  await expect(page.locator('#demo-login-hint')).toHaveCount(0);
  await expect(page.locator('#login-form, form')).toBeVisible();
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

test('tree.html 樹木名片提供民眾摘要', async ({ page }) => {
  await page.route('**/public/tree/TT0000000001', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'TT0000000001',
        species_name: '榕樹',
        scientific_name: 'Ficus microcarpa',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        height_m: 8.5,
        dbh_cm: 35,
        crown_m: 7,
      },
    }),
  }));

  await page.goto(BASE + '/tree.html?code=TT0000000001');
  await expect(page.locator('#tree-content')).toBeVisible();
  await expect(page.locator('#tree-story-card')).toContainText('這棵榕樹');
  await expect(page.locator('#tree-profile-metrics')).toContainText('樹高');
  await expect(page.locator('#tree-profile-metrics')).toContainText('胸徑');
  await expect(page.locator('#tree-location-card')).toContainText('大安區');
  await expect(page.locator('#tr-report')).toHaveAttribute('href', /tree_code=TT0000000001/);
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
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
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

test('risk.html 選完一題後自動捲到下一題', async ({ page }) => {
  await loginAsTester(page);
  await page.addInitScript(() => {
    window.__lastScrolledQuestion = '';
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      if (this.classList && this.classList.contains('question-block')) {
        window.__lastScrolledQuestion = this.querySelector('.q-title')?.textContent || '';
      }
      return original.apply(this, args);
    };
  });

  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: { trunk: '二、樹幹狀況' },
      env_risk_options: [{ value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' }],
      angle_labels: {},
      items: [
        { no: 1, key: 'q1', section: 'trunk', title: '樹冠狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
        { no: 2, key: 'q2', section: 'trunk', title: '樹幹狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
      ],
    }),
  }));
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ tree: { registry_code: 'JS0750021125', species_name: '榕樹', tree_category: 'street' } }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.question-block').first().locator('.option-item').first().click();

  await expect.poll(() => page.evaluate(() => window.__lastScrolledQuestion)).toContain('Q2');
});

test('risk.html 儲存前提示未填題目', async ({ page }) => {
  await loginAsTester(page);
  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: { trunk: '二、樹幹狀況' },
      env_risk_options: [{ value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' }],
      angle_labels: {},
      items: [
        { no: 1, key: 'q1', section: 'trunk', title: '樹冠狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
        { no: 2, key: 'q2', section: 'trunk', title: '樹幹狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
      ],
    }),
  }));
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ tree: { registry_code: 'JS0750021125', species_name: '榕樹', tree_category: 'street' } }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));
  await page.route('**/api/assessment/123/save', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ final_grade: 'D', grade_info: { label: 'D 級' }, treatments: [] }),
  }));

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.question-block').first().locator('.option-item').first().click();

  let dialogMessage = '';
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });
  await page.locator('#save-draft-btn').click();
  expect(dialogMessage).toContain('Q2');
});

test('risk.html 查看評級結果時未填完不得進行評估', async ({ page }) => {
  await loginAsTester(page);
  let saveCalled = false;
  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: { trunk: '二、樹幹狀況' },
      env_risk_options: [{ value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' }],
      angle_labels: {},
      items: [
        { no: 1, key: 'q1', section: 'trunk', title: '樹冠狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
        { no: 2, key: 'q2', section: 'trunk', title: '樹幹狀況', type: 'radio',
          options: [{ value: 0, label: '正常' }, { value: -3, label: '異常' }] },
      ],
    }),
  }));
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ tree: { registry_code: 'JS0750021125', species_name: '榕樹', tree_category: 'street' } }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));
  await page.route('**/api/assessment/123/save', route => {
    saveCalled = true;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ final_grade: 'D', grade_info: { label: 'D 級' }, treatments: [] }),
    });
  });

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.question-block').first().locator('.option-item').first().click();

  let dialogMessage = '';
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.locator('#preview-result-btn').click();

  expect(dialogMessage).toContain('Q2');
  expect(saveCalled).toBe(false);
  await expect(page.locator('#step-result')).toBeHidden();
});

test('risk.html 儲存時會把評估人員備注併入 notes', async ({ page }) => {
  await loginAsTester(page);
  let savedBody = null;
  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: { trunk: '二、樹幹狀況' },
      env_risk_options: [{ value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' }],
      angle_labels: {},
      items: [{ no: 1, key: 'q1', section: 'trunk', title: '樹冠狀況', type: 'radio',
        options: [{ value: 0, label: '正常' }] }],
    }),
  }));
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ tree: { registry_code: 'JS0750021125', species_name: '榕樹', tree_category: 'street' } }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));
  await page.route('**/api/assessment/123/save', async route => {
    savedBody = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ final_grade: 'D', grade_info: { label: 'D 級' }, treatments: [] }),
    });
  });

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.question-block .option-item').first().click();
  await page.locator('#assessor-name-input').fill('王小明');
  await page.locator('#notes-input').fill('現場可見腐朽');
  await page.locator('#save-draft-btn').click();

  await expect.poll(() => savedBody && savedBody.notes).toContain('評估人員：王小明');
  expect(savedBody.notes).toContain('現場可見腐朽');
});

test('risk.html 照片上傳使用 multipart/form-data 並包含 angle', async ({ page }) => {
  await loginAsTester(page);
  let contentType = '';
  let postText = '';
  await page.route('**/api/assessment/form-data', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      grade_a_items: [],
      section_labels: {},
      env_risk_options: [{ value: 'mid', label: '中風險', desc: '一般道路', example: '社區道路' }],
      angle_labels: { 0: '全景' },
      items: [],
    }),
  }));
  await page.route('**/api/assessment/tree/JS0750021125*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ tree: { registry_code: 'JS0750021125', species_name: '榕樹', tree_category: 'street' } }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 123 }),
  }));
  await page.route('**/api/assessment/123/photos', async route => {
    contentType = route.request().headers()['content-type'] || '';
    postText = (route.request().postDataBuffer() || Buffer.from('')).toString('latin1');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, photo_id: 7, url: '/uploads/demo.jpg', angle: 0, angle_label: '全景' }),
    });
  });

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('JS0750021125');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.photo-slot[data-angle="0"]').click();
  // 拍攝指引覆蓋層（若存在）需先按「開始拍攝」
  const guideShoot = page.locator('#photo-guide-shoot');
  if (await guideShoot.isVisible().catch(() => false)) await guideShoot.click();
  await page.locator('#photo-file-input').setInputFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lLq2SAAAAABJRU5ErkJggg==',
      'base64'
    ),
  });

  await expect.poll(() => contentType).toContain('multipart/form-data');
  expect(postText).toContain('angle');
  expect(postText).toContain('0');
});

test('risk.html PDF 匯出內嵌繁中文字型避免中文亂碼', async ({ page }) => {
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
      ],
      angle_labels: {},
      items: [{
        no: 5, key: 'q5', section: 'trunk', title: '生物性危害', type: 'checkbox',
        options: [{ value: -10, key: 'q5g', label: '菇菌類（真菌子實體）', hint: '樹幹出現蕈類', cf: true }],
      }],
    }),
  }));
  await page.route('**/api/assessment/tree/DA0313031015*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      tree: {
        registry_code: 'DA0313031015',
        species_name: '印度紫檀',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        height_m: 14.1,
        dbh_cm: 26,
      },
    }),
  }));
  await page.route('**/api/assessment/start', route => route.fulfill({
    contentType: 'application/json',
    status: 201,
    body: JSON.stringify({ assessment_id: 39 }),
  }));
  await page.route('**/api/assessment/39/save', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      final_grade: 'A',
      grade_info: { label: 'A 級', desc: '立即處置' },
      health_score: -10,
      critical_count: 1,
      grade_a_hits: ['樹洞深度超過斷面直徑2/3且外殼開放度1/3以上'],
      treatments: ['立即安排專業人員複查', '設置警戒範圍'],
    }),
  }));

  await page.goto(BASE + '/risk.html');
  await page.locator('#tree-code-input').fill('DA0313031015');
  await page.locator('#lookup-btn').click();
  await page.locator('#start-assessment-btn').click();
  await page.locator('.question-block .option-item', { hasText: '菇菌類' }).click();
  await page.locator('#preview-result-btn').click();
  await expect(page.locator('#step-result')).toBeVisible();

  await installPdfFontMocks(page);
  await page.locator('#pdf-btn').click();

  const calls = await page.evaluate(() => window.__pdfCalls);
  expect(calls.map(c => c[0])).toContain('fetch');
  expect(calls.map(c => c[0])).toContain('addFileToVFS');
  expect(calls.map(c => c[0])).toContain('addFont');
  expect(calls).toContainEqual(['setFont', 'NotoSansTC', 'bold']);
  expect(calls.map(c => c[0])).not.toContain('html2canvas');
  expect(calls.map(c => c[0])).not.toContain('addImage');
});

test('risk-report.html PDF 匯出內嵌繁中文字型避免中文亂碼', async ({ page }) => {
  await page.route('**/public/assessment/39', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      assessment: {
        id: 39,
        final_grade: 'A',
        health_score: -10,
        critical_count: 1,
        grade_a_hits: ['樹洞深度超過斷面直徑2/3且外殼開放度1/3以上'],
        notes: '現場可見明顯腐朽',
      },
      tree: {
        registry_code: 'DA0313031015',
        species_name: '印度紫檀',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
        height_m: 14.1,
        dbh_cm: 26,
      },
      grade_info: { label: 'A 級', desc: '立即處置' },
      treatments: ['立即安排專業人員複查', '設置警戒範圍'],
    }),
  }));

  await page.goto(BASE + '/risk-report.html?id=39');
  await expect(page.locator('#report-wrap')).toBeVisible();

  await installPdfFontMocks(page);
  await page.locator('#rr-pdf-btn').click();

  const calls = await page.evaluate(() => window.__pdfCalls);
  expect(calls.map(c => c[0])).toContain('fetch');
  expect(calls.map(c => c[0])).toContain('addFileToVFS');
  expect(calls.map(c => c[0])).toContain('addFont');
  expect(calls).toContainEqual(['setFont', 'NotoSansTC', 'bold']);
  expect(calls.map(c => c[0])).not.toContain('html2canvas');
  expect(calls.map(c => c[0])).not.toContain('addImage');
});

test('risk-report.html 顯示民眾版風險解讀', async ({ page }) => {
  await page.route('**/public/assessment/88', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({
      assessment: {
        id: 88,
        final_grade: 'B',
        health_score: -6,
        critical_count: 1,
        grade_a_hits: [],
        notes: '現場可見枯枝',
      },
      tree: {
        registry_code: 'TT0000000001',
        species_name: '榕樹',
        tree_category: 'street',
        district: '大安區',
        managing_unit: '仁愛路',
      },
      grade_info: { label: 'B 級', desc: '建議安排複查' },
      treatments: ['安排專業人員複查'],
    }),
  }));

  await page.goto(BASE + '/risk-report.html?id=88');
  await expect(page.locator('#report-wrap')).toBeVisible();
  await expect(page.locator('#public-risk-summary')).toContainText('建議安排複查');
  await expect(page.locator('#public-risk-summary')).toContainText('民眾可以怎麼看');
  await expect(page.locator('#rr-tree-identity')).toContainText('榕樹');
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
