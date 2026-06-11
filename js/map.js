// js/map.js — Leaflet init, basemap layers, location button
let _map, _clusterGroup;

function initMap() {
  _map = L.map('map-container', {
    center: TAIPEI_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
  });

  // 預設街道圖：CARTO Voyager — 色調柔和，樹木標記視覺對比更好
  const osm = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 20,
  });

  const esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, AEX, GeoEye, Getmapping, Aerogrid, IGN',
    maxZoom: 19,
  });

  const nlsc = L.tileLayer(
    'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
    attribution: '© <a href="https://www.nlsc.gov.tw">內政部國土測繪中心</a>',
    maxZoom: 20,
  });

  osm.addTo(_map);

  // 覆蓋圖層：土地使用（可疊加在任一底圖上）
  const luimap = L.tileLayer(
    'https://wmts.nlsc.gov.tw/wmts/LUIMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',
    {
      attribution: '© 內政部國土測繪中心 國土利用調查成果圖',
      maxZoom: 20,
      opacity: 0.72,
    }
  );

  const urbanPlan = L.tileLayer(
    'https://www.historygis.udd.gov.taipei/arcgis/rest/services/Urban/UrbanPlan/MapServer/WMTS/tile/1.0.0/Urban_UrbanPlan/default/GoogleMapsCompatible/{z}/{y}/{x}',
    {
      attribution: '© 臺北市政府都市發展局 都市計畫使用分區圖',
      maxZoom: 20,
      opacity: 0.75,
    }
  );

  const landsect = L.tileLayer(
    'https://wmts.nlsc.gov.tw/wmts/LANDSECT/default/GoogleMapsCompatible/{z}/{y}/{x}',
    {
      attribution: '© 內政部國土測繪中心 段籍圖',
      maxZoom: 20,
      opacity: 0.85,
    }
  );

  // ── 自訂底圖縮圖切換器 ────────────────────────────────
  // 縮圖：台北市中心附近 zoom=10 tile(x=857, y=438)
  const THUMBS = {
    osm:  'https://a.basemaps.cartocdn.com/rastertiles/voyager/10/857/438.png',
    esri: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/438/857',
    nlsc: 'https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/10/438/857',
  };

  const BasemapControl = L.Control.extend({
    _currentBase: null,

    onAdd(map) {
      this._currentBase = osm;
      const c = L.DomUtil.create('div', 'bm-ctrl leaflet-bar');
      L.DomEvent.disableClickPropagation(c);
      L.DomEvent.disableScrollPropagation(c);

      // 切換按鈕
      const btn = L.DomUtil.create('a', 'bm-btn', c);
      btn.href = '#'; btn.title = '切換底圖 / 圖層';
      btn.innerHTML = '<span aria-hidden="true">🗺</span>';

      // 展開面板
      const panel = L.DomUtil.create('div', 'bm-panel', c);
      panel.hidden = true;

      // 底圖縮圖
      const lbBase = L.DomUtil.create('p', 'bm-section-label', panel);
      lbBase.textContent = '底圖';
      const row = L.DomUtil.create('div', 'bm-base-row', panel);

      [
        { label: '街道圖',   layer: osm,  thumb: THUMBS.osm  },
        { label: '衛星圖',   layer: esri, thumb: THUMBS.esri },
        { label: '正射影像', layer: nlsc, thumb: THUMBS.nlsc },
      ].forEach(({ label, layer, thumb }) => {
        const item = L.DomUtil.create('div', 'bm-item' + (layer === osm ? ' bm-active' : ''), row);
        const img  = L.DomUtil.create('img', 'bm-thumb', item);
        img.src = thumb; img.alt = label; img.loading = 'lazy';
        const sp = L.DomUtil.create('span', 'bm-name', item);
        sp.textContent = label;
        L.DomEvent.on(item, 'click', () => {
          map.removeLayer(this._currentBase);
          map.addLayer(layer);
          this._currentBase = layer;
          row.querySelectorAll('.bm-item').forEach(el => el.classList.remove('bm-active'));
          item.classList.add('bm-active');
        });
      });

      // 參考圖層（開關狀態記憶於 localStorage，下次開啟自動還原）
      const hr = L.DomUtil.create('div', 'bm-hr', panel);
      const lbOv = L.DomUtil.create('p', 'bm-section-label', panel);
      lbOv.textContent = '參考圖層';

      const OVERLAY_KEY = 'tt_overlays';
      let savedOverlays = [];
      try { savedOverlays = JSON.parse(localStorage.getItem(OVERLAY_KEY)) || []; } catch { /* 忽略壞資料 */ }

      [
        { id: 'luimap',   label: '土地利用現況', layer: luimap    },
        { id: 'urban',    label: '都市計畫分區', layer: urbanPlan },
        { id: 'landsect', label: '地籍段界',     layer: landsect  },
      ].forEach(({ id, label, layer }) => {
        const lbl = L.DomUtil.create('label', 'bm-overlay', panel);
        const cb  = L.DomUtil.create('input', '', lbl);
        cb.type = 'checkbox';
        lbl.appendChild(document.createTextNode(' ' + label));
        if (savedOverlays.includes(id)) { cb.checked = true; map.addLayer(layer); }
        L.DomEvent.on(cb, 'change', () => {
          cb.checked ? map.addLayer(layer) : map.removeLayer(layer);
          const idx = savedOverlays.indexOf(id);
          if (cb.checked && idx === -1) savedOverlays.push(id);
          if (!cb.checked && idx !== -1) savedOverlays.splice(idx, 1);
          try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(savedOverlays)); } catch { /* 無痕模式 */ }
        });
      });

      const note = L.DomUtil.create('p', 'bm-note', panel);
      note.textContent = '參考圖層僅供參考，正式土地權屬與分區以地政、都發機關公告資料為準。';

      // 開關
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        panel.hidden = !panel.hidden;
      });

      return c;
    }
  });
  new BasemapControl({ position: 'topright' }).addTo(_map);

  // 定位按鈕
  const LocControl = L.Control.extend({
    onAdd() {
      const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const a = L.DomUtil.create('a', '', div);
      a.href = '#'; a.title = '我的位置';
      a.innerHTML = '<span aria-hidden="true">📍</span>';
      a.style.cssText = 'font-size:18px;line-height:30px;text-align:center;display:block;width:30px;height:30px;text-decoration:none;';
      L.DomEvent.on(a, 'click', (e) => { L.DomEvent.preventDefault(e); locateUser(); });
      return div;
    }
  });
  new LocControl({ position: 'topright' }).addTo(_map);

  _clusterGroup = L.layerGroup();
  _map.addLayer(_clusterGroup);

  _map.on('moveend', () => {
    if (typeof onMapMoved === 'function') onMapMoved();
  });

  // 動態計算可視高度，避免 header 高度不固定（登入/未登入）造成地圖底部超出視窗
  setTimeout(fitMapToViewport, 100);
  window.addEventListener('resize', fitMapToViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitMapToViewport);
  }

  return _map;
}

