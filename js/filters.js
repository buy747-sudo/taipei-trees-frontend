// js/filters.js — filter chips state + query builder

const filterState = {
  district: '',
  road:     '',   // 進階查詢路段（僅用於定位，不傳給 API）
  species:  '',
  category: 'all',
  group:    '',   // 樹型：evergreen/deciduous/flowering/palm/conifer/protected
  dbh:      '',   // 胸徑區間，格式 "min-max"（max 可空 = 不設上限）
  height:   '',   // 樹高區間，格式同上
};

// "15-30" → { min: 15, max: 30 }；"75-" → { min: 75 }
function parseRange(str) {
  if (!str) return null;
  const [min, max] = str.split('-');
  const r = {};
  if (min !== '') r.min = parseFloat(min);
  if (max !== '' && max !== undefined) r.max = parseFloat(max);
  return r;
}

function getFilterParams() {
  const params = {};
  if (filterState.district) params.district = filterState.district;
  if (filterState.species) params.species = filterState.species;
  if (filterState.category && filterState.category !== 'all') params.category = filterState.category;
  if (filterState.group) params.group = filterState.group;
  const dbh = parseRange(filterState.dbh);
  if (dbh) {
    if (dbh.min > 0) params.min_dbh = dbh.min;
    if (dbh.max != null) params.max_dbh = dbh.max;
  }
  const h = parseRange(filterState.height);
  if (h) {
    if (h.min > 0) params.min_height = h.min;
    if (h.max != null) params.max_height = h.max;
  }
  params.limit = getTreeLoadLimit();
  return params;
}

function getTreeLoadLimit() {
  const width = window.innerWidth || 1024;
  const map = (typeof getMap === 'function') ? getMap() : null;
  const zoom = map && typeof map.getZoom === 'function' ? map.getZoom() : DEFAULT_ZOOM;

  let base = 800;
  if (width <= 640) base = 300;
  else if (width <= 1023) base = 500;

  if (zoom <= 12) return Math.min(base, 300);
  if (zoom >= 17) {
    if (width <= 640) return 500;
    if (width <= 1023) return 800;
    return 1200;
  }
  if (zoom >= 16) {
    if (width <= 640) return 400;
    if (width <= 1023) return 700;
    return 1000;
  }
  return base;
}

let _filterTimer = null;
function scheduleReload() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    if (typeof loadTrees === 'function') loadTrees();
  }, 400);
}

// ── 進階查詢 Drawer ──────────────────────────────────────
function initAdvSearch() {
  const btn      = document.getElementById('adv-search-btn');
  const overlay  = document.getElementById('adv-overlay');
  const drawer   = document.getElementById('adv-drawer');
  const closeBtn = document.getElementById('adv-close');
  const distSel  = document.getElementById('adv-district');
  const roadInp  = document.getElementById('adv-road');
  const specInp  = document.getElementById('adv-species');
  const dbhSel   = document.getElementById('adv-dbh');
  const hgtSel   = document.getElementById('adv-height');
  const typeBtns = document.querySelectorAll('.adv-type');
  const submit   = document.getElementById('adv-submit');
  const reset    = document.getElementById('adv-reset');
  const tagsDiv  = document.getElementById('adv-active-tags');

  // 樹型按鈕：單選，再點一次取消
  let pendingGroup = '';
  typeBtns.forEach(b => {
    b.addEventListener('click', () => {
      const g = b.dataset.group;
      pendingGroup = (pendingGroup === g) ? '' : g;
      typeBtns.forEach(x => x.classList.toggle('active', x.dataset.group === pendingGroup));
    });
  });

  const GROUP_LABELS = {
    evergreen: '常綠', deciduous: '落葉', flowering: '開花',
    palm: '棕櫚', conifer: '針葉', protected: '受保護',
  };
  const DBH_LABELS = {
    '0-15': '15cm以下', '15-30': '15–30cm', '30-45': '30–45cm',
    '45-60': '45–60cm', '60-75': '60–75cm', '75-': '75cm以上',
  };
  const HGT_LABELS = {
    '0-5': '5m以下', '5-10': '5–10m', '10-15': '10–15m', '15-': '15m以上',
  };

  function openDrawer() {
    overlay.hidden = false;
    drawer.hidden  = false;
    btn.classList.add('active');
  }
  function closeDrawer() {
    overlay.hidden = true;
    drawer.hidden  = true;
    btn.classList.remove('active');
  }

  btn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  closeBtn.addEventListener('click', closeDrawer);

  // Enter 鍵直接送出
  [roadInp, specInp].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') submit.click(); })
  );

  // ── 套用條件標籤 ─────────────────────────────────────
  function renderTags() {
    const tags = [];
    if (filterState.district) tags.push({ key: 'district', label: '區：' + filterState.district });
    if (filterState.road)     tags.push({ key: 'road',     label: '路：' + filterState.road });
    if (filterState.species)  tags.push({ key: 'species',  label: '種：' + filterState.species });
    if (filterState.group)    tags.push({ key: 'group',    label: '型：' + GROUP_LABELS[filterState.group] });
    if (filterState.dbh)      tags.push({ key: 'dbh',      label: '徑：' + DBH_LABELS[filterState.dbh] });
    if (filterState.height)   tags.push({ key: 'height',   label: '高：' + HGT_LABELS[filterState.height] });

    if (!tags.length) { tagsDiv.hidden = true; return; }
    tagsDiv.hidden = false;
    tagsDiv.innerHTML = tags.map(t =>
      `<span class="adv-tag">${t.label}
        <button data-key="${t.key}" aria-label="移除${t.label}">✕</button>
      </span>`
    ).join('');
    tagsDiv.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.key;
        filterState[k] = '';
        if (k === 'district') distSel.value = '';
        if (k === 'road')     roadInp.value = '';
        if (k === 'species')  specInp.value = '';
        if (k === 'dbh')      dbhSel.value = '';
        if (k === 'height')   hgtSel.value = '';
        if (k === 'group') {
          pendingGroup = '';
          typeBtns.forEach(x => x.classList.remove('active'));
        }
        renderTags();
        scheduleReload();
      });
    });
  }

  // ── 查詢 ──────────────────────────────────────────────
  submit.addEventListener('click', async () => {
    const dist = distSel.value;
    const road = roadInp.value.trim();
    const spec = specInp.value.trim();

    filterState.district = dist;
    filterState.road     = road;
    filterState.species  = spec;
    filterState.group    = pendingGroup;
    filterState.dbh      = dbhSel.value;
    filterState.height   = hgtSel.value;

    closeDrawer();
    renderTags();

    // 定位：路段優先，其次行政區
    if (road) {
      await searchByAddress(road);          // 已含台北市補前綴邏輯
    } else if (dist) {
      flyToDistrict(dist);
    }

    scheduleReload();
  });

  // ── 清除 ─────────────────────────────────────────────
  reset.addEventListener('click', () => {
    distSel.value = '';
    roadInp.value = '';
    specInp.value = '';
    dbhSel.value  = '';
    hgtSel.value  = '';
    pendingGroup  = '';
    typeBtns.forEach(x => x.classList.remove('active'));
    filterState.district = '';
    filterState.road     = '';
    filterState.species  = '';
    filterState.group    = '';
    filterState.dbh      = '';
    filterState.height   = '';
    renderTags();
    scheduleReload();
  });
}

