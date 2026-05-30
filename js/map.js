// js/map.js — Leaflet init, basemap layers, location button
let _map, _clusterGroup;

function initMap() {
  _map = L.map('map-container', {
    center: TAIPEI_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: true,
  });

  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
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

  L.control.layers(
    { '街道圖 (OSM)': osm, '衛星圖 (ESRI)': esri, '正射影像 (NLSC)': nlsc },
    {},
    { position: 'topright', collapsed: true }
  ).addTo(_map);

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

  return _map;
}

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
