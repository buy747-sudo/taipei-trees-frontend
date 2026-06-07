// js/measure.js — 地圖量測工具（距離 / 面積）
// 依賴：map.js 的 getMap()

(function () {
  let _mode    = null;   // 'distance' | 'area'
  let _points  = [];
  let _markers = [];
  let _polyline = null;
  let _polygon  = null;
  let _tempLine = null;
  let _resultLabel = null;
  let _map;
  let _finishBtn;

  // ── 格式化 ───────────────────────────────────────────
  function fmtDistance(m) {
    return m >= 1000
      ? (m / 1000).toFixed(2) + ' km'
      : Math.round(m) + ' m';
  }

  function fmtArea(m2) {
    if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' 公頃';
    return Math.round(m2).toLocaleString() + ' m²';
  }

  // ── 計算 ─────────────────────────────────────────────
  function calcDistance(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += _map.distance(pts[i - 1], pts[i]);
    return d;
  }

  function calcArea(pts) {
    if (pts.length < 3) return 0;
    // 球面多邊形面積（shoelace in radians × R²）
    const R = 6371008.8;
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dLon = (pts[j].lng - pts[i].lng) * Math.PI / 180;
      const la1  = pts[i].lat * Math.PI / 180;
      const la2  = pts[j].lat * Math.PI / 180;
      area += dLon * (2 + Math.sin(la1) + Math.sin(la2));
    }
    return Math.abs(area * R * R / 2);
  }

  // ── 清除 ─────────────────────────────────────────────
  function clearLayers() {
    _markers.forEach(m => _map.removeLayer(m));
    _markers = [];
    _points  = [];
    if (_polyline)    { _map.removeLayer(_polyline);    _polyline    = null; }
    if (_polygon)     { _map.removeLayer(_polygon);     _polygon     = null; }
    if (_tempLine)    { _map.removeLayer(_tempLine);    _tempLine    = null; }
    if (_resultLabel) { _map.removeLayer(_resultLabel); _resultLabel = null; }
  }

  function exitMode() {
    _map.off('click',     onMapClick);
    _map.off('mousemove', onMouseMove);
    _map.off('dblclick',  onDblClick);
    _map.doubleClickZoom.enable();
    L.DomUtil.removeClass(_map.getContainer(), 'measure-cursor');
    document.querySelectorAll('.measure-mode-btn').forEach(b => b.classList.remove('msr-active'));
    if (_finishBtn) _finishBtn.hidden = true;
    clearLayers();
    _mode = null;
  }

  // ── 地圖事件 ──────────────────────────────────────────
  function onMapClick(e) {
    _points.push(e.latlng);

    const dot = L.circleMarker(e.latlng, {
      radius: 4, color: '#b45309', fillColor: '#fbbf24',
      fillOpacity: 1, weight: 2, pane: 'overlayPane',
    }).addTo(_map);
    _markers.push(dot);

    redraw(e.latlng);
  }

  function onMouseMove(e) {
    if (_points.length === 0) return;
    const last = _points[_points.length - 1];
    if (_tempLine) _map.removeLayer(_tempLine);
    _tempLine = L.polyline([last, e.latlng], {
      color: '#b45309', weight: 1.5, dashArray: '4,4', opacity: 0.55,
    }).addTo(_map);
  }

  function onDblClick() {
    // dblclick 前有兩次 click，移除最後一個重複點
    if (_points.length > 1) {
      _points.pop();
      const m = _markers.pop();
      if (m) _map.removeLayer(m);
    }
    finishMeasure();
  }

  // ── 繪製更新 ─────────────────────────────────────────
  function redraw(latlng) {
    if (_mode === 'distance') {
      if (_polyline) _map.removeLayer(_polyline);
      _polyline = L.polyline(_points, {
        color: '#b45309', weight: 2.5, dashArray: '6,4',
      }).addTo(_map);
      if (_points.length > 1) showLabel(latlng, `📏 ${fmtDistance(calcDistance(_points))}`);

    } else if (_mode === 'area') {
      if (_polygon) _map.removeLayer(_polygon);
      if (_points.length >= 2) {
        _polygon = L.polygon(_points, {
          color: '#1a5c2a', weight: 2, fillColor: '#7ecb94',
          fillOpacity: 0.25, dashArray: '6,4',
        }).addTo(_map);
      }
      if (_points.length >= 3) showLabel(latlng, `⬡ ${fmtArea(calcArea(_points))}`);
    }
  }

  function finishMeasure() {
    if (_tempLine) { _map.removeLayer(_tempLine); _tempLine = null; }
    if (_mode === 'distance' && _points.length > 1) {
      if (_polyline) _map.removeLayer(_polyline);
      _polyline = L.polyline(_points, { color: '#b45309', weight: 2.5, dashArray: '6,4' }).addTo(_map);
      showLabel(_points[_points.length - 1], `📏 ${fmtDistance(calcDistance(_points))}`);
    } else if (_mode === 'area' && _points.length >= 3) {
      if (_polygon) _map.removeLayer(_polygon);
      _polygon = L.polygon(_points, {
        color: '#1a5c2a', weight: 2, fillColor: '#7ecb94', fillOpacity: 0.25,
      }).addTo(_map);
      const center = _polygon.getBounds().getCenter();
      showLabel(center, `⬡ ${fmtArea(calcArea(_points))}`);
    }
    // 結束互動，但保留畫面上的結果
    _map.off('click',     onMapClick);
    _map.off('mousemove', onMouseMove);
    _map.off('dblclick',  onDblClick);
    _map.doubleClickZoom.enable();
    L.DomUtil.removeClass(_map.getContainer(), 'measure-cursor');
    document.querySelectorAll('.measure-mode-btn').forEach(b => b.classList.remove('msr-active'));
    if (_finishBtn) _finishBtn.hidden = true;
    _mode = null;
  }

  // ── 結果標籤 ─────────────────────────────────────────
  function showLabel(latlng, text) {
    if (_resultLabel) _map.removeLayer(_resultLabel);
    _resultLabel = L.tooltip({
      permanent: true, className: 'measure-tooltip',
      direction: 'top', offset: [0, -8],
    }).setLatLng(latlng).setContent(text).addTo(_map);
  }

  // ── 開始量測 ─────────────────────────────────────────
  function startMode(mode) {
    if (_mode) exitMode();
    _mode = mode;
    _map.doubleClickZoom.disable();
    _map.on('click',     onMapClick);
    _map.on('mousemove', onMouseMove);
    _map.on('dblclick',  onDblClick);
    L.DomUtil.addClass(_map.getContainer(), 'measure-cursor');
    document.querySelectorAll('.measure-mode-btn').forEach(b => b.classList.remove('msr-active'));
    document.querySelector(`.measure-mode-btn[data-mode="${mode}"]`)?.classList.add('msr-active');
    if (_finishBtn) _finishBtn.hidden = false;
  }

  // ── Leaflet Control ───────────────────────────────────
  function initMeasure() {
    _map = getMap();

    const MeasureControl = L.Control.extend({
      onAdd() {
        const c = L.DomUtil.create('div', 'measure-ctrl leaflet-bar');
        L.DomEvent.disableClickPropagation(c);
        L.DomEvent.disableScrollPropagation(c);

        // 距離按鈕
        const distBtn = L.DomUtil.create('a', 'measure-mode-btn', c);
        distBtn.href = '#'; distBtn.title = '量距離（點擊畫線，雙擊或按完成鍵結束）';
        distBtn.dataset.mode = 'distance';
        distBtn.innerHTML = '<span aria-hidden="true">📏</span>';
        L.DomEvent.on(distBtn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          _mode === 'distance' ? exitMode() : startMode('distance');
        });

        // 面積按鈕
        const areaBtn = L.DomUtil.create('a', 'measure-mode-btn', c);
        areaBtn.href = '#'; areaBtn.title = '量面積（點擊畫面，雙擊或按完成鍵結束）';
        areaBtn.dataset.mode = 'area';
        areaBtn.innerHTML = '<span aria-hidden="true">⬡</span>';
        L.DomEvent.on(areaBtn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          _mode === 'area' ? exitMode() : startMode('area');
        });

        // 完成按鈕（量測中才顯示）
        _finishBtn = L.DomUtil.create('a', 'measure-finish-btn', c);
        _finishBtn.href = '#'; _finishBtn.title = '完成量測';
        _finishBtn.innerHTML = '<span aria-hidden="true">✓</span>';
        _finishBtn.hidden = true;
        L.DomEvent.on(_finishBtn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          finishMeasure();
        });

        // 清除按鈕
        const clrBtn = L.DomUtil.create('a', 'measure-clear-btn', c);
        clrBtn.href = '#'; clrBtn.title = '清除量測';
        clrBtn.innerHTML = '<span aria-hidden="true">✕</span>';
        L.DomEvent.on(clrBtn, 'click', (e) => {
          L.DomEvent.preventDefault(e);
          exitMode();
        });

        return c;
      }
    });

    new MeasureControl({ position: 'bottomleft' }).addTo(_map);
  }

  window.initMeasure = initMeasure;
})();
