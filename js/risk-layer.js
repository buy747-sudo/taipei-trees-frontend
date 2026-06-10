// js/risk-layer.js — 政府中高風險樹木圖層（登入員工專用，不對外公開）
// 依賴：config.js、auth.js、map.js（_map 變數）

const RiskLayer = (() => {
  const RISK_API = API_BASE.replace('/public', '') + '/api/risk-flags';

  // ── 圖示定義 ───────────────────────────────────────────────────────────────
  function _makeIcon(riskLevel) {
    const isHigh = riskLevel === '高';
    const bg     = isHigh ? '#dc2626' : '#ea580c';   // 紅 / 橘
    const size   = isHigh ? 28 : 24;
    const fs     = isHigh ? 14 : 12;
    const shadow = isHigh
      ? '0 0 0 3px rgba(220,38,38,0.35),0 2px 6px rgba(0,0,0,0.5)'
      : '0 0 0 3px rgba(234,88,12,0.30),0 2px 4px rgba(0,0,0,0.4)';

    return L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        background:${bg};
        border:2.5px solid #fff;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:${fs}px;line-height:1;
        box-shadow:${shadow};
        cursor:pointer;">⚠️</div>`,
      iconSize:   [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor:[0, -(size / 2 + 4)],
    });
  }

  // ── 狀態 ───────────────────────────────────────────────────────────────────
  let _layerGroup = null;
  let _loaded     = false;
  let _visible    = false;
  let _btn        = null;

  // ── 載入並繪製圖層 ─────────────────────────────────────────────────────────
  async function _load() {
    if (_loaded) return;
    try {
      const res = await Auth.authFetch(RISK_API);
      if (!res || !res.ok) return;
      const data = await res.json();
      const flags = data.flags || [];

      _layerGroup = L.layerGroup();

      flags.forEach(f => {
        if (f.lat == null || f.lng == null) return;
        const marker = L.marker([f.lat, f.lng], { icon: _makeIcon(f.risk_level) });

        const tilt    = f.tilt_status   ? `<div class="rp-row">傾斜：${f.tilt_status}</div>` : '';
        const defect  = f.defect_rate   != null ? `<div class="rp-row">缺失率：${f.defect_rate}%</div>` : '';
        const factors = f.key_factors   ? `<div class="rp-factors">${f.key_factors}</div>` : '';
        const navUrl  = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}&travelmode=driving`;

        marker.bindPopup(`
          <div class="risk-popup">
            <div class="rp-header rp-${f.risk_level === '高' ? 'high' : 'mid'}">
              ⚠️ ${f.risk_level}風險　${f.species_name || ''}
            </div>
            <div class="rp-code">${f.registry_code}</div>
            <div class="rp-row">${f.district || ''}　${f.road_section || ''}</div>
            ${tilt}${defect}${factors}
            <a class="rp-nav" href="${navUrl}" target="_blank" rel="noopener">🚗 導航前往</a>
          </div>`, { maxWidth: 260 });

        _layerGroup.addLayer(marker);
      });

      _loaded = true;
      console.log(`[RiskLayer] 載入 ${flags.length} 筆風險旗標`);
    } catch (e) {
      console.warn('[RiskLayer] 載入失敗', e);
    }
  }

  // ── 顯示 / 隱藏 ────────────────────────────────────────────────────────────
  async function toggle() {
    if (!_layerGroup && !_loaded) await _load();
    if (!_layerGroup) return;

    _visible = !_visible;
    if (_visible) {
      _layerGroup.addTo(_map);
      if (_btn) { _btn.style.background = '#7f1d1d'; _btn.title = '隱藏風險圖層'; }
    } else {
      _map.removeLayer(_layerGroup);
      if (_btn) { _btn.style.background = 'rgba(220,38,38,0.85)'; _btn.title = '顯示政府中高風險樹木'; }
    }
  }

  // ── 初始化：在地圖上加入切換按鈕 ──────────────────────────────────────────
  function init() {
    if (!Auth.isLoggedIn()) return;   // 未登入不顯示

    // 等 _map 就緒
    const tryInit = setInterval(() => {
      if (typeof _map === 'undefined' || !_map) return;
      clearInterval(tryInit);

      // 自訂 Leaflet 控制按鈕
      const RiskControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd() {
          _btn = L.DomUtil.create('button', 'risk-layer-btn');
          _btn.innerHTML = '⚠️';
          _btn.title     = '顯示政府中高風險樹木';
          _btn.style.cssText = `
            width:36px;height:36px;border-radius:8px;border:2px solid #fff;
            background:rgba(220,38,38,0.85);color:#fff;font-size:16px;
            cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;`;
          L.DomEvent.on(_btn, 'click', L.DomEvent.stopPropagation);
          L.DomEvent.on(_btn, 'click', toggle);
          return _btn;
        },
      });
      new RiskControl().addTo(_map);
    }, 200);
  }

  return { init, toggle };
})();

// ── Popup CSS（動態注入）──────────────────────────────────────────────────────
(function injectRiskPopupCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .risk-popup { font-family: system-ui, sans-serif; font-size: 0.82rem; min-width: 200px; }
    .rp-header  { font-weight:800; padding:6px 8px; border-radius:6px 6px 0 0;
                  margin:-6px -12px 8px; font-size:0.88rem; }
    .rp-high    { background:#fee2e2; color:#7f1d1d; }
    .rp-mid     { background:#ffedd5; color:#7c2d12; }
    .rp-code    { font-size:0.72rem; color:#888; margin-bottom:4px; }
    .rp-row     { color:#333; margin-bottom:2px; }
    .rp-factors { background:#fef9c3; border-radius:4px; padding:5px 7px;
                  margin:6px 0; color:#713f12; font-size:0.78rem; line-height:1.5; }
    .rp-nav     { display:block; margin-top:8px; padding:7px; text-align:center;
                  background:#eff6ff; color:#1e40af; border-radius:6px;
                  text-decoration:none; font-weight:700; font-size:0.82rem; }
    .rp-nav:hover { background:#dbeafe; }
  `;
  document.head.appendChild(style);
})();