function initFilters() {
  // category chips（全部 / 行道樹 / 受保護）
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterState.category = chip.dataset.cat;
      scheduleReload();
    });
  });

  initAdvSearch();
}

// ── 地址地理編碼（Nominatim / OpenStreetMap）────────────
async function searchByAddress(address) {
  showToast('🔍 正在搜尋地址…', 5000);
  try {
    // 若未含「台北」自動補前綴，提高精準度
    const q = /台北/.test(address) ? address : '台北市 ' + address;
    const url = 'https://nominatim.openstreetmap.org/search?' +
      'q=' + encodeURIComponent(q) +
      '&format=json&limit=1&countrycodes=tw&accept-language=zh-TW';
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const results = await res.json();

    if (!results.length) {
      showToast('⚠️ 找不到此路段，請試試「路名＋段」（如：仁愛路四段、忠孝東路三段）');
      return;
    }

    const { lat, lon, display_name, boundingbox } = results[0];
    // 優先用 boundingbox 讓整條路段置中，避免只用單點造成樹木偏落底部
    if (boundingbox && boundingbox.length === 4) {
      const [south, north, west, east] = boundingbox.map(parseFloat);
      _map.fitBounds([[south, west], [north, east]], { padding: [40, 40], maxZoom: 17 });
    } else {
      _map.flyTo([parseFloat(lat), parseFloat(lon)], 16);
    }

    // 顯示地址第一段（逗號前），避免太長
    const short = display_name.split(',')[0];
    showToast('📍 ' + short + '　地圖已定位', 3500);
  } catch (e) {
    showToast('地址搜尋失敗，請稍後再試');
    console.error('Nominatim error', e);
  }
}

function initSearch() {
  const input = document.getElementById('search-input');

  async function handleSearch() {
    const raw = input.value.trim();
    if (!raw) return;

    // ── 情況 1：QR Code / geopkl URL ───────────────────────
    if (raw.startsWith('http')) {
      let code = raw;
      try {
        const u = new URL(raw);
        const tid = u.searchParams.get('treeid') || u.searchParams.get('id');
        if (tid) code = tid;
      } catch (_) {}
      const data = await apiFetchTree(code);
      if (data && data.tree) {
        openSheet(data.tree);
        if (data.tree.lat && data.tree.lng) _map.flyTo([data.tree.lat, data.tree.lng], 17);
      } else {
        showToast('找不到對應的樹木資料');
      }
      return;
    }

    // ── 情況 2：樹籍編號（2字母 + 8~12數字，如 SY0030551077）
    if (/^[A-Za-z]{2}\d{8,12}$/.test(raw)) {
      const data = await apiFetchTree(raw.toUpperCase());
      if (data && data.tree) {
        openSheet(data.tree);
        if (data.tree.lat && data.tree.lng) _map.flyTo([data.tree.lat, data.tree.lng], 17);
      } else {
        showToast(`找不到樹籍編號「${raw}」`);
      }
      return;
    }

    // ── 情況 3：其他輸入 → 當地址處理 ──────────────────────
    await searchByAddress(raw);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
}
