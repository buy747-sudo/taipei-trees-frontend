// js/stats.js — stats panel

let _statsLoaded = false;

async function loadStats() {
  if (_statsLoaded) return;
  try {
    const data = await apiFetchStats();
    _statsLoaded = true;
    renderStats(data);
  } catch (e) {
    console.error('stats load failed', e);
  }
}

function renderStats(data) {
  // ── 碳匯大字 ──
  const carbonEl = document.getElementById('stats-carbon');
  if (carbonEl && data.total_carbon_tonnes != null) {
    const tonnes = data.total_carbon_tonnes.toLocaleString();
    const annualTonnes = data.total_annual_co2_tonnes != null
      ? data.total_annual_co2_tonnes.toLocaleString() : null;
    carbonEl.innerHTML =
      `<div class="carbon-big">
        <span class="carbon-num">${tonnes}</span>
        <span class="carbon-unit">公噸 CO₂</span>
        <div class="carbon-label">全市樹木累積固碳量</div>
        ${annualTonnes ? `<div class="carbon-annual">每年再固碳約 ${annualTonnes} 公噸</div>` : ''}
      </div>`;
    carbonEl.hidden = false;
  }

  // ── 行政區表格 ──
  const tbody = document.getElementById('stats-tbody');
  const districts = Object.entries(data.by_district || {})
    .sort((a, b) => b[1].total - a[1].total);

  tbody.innerHTML = districts.map(([name, d]) =>
    `<tr data-district="${name}">
      <td>${name || '未分區'}</td>
      <td>${(d.total || 0).toLocaleString()}</td>
      <td>${(d.street || 0).toLocaleString()}</td>
      <td>${(d.protected || 0).toLocaleString()}</td>
    </tr>`
  ).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const d = tr.dataset.district;
      const sel = document.getElementById('filter-district') || document.getElementById('adv-district');
      if (sel) sel.value = d;
      filterState.district = d;
      flyToDistrict(d);
      scheduleReload();
      document.getElementById('stats-panel').hidden = true;
    });
  });

  // ── 常見樹種 ──
  const topSpecies = (data.top_species || []).slice(0, 10);
  document.getElementById('top-species').innerHTML = topSpecies.map(s =>
    `<span class="sp-chip">${s.name} (${s.count.toLocaleString()})</span>`
  ).join('');

  document.getElementById('stats-toggle').textContent = '統計總覽 ▲';
}

function initStats() {
  document.getElementById('stats-toggle').addEventListener('click', () => {
    const panel = document.getElementById('stats-panel');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) loadStats();
    if (panel.hidden) document.getElementById('stats-toggle').textContent = '統計總覽 ▾';
  });
}
