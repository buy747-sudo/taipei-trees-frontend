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

function initSearch() {
  const input = document.getElementById('search-input');

  async function handleSearch() {
    const raw = input.value.trim();
    if (!raw) return;

    // 嘗試從 geopkl URL 解析 treeid
    let code = raw;
    try {
      const u = new URL(raw);
      const tid = u.searchParams.get('treeid') || u.searchParams.get('id');
      if (tid) code = tid;
    } catch (_) { /* raw 不是 URL，直接當 code 用 */ }

    const data = await apiFetchTree(code);
    if (data && data.tree) {
      openSheet(data.tree);
      if (data.tree.lat && data.tree.lng) {
        _map.flyTo([data.tree.lat, data.tree.lng], 17);
      }
    } else {
      showToast(`找不到樹籍編號「${code}」`);
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
}
