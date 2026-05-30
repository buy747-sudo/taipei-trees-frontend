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
  const tbody = document.getElementById('stats-tbody');
  const districts = Object.entries(data.by_district || {})
    .sort((a, b) => b[1].total - a[1].total);

  tbody.innerHTML = districts.map(([name, d]) =>
    `<tr data-district="${name}">
      <td>${name}</td>
      <td>${(d.total || 0).toLocaleString()}</td>
      <td>${(d.street || 0).toLocaleString()}</td>
      <td>${(d.protected || 0).toLocaleString()}</td>
    </tr>`
  ).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const d = tr.dataset.district;
      document.getElementById('filter-district').value = d;
      filterState.district = d;
      flyToDistrict(d);
      scheduleReload();
      document.getElementById('stats-panel').hidden = true;
    });
  });

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
