// js/risk-layer.js — 政府中高風險樹木圖層（登入員工專用，不對外公開）
// 依賴：config.js、auth.js、map.js（_map 變數）

const RiskLayer = (() => {
  const RISK_API = API_BASE.replace('/public', '') + '/api/risk-flags';

  // ── 圖示定義 ────────────────────────────────────────────────────────────────
  function _makeIcon(riskLevel) {
    const isHigh = riskLevel === '高';
    // 高風險：深紅；中風險：淺黃（加深橘邊框以確保戶外可見度）
    const bg      = isHigh ? '#991b1b' : '#fde047';
    const border  = isHigh ? 'rgba(255,255,255,0.9)' : '#d97706';
    const color   = isHigh ? '#fff'    : '#78350f';
    const size    = isHigh ? 28 : 24;
    const shadow  = isHigh
      ? '0 0 0 3px rgba(153,27,27,0.40),0 2px 6px rgba(0,0,0,0.55)'
      : '0 0 0 3px rgba(253,224,71,0.50),0 2px 4px rgba(0,0,0,0.40)';
    const fs = isHigh ? 15 : 13;

    return L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px;height:${size}px;
        background:${bg};
        border:2.5px solid ${border};
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:${fs}px;line-height:1;color:${color};
        box-shadow:${shadow};
        cursor:pointer;font-weight:900;">⚠</div>`,
      iconSize:   [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor:[0, -(size / 2 + 4)],
    });
  }

  // ── 狀態 ────────────────────────────────────────────────────────────────────
  let _highLayer   = null;
  let _midLayer    = null;
  let _loaded      = false;
  let _highVisible = false;
  let _midVisible  = false;
  let _btnHigh     = null;
  let _btnMid      = null;

  function _updateBtn(btn, active) {
    if (!btn) return;
    btn.classList.toggle('rl-active', active);
  }

  // ── 載入並分組繪製 ──────────────────────────────────────────────────────────
  async function _load() {
    if (_loaded) return;
    try {
      const res = await Auth.authFetch(RISK_API);
      if (!res || !res.ok) return;
      const data = await res.json();
      const flags = data.flags || [];

      _highLayer = L.layerGroup();
      _midLayer  = L.layerGroup();

      flags.forEach(f => {
        if (f.lat == null || f.lng == null) return;
        const marker = L.marker([f.lat, f.lng], { icon: _makeIcon(f.risk_level) });

        const tilt    = f.tilt_status  ? `<div class="rp-row">傾斜：${f.tilt_status}</div>` : '';
        const defect  = f.defect_rate != null ? `<div class="rp-row">缺失率：${f.defect_rate}%</div>` : '';
        const factors = f.key_factors  ? `<div class="rp-factors">${f.key_factors}</div>` : '';
        const navUrl  = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}&travelmode=driving`;
        const cls     = f.risk_level === '高' ? 'rp-high' : 'rp-mid';

        marker.bindPopup(`
          <div class="risk-popup">
            <div class="rp-header ${cls}">⚠ ${f.risk_level}風險　${f.species_name || ''}</div>
            <div class="rp-code">${f.registry_code}</div>
            <div class="rp-row">${f.district || ''}　${f.road_section || ''}</div>
            ${tilt}${defect}${factors}
            <a class="rp-nav" href="${navUrl}" target="_blank" rel="noopener">🚗 導航前往</a>
          </div>`, { maxWidth: 260 });

        if (f.risk_level === '高') {
          _highLayer.addLayer(marker);
        } else {
          _midLayer.addLayer(marker);
        }
      });

      _loaded = true;
      console.log(`[RiskLayer] 高風險 ${_highLayer.getLayers().length} 棵 / 中風險 ${_midLayer.getLayers().length} 棵`);
    } catch (e) {
      console.warn('[RiskLayer] 載入失敗', e);
    }
  }

  // ── 切換高風險圖層 ──────────────────────────────────────────────────────────
  async function toggleHigh() {
    if (!_loaded) await _load();
    if (!_highLayer) return;
    _highVisible = !_highVisible;
    if (_highVisible) {
      _highLayer.addTo(_map);
    } else {
      _map.removeLayer(_highLayer);
    }
    _updateBtn(_btnHigh, _highVisible);
    if (_btnHigh) _btnHigh.title = _highVisible ? '隱藏高風險樹木' : '顯示高風險樹木';
  }

  // ── 切換中風險圖層 ──────────────────────────────────────────────────────────
  async function toggleMid() {
    if (!_loaded) await _load();
    if (!_midLayer) return;
    _midVisible = !_midVisible;
    if (_midVisible) {
      _midLayer.addTo(_map);
    } else {
      _map.removeLayer(_midLayer);
    }
    _updateBtn(_btnMid, _midVisible);
    if (_btnMid) _btnMid.title = _midVisible ? '隱藏中風險樹木' : '顯示中風險樹木';
  }

  // ── 初始化：在地圖上加入兩個切換按鈕 ──────────────────────────────────────
  function init() {
    if (!Auth.isLoggedIn()) return;

    const tryInit = setInterval(() => {
      if (typeof _map === 'undefined' || !_map) return;
      clearInterval(tryInit);

      // 兩個按鈕放在同一個控制元件內，方便管理
      const RiskControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd() {
          const wrap = L.DomUtil.create('div', 'rl-wrap');
          L.DomEvent.disableClickPropagation(wrap);
          L.DomEvent.disableScrollPropagation(wrap);

          _btnHigh = L.DomUtil.create('button', 'rl-btn rl-high', wrap);
          _btnHigh.innerHTML = '<span class="rl-symbol">⚠</span><span class="rl-label">高</span>';
          _btnHigh.title     = '顯示高風險樹木';

          _btnMid = L.DomUtil.create('button', 'rl-btn rl-mid', wrap);
          _btnMid.innerHTML  = '<span class="rl-symbol">⚠</span><span class="rl-label">中</span>';
          _btnMid.title      = '顯示中風險樹木';

          L.DomEvent.on(_btnHigh, 'click', toggleHigh);
          L.DomEvent.on(_btnMid,  'click', toggleMid);
          return wrap;
        },
      });
      new RiskControl().addTo(_map);
    }, 200);
  }

  return { init, toggleHigh, toggleMid };
})();

// ── CSS（動態注入）────────────────────────────────────────────────────────────
(function injectRiskCSS() {
  const style = document.createElement('style');
  style.textContent = `
    /* ── 控制按鈕容器 ── */
    .rl-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    /* ── 各按鈕基底 ── */
    .rl-btn {
      width: 40px; height: 40px;
      border-radius: 8px;
      border: 2px solid rgba(255,255,255,0.8);
      cursor: pointer;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 1px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.30);
      opacity: 0.55;
      transition: opacity 0.18s, box-shadow 0.18s, transform 0.12s;
    }
    .rl-btn:hover  { opacity: 0.82; }
    .rl-btn.rl-active { opacity: 1; box-shadow: 0 2px 10px rgba(0,0,0,0.50); }
    .rl-btn:active { transform: scale(0.93); }

    /* ── 高風險：深紅 ── */
    .rl-high              { background: #991b1b; }
    .rl-high .rl-symbol   { color: #fff; font-size: 15px; font-weight: 900; line-height: 1; }
    .rl-high .rl-label    { color: rgba(255,255,255,0.90); font-size: 10px; font-weight: 700; line-height: 1; }
    .rl-high.rl-active    { background: #7f1d1d; border-color: #fca5a5; }

    /* ── 中風險：淺黃 ── */
    .rl-mid               { background: #fde047; border-color: #d97706; }
    .rl-mid .rl-symbol    { color: #78350f; font-size: 14px; font-weight: 900; line-height: 1; }
    .rl-mid .rl-label     { color: #92400e; font-size: 10px; font-weight: 700; line-height: 1; }
    .rl-mid.rl-active     { background: #fbbf24; border-color: #b45309; }

    /* ── Popup ── */
    .risk-popup { font-family: system-ui, sans-serif; font-size: 0.82rem; min-width: 200px; }
    .rp-header  { font-weight: 800; padding: 6px 8px; border-radius: 6px 6px 0 0;
                  margin: -6px -12px 8px; font-size: 0.88rem; }
    .rp-high    { background: #fee2e2; color: #7f1d1d; }
    .rp-mid     { background: #fef9c3; color: #78350f; }
    .rp-code    { font-size: 0.72rem; color: #888; margin-bottom: 4px; }
    .rp-row     { color: #333; margin-bottom: 2px; }
    .rp-factors { background: #fef9c3; border-radius: 4px; padding: 5px 7px;
                  margin: 6px 0; color: #713f12; font-size: 0.78rem; line-height: 1.5; }
    .rp-nav     { display: block; margin-top: 8px; padding: 7px; text-align: center;
                  background: #eff6ff; color: #1e40af; border-radius: 6px;
                  text-decoration: none; font-weight: 700; font-size: 0.82rem; }
    .rp-nav:hover { background: #dbeafe; }
  `;
  document.head.appendChild(style);
})();
