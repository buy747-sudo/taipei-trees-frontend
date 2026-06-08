/**
 * survey.js — 台北市行道樹普查七段 wizard
 * 依賴：config.js (API_BASE), auth.js (Auth)
 */

// ── 照片方向表（台北市附件四） ──────────────────────────────────────────────
const PHOTO_DIRS = {
  ns_east:  ['east',  'north'],
  ns_west:  ['west',  'north'],
  ns_island:['east',  'west'],
  ew_north: ['north', 'east'],
  ew_south: ['south', 'east'],
  ew_island:['north', 'south'],
  park:     ['east',  'north'],
};
const DIR_LABEL = { east: '朝正東', west: '朝正西', south: '朝正南', north: '朝正北' };
const DIR_ICON  = { east: '→', west: '←', south: '↓', north: '↑' };

const SURVEY_API = API_BASE.replace('/public', '') + '/api/survey';

// ── state ────────────────────────────────────────────────────────────────────
let currentStep = 0;
let treeData = null;        // from /public/tree/<code>
let surveyId = null;        // set after first draft save
let photoFiles = {};        // direction -> File
let stepGOriginalHTML = ''; // G 段原始 HTML，用於重置

// ── init ─────────────────────────────────────────────────────────────────────
(function init() {
  const user = Auth.getUser();
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent(location.pathname);
    return;
  }
  const role = user?.role || '';
  if (!['platform_admin','contractor_admin','inspector','surveyor'].includes(role)) {
    document.querySelector('.sv-body').innerHTML =
      '<div class="card"><p style="color:#c00;font-weight:700;">您的帳號沒有普查權限。請聯絡管理員。</p></div>';
    return;
  }
  document.getElementById('huser').textContent = user.display_name || user.username || '';

  // 儲存 G 段原始 HTML，供重置時還原
  stepGOriginalHTML = document.querySelector('[data-step="6"]').innerHTML;

  // pre-fill today's date
  document.getElementById('survey-date').value = new Date().toISOString().slice(0, 10);

  // URL param: ?code=XXX
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) {
    document.getElementById('code-input').value = urlCode;
    lookupTree(urlCode);
  }

  bindEvents();
  populateSpeciesDatalist();
  goStep(0);
})();

// ── event binding ─────────────────────────────────────────────────────────────
function bindEvents() {
  // QR
  document.getElementById('qr-btn').addEventListener('click', startQR);

  // manual code search
  document.getElementById('code-search-btn').addEventListener('click', () => {
    lookupTree(document.getElementById('code-input').value.trim());
  });
  document.getElementById('code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupTree(e.target.value.trim());
  });

  // step A next
  document.getElementById('step-a-next').addEventListener('click', () => goStep(1));

  // prev/next buttons by data-go
  document.querySelectorAll('[data-go]').forEach(btn => {
    btn.addEventListener('click', () => goStep(parseInt(btn.dataset.go)));
  });

  // species name -> auto-fill code + origin
  document.getElementById('species-name').addEventListener('change', onSpeciesChange);

  // GPS
  document.getElementById('gps-refresh-btn').addEventListener('click', requestGPS);

  // DBH auto-calc circumference
  ['dbh1','dbh2','dbh3','dbh4','dbh5','dbh6'].forEach(id => {
    document.getElementById(id).addEventListener('input', calcCircumference);
  });
  document.getElementById('dbh-1m').addEventListener('input', () => {
    const v = parseFloat(document.getElementById('dbh-1m').value);
    document.getElementById('circ-1m').value = v ? (v * Math.PI).toFixed(1) : '';
  });

  // tree_status 聯動：危木 → 備註必填提示；死亡缺株 → 跳段提示
  document.querySelectorAll('[name=tree_status]').forEach(r => {
    r.addEventListener('change', onTreeStatusChange);
  });

  // is_street_tree toggle park-name
  document.querySelectorAll('[name=is_street_tree]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('park-name-row').hidden = r.value !== 'N';
    });
  });

  // road direction -> photo slots
  document.getElementById('road-direction').addEventListener('change', buildPhotoSlots);

  // submit / draft
  document.getElementById('submit-btn').addEventListener('click', () => submitSurvey('submitted'));
  document.getElementById('draft-btn').addEventListener('click', () => submitSurvey('draft'));
}

