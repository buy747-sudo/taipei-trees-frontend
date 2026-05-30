async function apiFetchTrees(params = {}) {
  const url = new URL(`${API_BASE}/trees`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchTrees HTTP ${res.status}`);
  return res.json();  // { trees: [...], total: int }
}

async function apiFetchTree(code) {
  const res = await fetch(`${API_BASE}/tree/${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetchTree HTTP ${res.status}`);
  return res.json();  // { tree: {...} }
}

async function apiFetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`fetchStats HTTP ${res.status}`);
  return res.json();
}
