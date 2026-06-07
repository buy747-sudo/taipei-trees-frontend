// js/eco-benefits.js — 敦化南路 / 仁愛路 生態效益載入與渲染
// 依賴：config.js（API_BASE）

(function () {
  // ── 生態效益係數（i-Tree Taiwan，依 DBH 分級）────────
  // 碳匯直接使用後端 annual_co2_kg，雨水/空污依 DBH 估算
  const DBH_TIERS = [
    { max: 10,       rain: 0.8,  airNTD: 180  },
    { max: 20,       rain: 1.8,  airNTD: 420  },
    { max: 30,       rain: 3.5,  airNTD: 850  },
    { max: 45,       rain: 6.0,  airNTD: 1500 },
    { max: Infinity, rain: 9.5,  airNTD: 2600 },
  ];
  function getCoeff(dbh) {
    if (!dbh || dbh <= 0) return { rain: 2.2, airNTD: 480 };
    return DBH_TIERS.find(t => dbh < t.max) || DBH_TIERS[DBH_TIERS.length - 1];
  }

  // ── 路段定義 ─────────────────────────────────────────
  // bbox 以道路中心線 ±250-400m 為緩衝（捕捉雙側行道樹）
  const ROADS = [
    {
      prefix:  'dh',
      name:    '敦化南路',
      // 敦化南路全段（南北向，信義/大安）
      bbox: { min_lat: 25.009, max_lat: 25.058, min_lng: 121.540, max_lng: 121.556 },
    },
    {
      prefix:  'ra',
      name:    '仁愛路',
      // 仁愛路全段（東西向，中正/大安/信義）
      bbox: { min_lat: 25.030, max_lat: 25.043, min_lng: 121.511, max_lng: 121.560 },
    },
  ];

  // ── 格式化 ───────────────────────────────────────────
  function fmt(n, d = 0) {
    if (!Number.isFinite(n)) return '—';
    return Math.round(n).toLocaleString('zh-TW');
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── 計算 ─────────────────────────────────────────────
  function calcRoadBenefits(trees) {
    const specMap = {};
    let count = 0, co2 = 0, rain = 0, air = 0;
    trees.forEach(t => {
      count++;
      co2  += (t.annual_co2_kg != null ? t.annual_co2_kg : 12);
      const c = getCoeff(t.dbh_cm);
      rain += c.rain;
      air  += c.airNTD;
      const sp = t.species_name || '未知';
      specMap[sp] = (specMap[sp] || 0) + 1;
    });
    const topSpecies = Object.entries(specMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { count, co2, rain, air, topSpecies };
  }

  // ── 渲染 ─────────────────────────────────────────────
  function renderRoad(prefix, benefits) {
    setText(`${prefix}-count`, fmt(benefits.count));
    setText(`${prefix}-co2`,   fmt(Math.round(benefits.co2)));
    setText(`${prefix}-rain`,  fmt(Math.round(benefits.rain)));
    setText(`${prefix}-air`,   fmt(Math.round(benefits.air)));

    const barsEl = document.getElementById(`${prefix}-species`);
    if (!barsEl) return;
    const max = Math.max(...benefits.topSpecies.map(([, c]) => c), 1);
    barsEl.innerHTML = benefits.topSpecies.map(([sp, cnt]) => `
      <div class="sp-row">
        <span>${sp}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:${Math.round((cnt / max) * 100)}%"></div>
        </div>
        <strong>${cnt}</strong>
      </div>
    `).join('');
  }

  // ── API 載入 ─────────────────────────────────────────
  async function loadRoad({ prefix, name, bbox }) {
    const p = new URLSearchParams({
      min_lat:  bbox.min_lat,
      max_lat:  bbox.max_lat,
      min_lng:  bbox.min_lng,
      max_lng:  bbox.max_lng,
      limit:    2000,
      category: 'street',      // 行道樹
    });
    try {
      const res = await fetch(`${API_BASE}/trees?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const trees = data.trees || [];
      if (!trees.length) throw new Error('empty');
      const b = calcRoadBenefits(trees);
      renderRoad(prefix, b);
      setText(`${prefix}-status`, `即時資料 · ${b.count} 棵`);
    } catch (err) {
      setText(`${prefix}-status`, '示範資料');
      // Fallback：顯示合理估算值（敦化南路 ~800棵，仁愛路 ~600棵）
      const fallback = prefix === 'dh'
        ? { count: 820, co2: 14760, rain: 1804, air: 393600, topSpecies: [['懸鈴木', 312], ['樟樹', 188], ['榕樹', 142], ['茄苳', 98], ['鳳凰木', 80]] }
        : { count: 620, co2: 11160, rain: 1364, air: 297600, topSpecies: [['榕樹', 210], ['樟樹', 164], ['茄苳', 88], ['白千層', 72], ['台灣欒樹', 86]] };
      renderRoad(prefix, fallback);
    }
  }

  // ── 啟動 ─────────────────────────────────────────────
  ROADS.forEach(road => loadRoad(road));
})();