// ── step navigation ──────────────────────────────────────────────────────────
function goStep(n) {
  document.querySelectorAll('[data-step]').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-step="${n}"]`).classList.add('active');

  document.querySelectorAll('#step-bar span').forEach(sp => {
    const s = parseInt(sp.dataset.s);
    sp.classList.toggle('active', s === n);
    sp.classList.toggle('done', s < n);
  });

  currentStep = n;

  // side effects on entering steps
  if (n === 2) requestGPS();
  if (n === 6) buildPhotoSlots();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── tree lookup ──────────────────────────────────────────────────────────────
async function lookupTree(code) {
  if (!code) return;
  const errEl = document.getElementById('step-a-error');
  errEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/tree/${encodeURIComponent(code)}`);
    if (!res.ok) {
      errEl.textContent = `找不到樹籍編碼「${code}」，請確認後重試。`;
      errEl.style.display = 'block';
      document.getElementById('tree-found-card').hidden = true;
      return;
    }
    const data = await res.json();
    treeData = data.tree;
    showTreeInfo(treeData);
    document.getElementById('tree-found-card').hidden = false;
    // pre-fill species
    if (treeData.species_name) {
      document.getElementById('species-name').value = treeData.species_name;
    }
  } catch (e) {
    errEl.textContent = '網路錯誤，請稍後再試。';
    errEl.style.display = 'block';
  }
}

function showTreeInfo(tree) {
  document.getElementById('ti-species').textContent =
    (tree.species_name || '（未知樹種）') + '　' + tree.registry_code;
  document.getElementById('ti-meta').textContent =
    [tree.district, tree.managing_unit].filter(Boolean).join('　');
}

// ── QR scanner ───────────────────────────────────────────────────────────────
let qrStream = null;
let qrTimer = null;

async function startQR() {
  const wrap = document.getElementById('qr-scanner-wrap');
  const video = document.getElementById('qr-video');
  if (!wrap.hidden) { stopQR(); return; }
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = qrStream;
    video.play();
    wrap.hidden = false;
    scanQRFrame(video);
  } catch {
    showToast('無法開啟相機，請確認權限後重試');
  }
}

function stopQR() {
  if (qrTimer) { cancelAnimationFrame(qrTimer); qrTimer = null; }
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  document.getElementById('qr-scanner-wrap').hidden = true;
}

function scanQRFrame(video) {
  if (!video.videoWidth) { qrTimer = requestAnimationFrame(() => scanQRFrame(video)); return; }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, canvas.width, canvas.height);
  if (code && code.data) {
    stopQR();
    const raw = code.data.trim();
    // extract registry_code from URL or raw string
    const match = raw.match(/(?:code=|\/tree\/)([A-Za-z0-9]+)/);
    const extracted = match ? match[1] : raw;
    document.getElementById('code-input').value = extracted;
    lookupTree(extracted);
    showToast(`掃到：${extracted}`);
    return;
  }
  qrTimer = requestAnimationFrame(() => scanQRFrame(video));
}

