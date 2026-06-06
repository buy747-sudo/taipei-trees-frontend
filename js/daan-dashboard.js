const DAAN_BOUNDS = {
  min_lat: 25.0235,
  max_lat: 25.0360,
  min_lng: 121.5310,
  max_lng: 121.5425,
};

const DAAN_CENTER = [25.0308, 121.5356];
const PARK_POLYGON = [
  [25.03455, 121.53355],
  [25.03442, 121.53695],
  [25.0322, 121.53875],
  [25.0285, 121.54018],
  [25.02505, 121.53905],
  [25.0250, 121.53505],
  [25.02765, 121.5335],
  [25.03155, 121.53295],
];

const FALLBACK_TREES = [
  { registry_code: 'DA-DEMO-001', species_name: '樟樹', dbh_cm: 42, height_m: 13, crown_m: 8, lat: 25.0312, lng: 121.5354, carbon_kg: 510, annual_co2_kg: 20 },
  { registry_code: 'DA-DEMO-002', species_name: '榕樹', dbh_cm: 58, height_m: 16, crown_m: 12, lat: 25.0303, lng: 121.5364, carbon_kg: 1020, annual_co2_kg: 41 },
  { registry_code: 'DA-DEMO-003', species_name: '茄苳', dbh_cm: 35, height_m: 11, crown_m: 7, lat: 25.0292, lng: 121.5376, carbon_kg: 330, annual_co2_kg: 13 },
  { registry_code: 'DA-DEMO-004', species_name: '臺灣欒樹', dbh_cm: 28, height_m: 9, crown_m: 6, lat: 25.0286, lng: 121.5351, carbon_kg: 190, annual_co2_kg: 8 },
  { registry_code: 'DA-DEMO-005', species_name: '白千層', dbh_cm: 24, height_m: 10, crown_m: 5, lat: 25.0324, lng: 121.5369, carbon_kg: 150, annual_co2_kg: 6 },
  { registry_code: 'DA-DEMO-006', species_name: '樟樹', dbh_cm: 38, height_m: 12, crown_m: 7, lat: 25.0316, lng: 121.5379, carbon_kg: 420, annual_co2_kg: 17 },
  { registry_code: 'DA-DEMO-007', species_name: '榕樹', dbh_cm: 62, height_m: 17, crown_m: 13, lat: 25.0276, lng: 121.5384, carbon_kg: 1180, annual_co2_kg: 48 },
  { registry_code: 'DA-DEMO-008', species_name: '楓香', dbh_cm: 31, height_m: 12, crown_m: 6, lat: 25.0331, lng: 121.5342, carbon_kg: 260, annual_co2_kg: 10 },
];

let daanMap;
let treeLayer;
let radiusCircle;
let radiusCenter = DAAN_CENTER;
let loadedTrees = [];

function fmt(value, digits = 0) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function getTreeBenefits(tree) {
  const fallback = typeof calcBenefits === 'function' ? calcBenefits(tree) : null;
  const storedKg = Number(tree.carbon_kg) || fallback?.co2_kg || 0;
  const annualKg = Number(tree.annual_co2_kg) || Math.round(storedKg * 0.04) || 0;
  const rainL = fallback?.rain_L || 0;
  return { storedKg, annualKg, rainL };
}

function summarizeTrees(trees) {
  return trees.reduce((acc, tree) => {
    const b = getTreeBenefits(tree);
    acc.count += 1;
    acc.carbonKg += b.storedKg;
    acc.annualKg += b.annualKg;
    acc.rainL += b.rainL;
    const species = tree.species_name || '未標示樹種';
    acc.species.set(species, (acc.species.get(species) || 0) + 1);
    return acc;
  }, { count: 0, carbonKg: 0, annualKg: 0, rainL: 0, species: new Map() });
}

