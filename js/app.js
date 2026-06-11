// js/app.js — 主進入點

function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, duration);
}

function renderTreeList(trees) {
  const ul = document.getElementById('tree-list');
  if (!trees.length) {
    ul.innerHTML = '<li style="padding:16px;color:#888;text-align:center;">此範圍內無樹木資料</li>';
    return;
  }
  ul.innerHTML = trees.slice(0, 50).map((t, i) => {
    const badgeClass = t.tree_category === 'protected' ? 'badge-protected' : 'badge-street';
    const label = CATEGORY_LABEL[t.tree_category] || '';
    const sub = [t.district, t.height_m ? `${t.height_m}m` : null, t.dbh_cm ? `DBH ${t.dbh_cm}cm` : null]
      .filter(Boolean).join(' · ');
    return `<li tabindex="0" data-idx="${i}">
      <div class="tree-main">
        <div class="tree-code">${t.registry_code || ''}</div>
        <div class="tree-name">${t.species_name || '未知樹種'}</div>
        <div class="tree-sub">${sub}</div>
      </div>
      <span class="tree-badge ${badgeClass}">${label}</span>
    </li>`;
  }).join('');

  let _cachedTrees = trees.slice(0, 50);
  ul.querySelectorAll('li').forEach(li => {
    const idx = parseInt(li.dataset.idx, 10);
    li.addEventListener('click', () => openSheet(_cachedTrees[idx]));
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter') openSheet(_cachedTrees[idx]); });
  });
}

let _lastBboxKey = '';
let _isLoading = false;

async function loadTrees(retry = 0) {
  if (_isLoading) return;
  const bounds = getMapBounds();
  const params = { ...bounds, ...getFilterParams() };
  const bboxKey = JSON.stringify(params);
  if (retry === 0 && bboxKey === _lastBboxKey) return;
  _lastBboxKey = bboxKey;
  _isLoading = true;

  document.getElementById('count-label').textContent = '載入中…';
  clearMarkers();

  try {
    const data = await apiFetchTrees(params);
    const trees = data.trees || [];
    addTreeMarkers(trees);
    renderTreeList(trees);
    const shown = Math.min(trees.length, 50);
    document.getElementById('count-label').textContent = `此範圍顯示 ${shown} 棵`;
  } catch (e) {
    // 失敗後重置 key，否則同一範圍不會再重新查詢
    _lastBboxKey = '';
    if (retry < 2) {
      document.getElementById('count-label').textContent = '載入失敗，重試中…';
      setTimeout(() => loadTrees(retry + 1), 2000 * (retry + 1));
    } else {
      document.getElementById('count-label').textContent = '載入失敗，請稍後再試';
      showToast('無法載入樹木資料，請稍後再試');
    }
    console.error(e);
  } finally {
    _isLoading = false;
  }
}

function onMapMoved() {
  loadTrees();
}

// ── 首訪歡迎卡：只顯示一次（localStorage 記錄）────────────
function initWelcome() {
  const KEY = 'tt_welcomed';
  const overlay = document.getElementById('welcome-overlay');
  if (!overlay) return;
  // 已看過、帶深連結進站（?id= 分享連結）、或自動化測試環境就不打擾
  if (localStorage.getItem(KEY) || new URLSearchParams(location.search).has('id') || navigator.webdriver) return;

  overlay.hidden = false;
  const dismiss = () => {
    localStorage.setItem(KEY, '1');
    overlay.hidden = true;
  };

  document.getElementById('welcome-close').addEventListener('click', dismiss);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) dismiss(); });
  document.getElementById('welcome-search').addEventListener('click', () => {
    dismiss();
    document.getElementById('search-input').focus();
  });
  document.getElementById('welcome-scan').addEventListener('click', () => {
    dismiss();
    document.getElementById('scan-btn').click();
  });
  // 綠資產是 <a>，跳頁前記錄已看過
  overlay.querySelector('a.welcome-act').addEventListener('click', () => {
    localStorage.setItem(KEY, '1');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initSheet();
  initFilters();
  initSearch();
  initQr();
  initStats();
  initMeasure();
  initExport();
  initWelcome();
  prepareInitialMapViewport();

  loadTrees();
});