// ── GPS ──────────────────────────────────────────────────────────────────────
function requestGPS() {
  const badge = document.getElementById('gps-badge');
  badge.className = 'gps-badge';
  badge.textContent = '⏳ 定位中…';
  if (!navigator.geolocation) {
    badge.className = 'gps-badge gps-err';
    badge.textContent = '❌ 不支援 GPS';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const acc = pos.coords.accuracy;
      document.getElementById('gps-phone-lat').value = lat;
      document.getElementById('gps-phone-lng').value = lng;

      if (acc < 5) {
        badge.className = 'gps-badge gps-ok';
        badge.textContent = `✅ 精度 ${acc.toFixed(1)}m`;
      } else if (acc < 15) {
        badge.className = 'gps-badge gps-warn';
        badge.textContent = `⚠️ 精度 ${acc.toFixed(1)}m（偏低）`;
      } else {
        badge.className = 'gps-badge gps-err';
        badge.textContent = `❌ 精度 ${acc.toFixed(1)}m（需儀器）`;
      }

      // compare with tree's stored position
      if (treeData && treeData.lat && treeData.lng) {
        const dist = haversineM(
          parseFloat(lat), parseFloat(lng),
          treeData.lat, treeData.lng
        );
        const hint = document.getElementById('gps-dist-hint');
        const style = dist < 5 ? 'gps-ok' : dist < 15 ? 'gps-warn' : 'gps-err';
        const emoji = dist < 5 ? '✅' : dist < 15 ? '⚠️' : '❌';
        hint.className = `gps-badge ${style}`;
        hint.style.display = 'inline-flex';
        hint.textContent = `${emoji} 與資料庫距離 ${dist.toFixed(1)}m`;
      }
    },
    err => {
      badge.className = 'gps-badge gps-err';
      badge.textContent = '❌ 定位失敗：' + (err.message || err.code);
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── species datalist ─────────────────────────────────────────────────────────────
function populateSpeciesDatalist() {
  const dl = document.getElementById('species-list');
  if (!dl || typeof getSpeciesNames !== 'function') return;
  getSpeciesNames().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    const info = getSpeciesInfo(name);
    if (info) opt.label = `${name}（${info.origin}，編碼 ${info.code}）`;
    dl.appendChild(opt);
  });
}

function onSpeciesChange() {
  const name = document.getElementById('species-name').value.trim();
  if (!name || typeof getSpeciesInfo !== 'function') return;
  const info = getSpeciesInfo(name);
  if (!info) return;
  if (info.code) document.getElementById('species-code').value = info.code;
  // auto-select origin radio
  if (info.origin) {
    const radio = document.querySelector(`[name=origin][value="${info.origin}"]`);
    if (radio) radio.checked = true;
  }
}

// ── tree_status 聯動 ──────────────────────────────────────────────────────────
function onTreeStatusChange() {
  const val = radio('tree_status');
  const hint = document.getElementById('tree-status-hint');
  if (val === '危木') {
    hint.style.display = 'block';
    hint.style.background = '#fff3cd';
    hint.style.color = '#92400e';
    hint.style.border = '1px solid #f59e0b';
    hint.textContent = '⚠️ 危木：步驟 F 的備註欄位必填，請詳細描述危害情形。';
  } else if (val === '死亡缺株') {
    hint.style.display = 'block';
    hint.style.background = '#f5f5f5';
    hint.style.color = '#555';
    hint.style.border = '1px solid #ccc';
    hint.textContent = '📋 死亡缺株：量測（D段）、樹穴（E段）與照片（G段）可免填，直接跳至特殊資訊（F段）後送出。';
  } else {
    hint.style.display = 'none';
  }
}

// ── DBH auto-calc ─────────────────────────────────────────────────────────────
function calcCircumference() {
  const vals = ['dbh1','dbh2','dbh3','dbh4','dbh5','dbh6']
    .map(id => parseFloat(document.getElementById(id).value) || 0)
    .filter(v => v > 0);
  if (!vals.length) { document.getElementById('circumference').value = ''; return; }
  // 叢生多株：DBH = sqrt(DBH1²+DBH2²+...)
  const effective = vals.length === 1
    ? vals[0]
    : Math.sqrt(vals.reduce((s, v) => s + v*v, 0));
  document.getElementById('circumference').value = (effective * Math.PI).toFixed(1);
}

