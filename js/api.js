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

async function apiFetchTreeMessages(code) {
  const res = await fetch(`${API_BASE}/tree/${encodeURIComponent(code)}/messages`);
  if (res.status === 404) return { messages: [] };
  if (!res.ok) throw new Error(`fetchTreeMessages HTTP ${res.status}`);
  return res.json();
}

async function apiCreateTreeMessage(code, payload) {
  const res = await fetch(`${API_BASE}/tree/${encodeURIComponent(code)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `createTreeMessage HTTP ${res.status}`);
  }
  return data;
}

async function apiCreatePublicReport(payload) {
  const res = await fetch(`${API_BASE}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `createPublicReport HTTP ${res.status}`);
  }
  return data;
}

async function apiUploadPublicReportPhoto(reportId, file) {
  const body = new FormData();
  body.append('photo', file);
  const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(reportId)}/photos`, {
    method: 'POST',
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || `uploadPublicReportPhoto HTTP ${res.status}`);
  }
  return data;
}