function topSpecies(summary, limit = 5) {
  return [...summary.species.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderSummary(trees, sourceLabel) {
  const summary = summarizeTrees(trees);
  const speciesTop = topSpecies(summary);
  const carbonTon = summary.carbonKg / 1000;
  const ringPercent = Math.max(8, Math.min(92, Math.round(carbonTon * 8)));
  const topName = speciesTop[0]?.[0] || '樹種資料';

  setText('data-status', sourceLabel);
  setText('data-note', sourceLabel === '即時資料'
    ? `已載入大安森林公園周邊 ${summary.count} 筆公開樹木資料。`
    : '公開 API 暫時無法讀取，先顯示示範資料與完整互動。');
  setText('metric-count', fmt(summary.count));
  setText('metric-carbon', fmt(carbonTon, 1));
  setText('metric-annual', fmt(summary.annualKg));
  setText('metric-rain', fmt(summary.rainL));
  setText('carbon-total', `${fmt(carbonTon, 1)} 公噸`);
  setText('top-species-name', topName);
  setText('top-species-copy', `${topName} 是目前載入資料中最常見的樹種，可作為現場導覽、葉形觀察與都市森林教育的入口。`);
  setText('eco-guide-copy', `本區目前以 ${speciesTop.map(([name]) => name).slice(0, 3).join('、') || '常見行道樹'} 為主要導覽樹種。`);

  const ring = document.getElementById('carbon-ring');
  if (ring) ring.style.setProperty('--ring', `${ringPercent}%`);

  const tags = document.getElementById('eco-tags');
  if (tags) {
    tags.innerHTML = speciesTop.slice(0, 4)
      .map(([name]) => `<span class="field-tag">${escapeHtml(name)}</span>`)
      .join('');
  }

  const bars = document.getElementById('species-bars');
  if (bars) {
    const max = Math.max(...speciesTop.map(([, count]) => count), 1);
    bars.innerHTML = speciesTop.map(([name, count]) => `
      <div class="species-row">
        <span>${escapeHtml(name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count / max) * 100)}%"></div></div>
        <strong>${count}</strong>
      </div>
    `).join('');
  }

  updateRadiusAnalysis();
}

function initMap() {
  daanMap = L.map('daan-map', { zoomControl: true, scrollWheelZoom: false }).setView(DAAN_CENTER, 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(daanMap);

  L.polygon(PARK_POLYGON, {
    color: '#1a5c2a',
    weight: 3,
    fillColor: '#7ecb94',
    fillOpacity: 0.18,
  }).addTo(daanMap).bindPopup('大安森林公園範圍示意');

  treeLayer = L.layerGroup().addTo(daanMap);
  radiusCircle = L.circle(radiusCenter, {
    radius: Number(document.getElementById('radius-range')?.value || 250),
    color: '#2cb5a5',
    weight: 2,
    fillColor: '#2cb5a5',
    fillOpacity: 0.12,
  }).addTo(daanMap);

  daanMap.on('click', (event) => {
    radiusCenter = [event.latlng.lat, event.latlng.lng];
    updateRadiusAnalysis();
  });
}

function renderTreeMarkers(trees) {
  treeLayer.clearLayers();
  trees.forEach((tree) => {
    const lat = Number(tree.lat);
    const lng = Number(tree.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const b = getTreeBenefits(tree);
    const radius = Math.max(4, Math.min(12, Math.sqrt(b.storedKg || 50) / 3));
    L.circleMarker([lat, lng], {
      radius,
      color: '#1a5c2a',
      fillColor: '#2cb5a5',
      fillOpacity: 0.72,
      weight: 1,
    }).addTo(treeLayer).bindPopup(`
      <strong>${escapeHtml(tree.species_name || '未標示樹種')}</strong><br>
      ${escapeHtml(tree.registry_code || '')}<br>
      碳儲存估算：${fmt(b.storedKg / 1000, 2)} 公噸
    `);
  });
}

function distanceMeters(a, b) {
  const p1 = L.latLng(a[0], a[1]);
  const p2 = L.latLng(b[0], b[1]);
  return p1.distanceTo(p2);
}

function updateRadiusAnalysis() {
  if (!radiusCircle || !loadedTrees.length) return;
  const radius = Number(document.getElementById('radius-range')?.value || 250);
  radiusCircle.setLatLng(radiusCenter);
  radiusCircle.setRadius(radius);
  setText('radius-label', radius);

  const nearby = loadedTrees.filter((tree) => {
    const lat = Number(tree.lat);
    const lng = Number(tree.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) &&
      distanceMeters(radiusCenter, [lat, lng]) <= radius;
  });
  const summary = summarizeTrees(nearby);
  setText('radius-count', `${fmt(summary.count)} 株`);
  setText('radius-carbon', `${fmt(summary.carbonKg / 1000, 2)} 公噸`);
  setText('radius-copy', `目前以半徑 ${radius} 公尺估算。你可以點選地圖上的任一位置，重新分析周邊樹木。`);
}

async function fetchDaanTrees() {
  const url = new URL(`${API_BASE}/trees`);
  Object.entries(DAAN_BOUNDS).forEach(([key, value]) => url.searchParams.set(key, value));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.trees) || data.trees.length === 0) throw new Error('empty trees');
  return data.trees;
}

async function boot() {
  initMap();
  const range = document.getElementById('radius-range');
  if (range) range.addEventListener('input', updateRadiusAnalysis);

  try {
    loadedTrees = await fetchDaanTrees();
    renderTreeMarkers(loadedTrees);
    renderSummary(loadedTrees, '即時資料');
  } catch (error) {
    loadedTrees = FALLBACK_TREES;
    renderTreeMarkers(loadedTrees);
    renderSummary(loadedTrees, '示範資料');
  }
}

boot();