// ── photo slots ───────────────────────────────────────────────────────────────
function buildPhotoSlots() {
  const dir = document.getElementById('road-direction').value;
  const wrap = document.getElementById('photo-slots-wrap');
  const hint = document.getElementById('photo-direction-hint');
  wrap.innerHTML = '';

  if (!dir) {
    hint.textContent = '📍 請先選擇道路方向，系統將自動決定拍攝角度';
    return;
  }

  const dirs = PHOTO_DIRS[dir] || ['east', 'north'];
  hint.textContent = `拍攝方向：${dirs.map(d => DIR_LABEL[d]).join('、')}（台北市附件四規範）`;

  dirs.forEach(d => {
    const slot = document.createElement('div');
    slot.className = 'photo-slot';
    slot.dataset.direction = d;
    slot.innerHTML = `
      <div class="slot-dir">${DIR_ICON[d]} ${DIR_LABEL[d]}</div>
      <div class="slot-hint">點此拍照或選取圖片</div>
      <img alt="${DIR_LABEL[d]}" id="thumb-${d}">
      <button class="del-btn" data-dir="${d}" onclick="removePhoto(event,'${d}')">✕</button>
      <input type="file" accept="image/*" capture="environment" data-dir="${d}" onchange="onPhotoChange(event,'${d}')">
    `;
    // restore existing photo preview
    if (photoFiles[d]) {
      slot.classList.add('has-photo');
      const thumb = slot.querySelector('img');
      thumb.src = URL.createObjectURL(photoFiles[d]);
    }
    wrap.appendChild(slot);
  });
}

function onPhotoChange(event, dir) {
  const file = event.target.files[0];
  if (!file) return;
  photoFiles[dir] = file;
  const slot = event.target.closest('.photo-slot');
  slot.classList.add('has-photo');
  const thumb = document.getElementById(`thumb-${dir}`);
  thumb.src = URL.createObjectURL(file);
  slot.querySelector('.slot-hint').textContent = file.name;
}

function removePhoto(event, dir) {
  event.stopPropagation();
  event.preventDefault();
  delete photoFiles[dir];
  const slot = event.target.closest('.photo-slot');
  slot.classList.remove('has-photo');
  document.getElementById(`thumb-${dir}`).src = '';
  slot.querySelector('.slot-hint').textContent = '點此拍照或選取圖片';
  slot.querySelector('input[type=file]').value = '';
}

// ── collect form data ─────────────────────────────────────────────────────────
function radio(name) {
  const el = document.querySelector(`[name=${name}]:checked`);
  return el ? el.value : null;
}
function num(id) {
  const v = parseFloat(document.getElementById(id).value);
  return isNaN(v) ? null : v;
}
function txt(id) {
  return document.getElementById(id).value.trim() || null;
}

function collectFormData(status) {
  return {
    survey_id: surveyId || undefined,
    tree_registry_code: treeData ? treeData.registry_code : txt('code-input'),
    survey_date: txt('survey-date'),
    status,

    code_status: parseInt(radio('code_status') ?? '0'),
    tree_status: radio('tree_status'),
    species_name: txt('species-name'),
    species_code: num('species-code'),
    origin: radio('origin') || null,
    land_use: radio('land_use') || null,

    gps_phone_lat: num('gps-phone-lat'),
    gps_phone_lng: num('gps-phone-lng'),
    gps_instrument_lat: num('gps-instr-lat'),
    gps_instrument_lng: num('gps-instr-lng'),
    twd97_x: num('twd97-x'),
    twd97_y: num('twd97-y'),

    ht_dbh: num('ht-dbh') || 130,
    dbh1: num('dbh1'), dbh2: num('dbh2'), dbh3: num('dbh3'),
    dbh4: num('dbh4'), dbh5: num('dbh5'), dbh6: num('dbh6'),
    circumference: num('circumference'),
    dbh_1m: num('dbh-1m'),
    circ_1m: num('circ-1m'),

    height_m: num('height-m'),
    live_top: num('live-top'),
    crown_base: num('crown-base'),
    crown_ew: num('crown-ew'),
    crown_ns: num('crown-ns'),
    dieback: num('dieback'),
    canopy_missing: num('canopy-missing'),

    pit_type: radio('pit_type') || null,
    pit_form: radio('pit_form') || null,
    pit_fence: parseInt(radio('pit_fence') ?? '0'),
    pit_length: num('pit-length'),
    pit_width: num('pit-width'),
    pit_facilities: txt('pit-facilities'),
    pit_cover: txt('pit-cover'),
    pit_pole: parseInt(radio('pit_pole') ?? '0'),

    is_street_tree: radio('is_street_tree') || 'S',
    park_name: txt('park-name'),
    protected_tree: parseInt(radio('protected_tree') ?? '0'),
    notes: txt('notes'),
  };
}

