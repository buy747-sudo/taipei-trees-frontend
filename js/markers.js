// js/markers.js — tree markers + markercluster

const ICON_STREET = L.divIcon({
  className: '',
  html: '<div style="background:#1a5c2a;width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [12, 12], iconAnchor: [6, 6],
});

const ICON_PROTECTED = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#f59e0b;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);filter:drop-shadow(0 1px 2px rgba(0,0,0,0.4))"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const ICON_PARK = L.divIcon({
  className: '',
  html: '<div style="background:#fbcfe8;width:12px;height:12px;border-radius:50%;border:2px solid #f9a8d4;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>',
  iconSize: [12, 12], iconAnchor: [6, 6],
});

function _treeIcon(tree) {
  if (tree.tree_category === 'protected') return ICON_PROTECTED;
  if (tree.tree_category === 'park') return ICON_PARK;
  return ICON_STREET;
}

function addTreeMarkers(trees) {
  const markers = trees.map(tree => {
    const m = L.marker([tree.lat, tree.lng], { icon: _treeIcon(tree) });
    m.on('click', () => openSheet(tree));
    return m;
  });
  _clusterGroup.addLayers(markers);
}

function clearMarkers() {
  _clusterGroup.clearLayers();
}
