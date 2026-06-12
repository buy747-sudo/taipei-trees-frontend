// js/markers.js — tree markers

const TREE_MARKER_STYLES = {
  evergreen:  { color: '#1a5c2a', label: '常綠闊葉', shape: 'circle' },
  deciduous:  { color: '#9a5a2f', label: '落葉闊葉', shape: 'circle' },
  palm:       { color: '#7cc7d8', label: '棕櫚類',   shape: 'circle' },
  conifer:    { color: '#0f3f2e', label: '針葉樹',   shape: 'triangle' },
  flowering:  { color: '#e879a7', label: '開花觀賞樹', shape: 'circle' },
  protected:  { color: '#f59e0b', label: '受保護樹', shape: 'star' },
};

const PALM_RE = /(椰|棕櫚|蒲葵|海棗|檳榔)/;
const CONIFER_RE = /(松|杉|柏|羅漢松|肖楠|竹柏|油杉)/;
const FLOWERING_RE = /(櫻|紫薇|木棉|美人樹|火燄木|火焰木|鳳凰木|阿勃勒|風鈴木|羊蹄甲|紫荊|緬梔|玉蘭|黃槐|紅千層|流蘇|桂花|刺桐|艷紫荊|豔紫荊)/;
const DECIDUOUS_RE = /(楓|欒樹|欖仁|苦楝|榔榆|烏桕|櫸|朴樹|柳樹|無患子|構樹|桑樹|落羽松|桃花心木|茄苳)/;

function classifyTreeVisual(tree) {
  if (tree.tree_category === 'protected') return 'protected';
  const explicit = tree.visual_group || tree.leaf_type || tree.tree_type || '';
  if (TREE_MARKER_STYLES[explicit]) return explicit;
  const name = `${tree.species_name || ''}${tree.common_name || ''}`;
  if (PALM_RE.test(name)) return 'palm';
  if (CONIFER_RE.test(name)) return 'conifer';
  if (FLOWERING_RE.test(name)) return 'flowering';
  if (DECIDUOUS_RE.test(name)) return 'deciduous';
  return 'evergreen';
}

function markerSize(tree) {
  const crown = Number(tree.crown_m || tree.crown_width_m || tree.crown_diameter_m);
  if (Number.isFinite(crown) && crown > 0) return Math.max(10, Math.min(26, Math.round(8 + crown * 1.25)));
  const dbh = Number(tree.dbh_cm);
  if (Number.isFinite(dbh) && dbh > 0) return Math.max(10, Math.min(24, Math.round(9 + dbh / 8)));
  return 14;
}

function markerShape(style, size) {
  const common = `width:${size}px;height:${size}px;background:${style.color};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.38));`;
  if (style.shape === 'triangle') {
    return `<div style="${common}clip-path:polygon(50% 4%,96% 92%,4% 92%);"></div>`;
  }
  if (style.shape === 'star') {
    return `<div style="${common}clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);"></div>`;
  }
  return `<div style="${common}border-radius:50%;border:2px solid rgba(255,255,255,0.9);"></div>`;
}

function _treeIcon(tree) {
  const group = classifyTreeVisual(tree);
  const style = TREE_MARKER_STYLES[group] || TREE_MARKER_STYLES.evergreen;
  const size = markerSize(tree);
  const messageCount = Number(tree.message_count || 0);
  const hasMessages = messageCount > 0;
  const title = `${tree.species_name || '未知樹種'}｜${style.label}${hasMessages ? `｜${messageCount} 張祈福牌` : ''}`;
  const badge = hasMessages
    ? `<span class="tree-message-badge" aria-label="${messageCount} 張祈福牌">${messageCount}</span>`
    : '';
  return L.divIcon({
    className: '',
    html: `<div class="tree-marker ${group}${hasMessages ? ' has-messages' : ''}" title="${title}" aria-label="${title}">${markerShape(style, size)}${badge}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function addTreeMarkers(trees) {
  const markers = trees.map(tree => {
    const m = L.marker([tree.lat, tree.lng], { icon: _treeIcon(tree) });
    m.on('click', () => openSheet(tree));
    return m;
  });
  markers.forEach(m => _clusterGroup.addLayer(m));
}

function clearMarkers() {
  _clusterGroup.clearLayers();
}

function treeMarkerCount() {
  return _clusterGroup ? _clusterGroup.getLayers().length : 0;
}
