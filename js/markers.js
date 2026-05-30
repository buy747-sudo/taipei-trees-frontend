// js/markers.js — tree markers + markercluster
const ICON_STREET = L.divIcon({
  className: '',
  html: '<div style="background:#1a5c2a;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [12, 12], iconAnchor: [6, 6],
});

const ICON_PROTECTED = L.divIcon({
  className: '',
  html: '<div style="background:#c62828;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [14, 14], iconAnchor: [7, 7],
});

function addTreeMarkers(trees) {
  const markers = trees.map(tree => {
    const icon = tree.tree_category === 'protected' ? ICON_PROTECTED : ICON_STREET;
    const m = L.marker([tree.lat, tree.lng], { icon });
    m.on('click', () => openSheet(tree));
    return m;
  });
  _clusterGroup.addLayers(markers);
}

function clearMarkers() {
  _clusterGroup.clearLayers();
}