// ── submit ────────────────────────────────────────────────────────────────────
async function submitSurvey(status) {
  const errEl = document.getElementById('step-g-error');
  const infoEl = document.getElementById('step-g-info');
  errEl.style.display = 'none';
  infoEl.style.display = 'none';

  const data = collectFormData(status);
  if (!data.tree_registry_code) {
    errEl.textContent = '缺少樹籍編碼，請回到步驟A選取樹木。';
    errEl.style.display = 'block'; return;
  }
  if (!data.survey_date) {
    errEl.textContent = '請填寫普查日期。';
    errEl.style.display = 'block'; return;
  }
  if (status === 'submitted' && data.tree_status === '危木' && !data.notes) {
    errEl.textContent = '⚠️ 危木必須填寫備註（步驟F），請說明危害情形。';
    errEl.style.display = 'block'; return;
  }
  if (status === 'submitted' && data.tree_status !== '死亡缺株' && !data.dbh1) {
    errEl.textContent = '送出前請填寫 DBH1（步驟D）。';
    errEl.style.display = 'block'; return;
  }

  const submitBtn = document.getElementById('submit-btn');
  const draftBtn = document.getElementById('draft-btn');
  submitBtn.disabled = true;
  draftBtn.disabled = true;
  submitBtn.textContent = '送出中…';

  try {
    const res = await Auth.authFetch(`${SURVEY_API}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res) return; // 401 handled by authFetch

    const json = await res.json();
    if (!res.ok) {
      errEl.textContent = json.error || `送出失敗（${res.status}）`;
      errEl.style.display = 'block'; return;
    }

    surveyId = json.survey_id;

    // upload photos
    const dirs = Object.keys(photoFiles);
    let photoErrors = [];
    for (const dir of dirs) {
      const ok = await uploadPhoto(surveyId, dir, photoFiles[dir]);
      if (!ok) photoErrors.push(DIR_LABEL[dir]);
    }

    if (status === 'submitted') {
      showToast('普查送出成功 🎉');
      showSuccessSummary(json.survey_id, data, Object.keys(photoFiles).length, photoErrors);
    } else {
      infoEl.textContent = '💾 草稿已儲存（#' + surveyId + '）' + (photoErrors.length ? `（照片上傳失敗：${photoErrors.join('、')}）` : '');
      infoEl.style.display = 'block';
    }

  } catch (e) {
    errEl.textContent = '網路錯誤：' + e.message;
    errEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    draftBtn.disabled = false;
    submitBtn.textContent = '✅ 送出普查';
  }
}

async function uploadPhoto(id, dir, file) {
  try {
    const form = new FormData();
    form.append('photo', file);
    form.append('direction', dir);
    form.append('angle_label', DIR_LABEL[dir]);
    const res = await Auth.authFetch(`${SURVEY_API}/${id}/photos`, {
      method: 'POST',
      // 不傳 Content-Type，讓 authFetch 偵測到 FormData 後自動刪除，
      // 瀏覽器才能正確填入 multipart/form-data 的 boundary。
      body: form,
    });
    return res && res.ok;
  } catch { return false; }
}

// ── 送出成功摘要 ──────────────────────────────────────────────────────────────
function showSuccessSummary(sid, data, photoCount, photoErrors) {
  const step = document.querySelector('[data-step="6"]');
  if (!step) return;

  const treeLabel = treeData
    ? `${treeData.species_name || '（未知樹種）'}　${treeData.registry_code}`
    : data.tree_registry_code;

  const location = treeData
    ? [treeData.district, treeData.managing_unit].filter(Boolean).join('　')
    : '—';

  const dbhDisplay = data.dbh1
    ? `${data.dbh1} cm${data.dbh2 ? ` / ${data.dbh2}` : ''}${data.dbh3 ? ` / ${data.dbh3}` : ''}`
    : '—（死亡缺株）';

  const photoNote = photoErrors.length
    ? `<span style="color:#c00;">⚠️ 照片上傳失敗：${photoErrors.join('、')}</span>`
    : `✅ 照片 ${photoCount} 張`;

  step.innerHTML = `
    <div class="card" style="text-align:center;padding:28px 20px;">
      <div style="font-size:3rem;margin-bottom:12px;">🎉</div>
      <div style="font-size:1.1rem;font-weight:700;color:#1a5c2a;margin-bottom:4px;">普查已成功送出</div>
      <div style="font-size:0.82rem;color:#888;margin-bottom:20px;">普查編號 #${sid}</div>
    </div>

    <div class="card">
      <div class="card-title">📋 本次普查摘要</div>
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <tbody>
          <tr><td style="padding:7px 4px;color:#888;width:90px;">樹木</td>
              <td style="padding:7px 4px;font-weight:600;">${treeLabel}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:7px 4px;color:#888;">位置</td>
              <td style="padding:7px 4px;">${location}</td></tr>
          <tr><td style="padding:7px 4px;color:#888;">普查日期</td>
              <td style="padding:7px 4px;">${data.survey_date || '—'}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:7px 4px;color:#888;">生長狀況</td>
              <td style="padding:7px 4px;">${data.tree_status || '—'}</td></tr>
          <tr><td style="padding:7px 4px;color:#888;">樹種</td>
              <td style="padding:7px 4px;">${data.species_name || '—'}</td></tr>
          <tr style="background:#f9f9f9;"><td style="padding:7px 4px;color:#888;">DBH</td>
              <td style="padding:7px 4px;">${dbhDisplay}</td></tr>
          <tr><td style="padding:7px 4px;color:#888;">照片</td>
              <td style="padding:7px 4px;">${photoNote}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn-next" onclick="resetSurvey()" style="width:100%;padding:14px;">
        🌳 繼續普查下一棵
      </button>
      <a href="/survey-list.html" style="display:block;text-align:center;padding:13px;font-size:0.95rem;
         font-weight:600;color:#1a5c2a;border:1.5px solid #1a5c2a;border-radius:10px;
         text-decoration:none;">
        📋 查看所有普查紀錄
      </a>
      <a href="/" style="display:block;text-align:center;padding:11px;font-size:0.88rem;
         color:#888;text-decoration:none;">
        ← 回到地圖
      </a>
    </div>
  `;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 重置普查（繼續下一棵）────────────────────────────────────────────────────
function resetSurvey() {
  // 清除所有 state
  treeData = null;
  surveyId = null;
  photoFiles = {};

  // 清除表單輸入
  document.querySelectorAll('input[type=text], input[type=number], textarea').forEach(el => {
    el.value = '';
  });
  document.querySelectorAll('input[type=radio]').forEach(el => { el.checked = false; });
  document.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });

  // 重設預設值
  document.getElementById('survey-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('ht-dbh').value = '130';
  document.querySelector('[name=is_street_tree][value="S"]').checked = true;
  document.querySelector('[name=pit_fence][value="0"]').checked = true;
  document.querySelector('[name=pit_pole][value="0"]').checked = true;
  document.querySelector('[name=protected_tree][value="0"]').checked = true;

  // 還原 G 段原始 HTML 並重新綁定事件
  const stepG = document.querySelector('[data-step="6"]');
  stepG.innerHTML = stepGOriginalHTML;
  document.getElementById('road-direction').addEventListener('change', buildPhotoSlots);
  document.getElementById('submit-btn').addEventListener('click', () => submitSurvey('submitted'));
  document.getElementById('draft-btn').addEventListener('click', () => submitSurvey('draft'));

  // 隱藏步驟A的殘留狀態
  document.getElementById('tree-found-card').hidden = true;
  document.getElementById('step-a-error').style.display = 'none';
  document.getElementById('tree-status-hint').style.display = 'none';
  document.getElementById('code-input').value = '';
  document.getElementById('park-name-row').hidden = true;
  document.getElementById('gps-dist-hint').style.display = 'none';

  goStep(0);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, dur = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), dur);
}
