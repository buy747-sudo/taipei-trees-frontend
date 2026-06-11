// js/sheet.js — bottom sheet + history.pushState

function openSheet(tree) {
  const sheet = document.getElementById('detail-sheet');
  const overlay = document.getElementById('sheet-overlay');

  document.getElementById('sheet-code').textContent = tree.registry_code || '';
  const badge = document.getElementById('sheet-badge');
  badge.textContent = CATEGORY_LABEL[tree.tree_category] || '';
  badge.className = tree.tree_category === 'protected' ? 'badge-protected' : 'badge-street';

  // 擬人化問候語
  const greeting = document.getElementById('sheet-greeting');
  if (greeting) {
    const speciesName = tree.species_name || '這棵樹';
    greeting.textContent = `您好，我是 ${speciesName} 🌳`;
    greeting.hidden = false;
  }

  const title = document.getElementById('sheet-title');
  title.textContent = tree.species_name || '未知樹種';
  if (tree.scientific_name) {
    const em = document.createElement('small');
    em.style.cssText = 'display:block;font-size:0.75em;color:#888;font-style:italic;font-weight:400;';
    em.textContent = tree.scientific_name;
    title.appendChild(em);
  }

  const rows = [
    ['行政區', tree.district],
    ['路段位置', tree.managing_unit],
    ['樹高', tree.height_m != null ? `${tree.height_m} m` : null],
    ['胸徑', tree.dbh_cm != null ? `${tree.dbh_cm} cm` : null],
    ['冠幅', tree.crown_m != null ? `${tree.crown_m} m` : null],
    ['樹齡', tree.age_years != null ? `${tree.age_years} 年` : null],
    ['調查日期', tree.gov_survey_date],
  ].filter(([, v]) => v);

  const tbody = document.getElementById('sheet-table');
  tbody.innerHTML = rows.map(([k, v]) =>
    `<tr><td>${k}</td><td>${v}</td></tr>`
  ).join('');

  // 生態效益（優先用 API 固碳值，否則用 benefits.js 計算）
  const benefitData = typeof calcBenefits === 'function' ? calcBenefits(tree) : null;
  const co2 = tree.annual_co2_kg || benefitData?.co2_kg;
  const carbon = document.getElementById('sheet-carbon');
  if (co2) {
    const km = Math.round(co2 / 0.196);
    carbon.innerHTML = `🌿 每年固碳約 <strong>${co2} kg CO₂</strong>（等同少開車 ${km} 公里）`;
    carbon.hidden = false;
  } else {
    carbon.hidden = true;
  }

  // 效益摘要小卡
  const benefitEl = document.getElementById('sheet-benefits');
  const detailBtn = document.getElementById('sheet-detail-btn');
  const reportBtn = document.getElementById('sheet-report-btn');
  if (benefitData) {
    const rain = benefitData.rain_L >= 1000
      ? (benefitData.rain_L / 1000).toFixed(1) + ' 噸'
      : benefitData.rain_L + ' L';
    const ntd = benefitData.airpoll_ntd >= 1000
      ? 'NT$' + (benefitData.airpoll_ntd / 1000).toFixed(1) + 'k'
      : 'NT$' + benefitData.airpoll_ntd;
    const estNote = benefitData.height_estimated
      ? `<div class="bchip-note">＊樹高依胸徑估算</div>` : '';
    benefitEl.innerHTML =
      `<div class="benefit-chips">` +
      `<span class="bchip">💧 截雨 <strong>${rain}</strong>/年</span>` +
      `<span class="bchip">🌬️ 空污 <strong>${ntd}</strong>/年</span>` +
      `</div>${estNote}`;
    benefitEl.hidden = false;
  } else {
    benefitEl.hidden = true;
  }
  if (detailBtn && tree.registry_code) {
    detailBtn.href = `/tree.html?code=${encodeURIComponent(tree.registry_code)}`;
    detailBtn.hidden = false;
  } else if (detailBtn) {
    detailBtn.hidden = true;
  }

  if (reportBtn) {
    const params = new URLSearchParams();
    if (tree.registry_code) params.set('tree_code', tree.registry_code);
    if (tree.tree_category) params.set('tree_category', tree.tree_category);
    if (tree.species_name) params.set('species_name', tree.species_name);
    if (tree.district) params.set('district', tree.district);
    if (tree.managing_unit) params.set('managing_unit', tree.managing_unit);
    if (tree.lat != null) params.set('lat', tree.lat);
    if (tree.lng != null) params.set('lng', tree.lng);
    reportBtn.href = `/report.html?${params.toString()}`;
    reportBtn.hidden = false;
  }

  // 導航按鈕：點擊後開啟 Google Maps 導航到該樹位置
  const navBtn = document.getElementById('sheet-nav-btn');
  if (navBtn) {
    if (tree.lat != null && tree.lng != null) {
      // Google Maps 導航 URL：iOS / Android 均可開啟 Google Maps app 或瀏覽器版
      navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${tree.lat},${tree.lng}&travelmode=driving`;
      navBtn.hidden = false;
    } else {
      navBtn.hidden = true;
    }
  }

  // 樹種生態說明
  const eco = document.getElementById('sheet-eco');
  const speciesInfo = typeof getSpeciesInfo === 'function' ? getSpeciesInfo(tree.species_name) : null;
  if (speciesInfo?.traits) {
    const aliasHtml = speciesInfo.aliases?.length
      ? `<div class="eco-aliases">別名：${speciesInfo.aliases.join('、')}</div>` : '';
    eco.innerHTML = `<div class="eco-traits">${speciesInfo.traits}</div>${aliasHtml}`;
    eco.hidden = false;
  } else {
    eco.hidden = true;
  }

  // 土地脈絡卡（非同步，不阻塞 sheet 開啟）
  const zoneCard = document.getElementById('sheet-zone-card');
  if (zoneCard && tree.lat != null && tree.lng != null) {
    zoneCard.hidden = true;
    zoneCard.innerHTML = '';
    fetch(`${API_BASE}/public/zone?lat=${tree.lat}&lng=${tree.lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.zone_name) return;
        zoneCard.innerHTML =
          `<div class="zone-label">📍 土地脈絡（參考）</div>` +
          `<div class="zone-name">${data.zone_name}` +
          (data.zone_code ? ` <span class="zone-code">${data.zone_code}</span>` : '') +
          `</div>` +
          (data.zone_desc ? `<div class="zone-desc">${data.zone_desc}</div>` : '') +
          `<div class="zone-note">僅供參考，GPS 有數公尺誤差，正式分區以都發局公告為準</div>`;
        zoneCard.hidden = false;
      })
      .catch(() => {});
  } else if (zoneCard) {
    zoneCard.hidden = true;
  }

  sheet.hidden = false;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  history.pushState({ treeId: tree.registry_code }, '', `/?id=${tree.registry_code}`);
}

function closeSheet() {
  document.getElementById('detail-sheet').hidden = true;
  document.getElementById('sheet-overlay').hidden = true;
  document.body.style.overflow = '';
  if (history.state && history.state.treeId) {
    history.pushState({}, '', '/');
  }
}

function initSheet() {
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  document.getElementById('sheet-overlay').addEventListener('click', closeSheet);

  document.getElementById('sheet-share').addEventListener('click', () => {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: '台北市樹木資訊', url });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('連結已複製'));
    } else {
      showToast('請手動複製網址列');
    }
  });

  // 頁面載入時若 URL 有 ?id= 參數，自動開 sheet
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) {
    apiFetchTree(id).then(data => {
      if (data && data.tree) openSheet(data.tree);
      else showToast('找不到此樹籍資料');
    });
  }

  window.addEventListener('popstate', (e) => {
    if (!e.state || !e.state.treeId) {
      document.getElementById('detail-sheet').hidden = true;
      document.getElementById('sheet-overlay').hidden = true;
      document.body.style.overflow = '';
    }
  });
}