function fitMapToViewport() {
  const topBar  = document.getElementById('top-bar');
  const dataBar = document.getElementById('data-bar');
  const mapEl   = document.getElementById('map-container');
  if (!topBar || !dataBar || !mapEl) return;
  const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  // 也要扣掉底部統計列，否則匯出/統計總覽按鈕會被推出視窗外
  const statsBar = document.getElementById('stats-bar');
  const available = vh - topBar.offsetHeight - dataBar.offsetHeight - (statsBar ? statsBar.offsetHeight : 0);
  mapEl.style.height = Math.max(available, 200) + 'px';
  if (_map) _map.invalidateSize();
}

function getMap() { return _map; }

function getMapBounds() {
  const b = _map.getBounds();
  return {
    min_lat: b.getSouth().toFixed(6),
    max_lat: b.getNorth().toFixed(6),
    min_lng: b.getWest().toFixed(6),
    max_lng: b.getEast().toFixed(6),
  };
}

function flyToDistrict(districtName) {
  const center = DISTRICT_CENTERS[districtName];
  if (center) _map.flyTo(center, 14);
}

let _locMarker = null;
function locateUser() {
  if (!navigator.geolocation) { showToast('瀏覽器不支援定位功能'); return; }
  navigator.geolocation.getCurrentPosition(
    ({ coords: { latitude: lat, longitude: lng } }) => {
      _map.flyTo([lat, lng], 17);
      if (_locMarker) _map.removeLayer(_locMarker);
      _locMarker = L.circleMarker([lat, lng], {
        radius: 10, color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.6, weight: 3,
      }).addTo(_map);
    },
    () => showToast('無法取得位置，請確認瀏覽器權限')
  );
}
