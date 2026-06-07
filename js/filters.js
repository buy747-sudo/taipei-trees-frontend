// js/filters.js — filter chips state + query builder

const filterState = {
  district: '',
  species: '',
  category: 'all',
};

function getFilterParams() {
  const params = {};
  if (filterState.district) params.district = filterState.district;
  if (filterState.species) params.species = filterState.species;
  if (filterState.category && filterState.category !== 'all') params.category = filterState.category;
  params.limit = 500;
  return params;
}

let _filterTimer = null;
function scheduleReload() {
  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => {
    if (typeof loadTrees === 'function') loadTrees();
  }, 400);
}

function initFilters() {
  const districtSel = document.getElementById('filter-district');
  districtSel.addEventListener('change', () => {
    filterState.district = districtSel.value;
    if (filterState.district) flyToDistrict(filterState.district);
    scheduleReload();
  });

  const speciesInput = document.getElementById('filter-species');
  speciesInput.addEventListener('input', () => {
    filterState.species = speciesInput.value.trim();
    scheduleReload();
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterState.category = chip.dataset.cat;
      scheduleReload();
    });
  });
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

    const { lat, lon, display_name } = results[0];
    // 路段搜尋用 zoom 16，可看到更長範圍的樹木分布
    _map.flyTo([parseFloat(lat), parseFloat(lon)], 16);

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
