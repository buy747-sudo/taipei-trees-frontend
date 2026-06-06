/**
 * tree.js — /tree.html?code=XXX 樹木詳情頁
 * 依賴：config.js, api.js, species.js, benefits.js
 */
(async function init() {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) {
    showError();
    return;
  }

  document.title = `${code}｜台北市樹木查詢`;

  let data;
  try {
    data = await apiFetchTree(code);
  } catch (e) {
    showError();
    return;
  }

  if (!data || !data.tree) {
    showError();
    return;
  }

  render(data.tree);
})();

function showError() {
  document.getElementById('loading-msg').hidden = true;
  document.getElementById('error-msg').hidden = false;
}

function render(tree) {
  document.getElementById('loading-msg').hidden = true;
  document.getElementById('tree-content').hidden = false;

  // hero
  document.getElementById('tr-page-title').textContent = tree.species_name || '樹木詳情';
  document.getElementById('tr-name').textContent = tree.species_name || '未知樹種';
  const sciEl = document.getElementById('tr-sci');
  if (tree.scientific_name) sciEl.textContent = tree.scientific_name;
  document.getElementById('tr-code').textContent = tree.registry_code || '';
  const catEl = document.getElementById('tr-cat');
  const catMap = { street: '行道樹', protected: '受保護樹木', park: '公園樹' };
  catEl.textContent = catMap[tree.tree_category] || '';
  catEl.className = 'cat-badge ' + (tree.tree_category === 'protected' ? 'badge-protected' : 'badge-street');
  const reportBtn = document.getElementById('tr-report');
  const reportParams = new URLSearchParams();
  if (tree.registry_code) reportParams.set('tree_code', tree.registry_code);
  if (tree.tree_category) reportParams.set('tree_category', tree.tree_category);
  if (tree.species_name) reportParams.set('species_name', tree.species_name);
  if (tree.district) reportParams.set('district', tree.district);
  if (tree.managing_unit) reportParams.set('managing_unit', tree.managing_unit);
  if (tree.lat != null) reportParams.set('lat', tree.lat);
  if (tree.lng != null) reportParams.set('lng', tree.lng);
  reportBtn.href = `/report.html?${reportParams.toString()}`;

  const speciesName = tree.species_name || '這棵樹';
  const district = tree.district || '台北市';
  const position = tree.managing_unit || '公開資料記錄位置';
  document.getElementById('tr-story').textContent =
    `這棵${speciesName}收錄在台北市樹木資料中。你可以把它當成一張城市樹木名片，快速了解它的位置、大小與生態效益。`;
  document.getElementById('metric-height').textContent =
    tree.height_m != null ? `${tree.height_m} m` : '未提供';
  document.getElementById('metric-dbh').textContent =
    tree.dbh_cm != null ? `${tree.dbh_cm} cm` : '未提供';
  document.getElementById('metric-crown').textContent =
    tree.crown_m != null ? `${tree.crown_m} m` : '未提供';
  document.getElementById('tr-location-summary').textContent =
    `${district}，${position}。實際位置請以地圖標記與現場樹牌為準。`;

  // 效益
  const b = calcBenefits(tree);
  const co2 = tree.annual_co2_kg || b?.co2_kg;
  if (co2) {
    document.getElementById('bc-co2').textContent = co2.toLocaleString();
  }
  if (b) {
    if (b.rain_L >= 1000) {
      document.getElementById('bc-rain').textContent = (b.rain_L / 1000).toFixed(1);
      document.getElementById('bc-rain-unit').textContent = '公噸/年';
    } else {
      document.getElementById('bc-rain').textContent = b.rain_L.toLocaleString();
    }
    document.getElementById('bc-air').textContent = 'NT$' + b.airpoll_ntd.toLocaleString();
    if (b.height_estimated) {
      const note = document.createElement('p');
      note.style.cssText = 'font-size:0.72rem;color:#aaa;margin-top:10px;text-align:center;';
      note.textContent = '＊樹高資料未提供，依胸徑（DBH）以城市樹木異速生長公式估算';
      document.getElementById('benefit-section').appendChild(note);
    }
  } else {
    document.getElementById('benefit-section').hidden = true;
  }

  // 資料表
  const rows = [
    ['行政區', tree.district],
    ['路段位置', tree.managing_unit],
    ['樹高', tree.height_m != null ? `${tree.height_m} m` : null],
    ['胸徑（DBH）', tree.dbh_cm != null ? `${tree.dbh_cm} cm` : null],
    ['冠幅', tree.crown_m != null ? `${tree.crown_m} m` : null],
    ['樹齡', tree.age_years != null ? `${tree.age_years} 年` : null],
    ['調查日期', tree.gov_survey_date],
    ['碳儲量', tree.carbon_kg != null ? `${tree.carbon_kg} kg C` : null],
  ].filter(([, v]) => v);

  document.getElementById('tr-data-table').innerHTML = rows.map(([k, v]) =>
    `<tr><td>${k}</td><td>${v}</td></tr>`
  ).join('');

  // 生態說明
  const info = typeof getSpeciesInfo === 'function' ? getSpeciesInfo(tree.species_name) : null;
  if (info?.traits) {
    document.getElementById('tr-traits').textContent = info.traits;
    const aliasEl = document.getElementById('tr-aliases');
    if (info.aliases?.length) {
      aliasEl.textContent = '別名：' + info.aliases.join('、');
    }
    document.getElementById('eco-card').hidden = false;
  }

  // 分享
  document.getElementById('tr-share').addEventListener('click', () => {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: `台北市樹木：${tree.species_name}`, url });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => alert('連結已複製'));
    }
  });
}
