/**
 * risk.js — 風險評估頁邏輯
 * 依賴：config.js（API_BASE）、auth.js（Auth）
 */

const RISK_API = API_BASE.replace('/public', '') + '/api/assessment';

// ── 狀態 ────────────────────────────────────────────────────────────────────
let _formData    = null;   // 從 API 取得的題目資料
let _tree        = null;   // 目前操作的樹木
let _assessId    = null;   // 目前評估的 ID
let _lastResult  = null;   // 最後一次 save 的評級結果
let _photoSlots  = {};     // angle → { photo_id, url }
let _activeSlot  = null;   // 目前等待上傳的 angle
let _qrStream    = null;   // 相機 MediaStream

// ── 入口 ─────────────────────────────────────────────────────────────────────
(async function init() {
  // 未登入 → 導向登入頁
  if (!Auth.isLoggedIn()) {
    window.location.href = '/login.html?next=/risk.html';
    return;
  }

  // 顯示使用者名稱
  const user = Auth.getUser();
  const el = document.getElementById('header-user');
  if (el) el.textContent = user.display_name || user.username;

  // 預先載入評估表題目
  await loadFormData();

  bindLookup();
  bindQrScanner();
})();

// ── 載入評估表題目 ─────────────────────────────────────────────────────────
async function loadFormData() {
  try {
    const res = await Auth.authFetch(`${RISK_API}/form-data`);
    if (!res || !res.ok) return;
    _formData = await res.json();
  } catch (e) {
    console.warn('無法載入評估表資料', e);
  }
}

// ── Step 1：查詢樹木 ────────────────────────────────────────────────────────
function bindLookup() {
  document.getElementById('lookup-btn').addEventListener('click', doLookup);
  document.getElementById('tree-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLookup();
  });
  document.getElementById('start-assessment-btn').addEventListener('click', startAssessment);
}

async function doLookup() {
  const raw = document.getElementById('tree-code-input').value.trim();
  const code = parseTreeCode(raw);
  showError('lookup-error', '');

  if (!code) {
    showError('lookup-error', '請輸入樹籍編號（例：JS0750021125）');
    return;
  }

  const btn = document.getElementById('lookup-btn');
  btn.textContent = '查詢中…';
  btn.disabled = true;

  try {
    const res = await Auth.authFetch(
      `${API_BASE}/tree/${encodeURIComponent(code)}`
    );
    if (!res) return;
    if (!res.ok) {
      showError('lookup-error', `找不到樹籍資料：${code}`);
      return;
    }
    const data = await res.json();
    _tree = data.tree || data;
    showTreeInfo(_tree);
  } catch (e) {
    showError('lookup-error', '查詢失敗，請確認網路連線');
  } finally {
    btn.textContent = '查詢';
    btn.disabled = false;
  }
}

function parseTreeCode(raw) {
  if (!raw) return null;
  if (raw.includes('geopkl.gov.taipei')) {
    try {
      const url = new URL(raw);
      return url.searchParams.get('treeid') || null;
    } catch { return null; }
  }
  return raw.toUpperCase();
}

function showTreeInfo(tree) {
  document.getElementById('tree-species-title').textContent =
    `🌳 ${tree.species_name || '未知樹種'}`;

  const rows = [
    ['樹籍編號', tree.registry_code],
    ['類型',     tree.tree_category === 'protected' ? '⭐ 受保護樹木' : '🟢 行道樹'],
    ['行政區',   tree.district],
    ['位置',     tree.managing_unit],
    ['樹高',     tree.height_m != null ? `${tree.height_m} m` : '—'],
    ['胸徑',     tree.dbh_cm   != null ? `${tree.dbh_cm} cm` : '—'],
  ].filter(([, v]) => v);

  document.getElementById('tree-info-table').innerHTML =
    rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');

  showStep('tree-info');
}

// ── Step 2：建立評估 ────────────────────────────────────────────────────────
async function startAssessment() {
  const btn = document.getElementById('start-assessment-btn');
  btn.textContent = '建立中…';
  btn.disabled = true;

  try {
    const res = await Auth.authFetch(`${RISK_API}/start`, {
      method: 'POST',
      body: JSON.stringify({ tree_code: _tree.registry_code }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || '無法建立評估，請重試');
      return;
    }
    _assessId = data.assessment_id;
    _photoSlots = {};
    buildAssessmentForm();
    showStep('form');
  } catch (e) {
    alert('網路錯誤，請重試');
  } finally {
    btn.textContent = '開始風險評估 →';
    btn.disabled = false;
  }
}

// ── 產生評估表單 ────────────────────────────────────────────────────────────
function buildAssessmentForm() {
  if (!_formData) {
    document.getElementById('assessment-questions').innerHTML =
      '<p style="color:#c0392b;padding:16px;">無法載入評估表，請重新整理頁面</p>';
    return;
  }

  const { items, grade_a_items, env_risk_options, section_labels, angle_labels } = _formData;

  // A 級重大危害
  const gaEl = document.getElementById('grade-a-items');
  gaEl.innerHTML = grade_a_items.map(item => `
    <div class="grade-a-item">
      <input type="checkbox" id="ga_${item.id}" name="ga_${item.id}" value="1">
      <label for="ga_${item.id}">
        ${item.label}
        <small>${item.hint}</small>
      </label>
    </div>
  `).join('');

  // 主評估題目（按 section 分組）
  const sections = {};
  items.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  let html = '';
  Object.entries(sections).forEach(([sec, secItems]) => {
    html += `<div class="card">
      <div class="section-header">${section_labels[sec] || sec}</div>`;
    secItems.forEach(item => {
      html += buildQuestionHTML(item);
    });
    html += '</div>';
  });

  document.getElementById('assessment-questions').innerHTML = html;
  bindOptionInteractions();

  // 環境風險
  const envEl = document.getElementById('env-risk-list');
  envEl.innerHTML = env_risk_options.map((opt, i) => `
    <div class="env-option${i === 1 ? ' selected' : ''}" data-value="${opt.value}" onclick="selectEnvRisk(this)">
      <div class="env-option-label">
        <input type="radio" name="env_risk" value="${opt.value}" ${i === 1 ? 'checked' : ''}> ${opt.label}
      </div>
      <div class="env-option-desc">${opt.desc}</div>
      <div class="env-option-ex">${opt.example}</div>
    </div>
  `).join('');

  // 照片格子
  buildPhotoGrid(angle_labels);

  // 按鈕
  document.getElementById('save-draft-btn').addEventListener('click', () => saveAndPreview(false));
  document.getElementById('preview-result-btn').addEventListener('click', () => saveAndPreview(true));
}

const HINT_IMG_BASE = '/images/hints/';

function optionImgHTML(img_hint) {
  if (!img_hint) return '';
  return `<img src="${HINT_IMG_BASE}${img_hint}" alt="參考圖" class="opt-img"
               loading="lazy" onerror="this.style.display='none'">`;
}

function scoreClass(score) {
  const n = Number(score) || 0;
  if (n >= -1) return 'score-ok';
  if (n >= -3) return 'score-warn';
  if (n >= -5) return 'score-alert';
  return 'score-danger';
}

function buildQuestionHTML(item) {
  let optionsHTML = '';

  if (item.type === 'radio') {
    optionsHTML = `<div class="option-list">` +
      item.options.map(opt => `
        <div class="option-item ${scoreClass(opt.value)}" onclick="selectRadio(this,'${item.key}',${opt.value},${opt.cf || false})">
          <input type="radio" name="${item.key}" value="${opt.value}" data-cf="${opt.cf ? 1 : 0}">
          <div class="opt-text">
            ${optionImgHTML(opt.img_hint)}
            <div class="opt-label">${opt.label}</div>
            ${opt.hint ? `<div class="opt-hint">${opt.hint}</div>` : ''}
          </div>
          ${opt.cf ? '<span class="cf-badge">⚠ 關鍵因子</span>' : ''}
        </div>
      `).join('') + `</div>`;

  } else if (item.type === 'checkbox') {
    optionsHTML = `<div class="option-list">` +
      `<div class="option-item score-ok" onclick="toggleNoIssue(this,'${item.key}')">
        <input type="checkbox" name="none_${item.key}" value="1" data-none-for="${item.key}">
        <div class="opt-text">
          <div class="opt-label">無上述異常</div>
          <div class="opt-hint">本題檢查項目均未發現異常</div>
        </div>
      </div>` +
      item.options.map(opt => `
        <div class="option-item ${scoreClass(opt.value)}" onclick="toggleCheckbox(this,'${opt.key}','${item.key}')">
          <input type="checkbox" name="${opt.key}" value="${opt.value}" data-cf="${opt.cf ? 1 : 0}">
          <div class="opt-text">
            ${optionImgHTML(opt.img_hint)}
            <div class="opt-label">${opt.label}</div>
            ${opt.hint ? `<div class="opt-hint">${opt.hint}</div>` : ''}
          </div>
          ${opt.cf ? '<span class="cf-badge">⚠ 關鍵因子</span>' : ''}
        </div>
      `).join('') + `</div>`;

  } else if (item.type === 'radio_plus_checkbox') {
    const ec = item.extra_checkbox;
    optionsHTML = `<div class="option-list">` +
      item.radio_options.map(opt => `
        <div class="option-item ${scoreClass(opt.value)}" onclick="selectRadio(this,'${item.key}',${opt.value},${opt.cf || false})">
          <input type="radio" name="${item.key}" value="${opt.value}" data-cf="${opt.cf ? 1 : 0}">
          <div class="opt-text">
            ${optionImgHTML(opt.img_hint)}
            <div class="opt-label">${opt.label}</div>
            ${opt.hint ? `<div class="opt-hint">${opt.hint}</div>` : ''}
          </div>
          ${opt.cf ? '<span class="cf-badge">⚠ 關鍵因子</span>' : ''}
        </div>
      `).join('') +
      `<div class="option-item ${scoreClass(ec.value)}" onclick="toggleCheckbox(this,'${ec.key}')">
        <input type="checkbox" name="${ec.key}" value="${ec.value}" data-cf="${ec.cf ? 1 : 0}">
        <div class="opt-text">
          ${optionImgHTML(ec.img_hint)}
          <div class="opt-label">${ec.label}</div>
          ${ec.hint ? `<div class="opt-hint">${ec.hint}</div>` : ''}
        </div>
        ${ec.cf ? '<span class="cf-badge">⚠ 關鍵因子</span>' : ''}
      </div>` +
      `</div>`;
  }

  return `
    <div class="question-block" data-question-key="${item.key}" data-question-no="${item.no}" data-question-type="${item.type}">
      <div class="q-title">Q${item.no}. ${item.title}</div>
      ${item.note ? `<div class="q-note">💡 ${item.note}</div>` : ''}
      ${optionsHTML}
    </div>
  `;
}

// ── 選項互動 ─────────────────────────────────────────────────────────────────
function bindOptionInteractions() {
  // 防止 label 點擊觸發兩次（已由 onclick 處理）
  document.querySelectorAll('.option-item input').forEach(inp => {
    inp.addEventListener('click', e => e.stopPropagation());
  });
}

function selectRadio(el, name, value, isCf) {
  // 清除同 name 的選取
  document.querySelectorAll(`.option-item input[name="${name}"]`).forEach(inp => {
    const parent = inp.closest('.option-item');
    parent.classList.remove('selected', 'cf-selected');
    inp.checked = false;
  });
  el.classList.add(isCf ? 'cf-selected' : 'selected');
  el.querySelector('input').checked = true;
  scrollToNextQuestion(el);
}

function toggleCheckbox(el, name, groupKey) {
  const inp = el.querySelector('input');
  inp.checked = !inp.checked;
  const isCf = inp.dataset.cf === '1';
  el.classList.toggle('selected', inp.checked && !isCf);
  el.classList.toggle('cf-selected', inp.checked && isCf);
  if (inp.checked && groupKey) {
    const none = document.querySelector(`input[name="none_${groupKey}"]`);
    if (none) {
      none.checked = false;
      none.closest('.option-item')?.classList.remove('selected', 'cf-selected');
    }
    scrollToNextQuestion(el);
  }
}

function toggleNoIssue(el, groupKey) {
  const inp = el.querySelector('input');
  inp.checked = !inp.checked;
  el.classList.toggle('selected', inp.checked);
  el.classList.remove('cf-selected');
  if (inp.checked) {
    const item = (_formData.items || []).find(q => q.key === groupKey);
    (item?.options || []).forEach(opt => {
      const optInput = document.querySelector(`input[name="${opt.key}"]`);
      const optEl = optInput?.closest('.option-item');
      if (optInput) optInput.checked = false;
      optEl?.classList.remove('selected', 'cf-selected');
    });
    scrollToNextQuestion(el);
  }
}

function scrollToNextQuestion(el) {
  const current = el.closest('.question-block');
  const blocks = Array.from(document.querySelectorAll('.question-block'));
  const next = blocks[blocks.indexOf(current) + 1];
  if (!next) return;
  setTimeout(() => next.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
}

function selectEnvRisk(el) {
  document.querySelectorAll('.env-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  el.querySelector('input').checked = true;
}

// ── 收集表單資料 ─────────────────────────────────────────────────────────────
function collectFormData() {
  const result = {};

  // A 級
  (_formData.grade_a_items || []).forEach(item => {
    const el = document.getElementById(`ga_${item.id}`);
    if (el && el.checked) result[`ga_${item.id}`] = '1';
  });

  // 主題目
  (_formData.items || []).forEach(item => {
    if (item.type === 'radio') {
      const el = document.querySelector(`input[name="${item.key}"]:checked`);
      if (el) {
        result[item.key] = el.value;
        result[`${item.key}_cf`] = el.dataset.cf || '0';
      }
    } else if (item.type === 'checkbox') {
      item.options.forEach(opt => {
        const el = document.querySelector(`input[name="${opt.key}"]`);
        if (el && el.checked) result[opt.key] = '1';
      });
    } else if (item.type === 'radio_plus_checkbox') {
      const el = document.querySelector(`input[name="${item.key}"]:checked`);
      if (el) {
        result[item.key] = el.value;
        result[`${item.key}_cf`] = el.dataset.cf || '0';
      }
      const ec = item.extra_checkbox;
      const ecEl = document.querySelector(`input[name="${ec.key}"]`);
      if (ecEl && ecEl.checked) result[ec.key] = '1';
    }
  });

  // 環境風險
  const envEl = document.querySelector('input[name="env_risk"]:checked');
  result.env_risk = envEl ? envEl.value : 'mid';

  // 備注
  const assessor = (document.getElementById('assessor-name-input')?.value || '').trim();
  const notes = document.getElementById('notes-input').value.trim();
  result.notes = [assessor ? `評估人員：${assessor}` : '', notes].filter(Boolean).join('\n\n');

  return result;
}

function isQuestionAnswered(item) {
  if (item.type === 'radio' || item.type === 'radio_plus_checkbox') {
    return !!document.querySelector(`input[name="${item.key}"]:checked`);
  }
  if (item.type === 'checkbox') {
    const hasCheckedOption = item.options.some(opt =>
      document.querySelector(`input[name="${opt.key}"]`)?.checked
    );
    const noneChecked = !!document.querySelector(`input[name="none_${item.key}"]:checked`);
    return hasCheckedOption || noneChecked;
  }
  return true;
}

function getMissingQuestions() {
  return (_formData.items || [])
    .filter(item => !isQuestionAnswered(item))
    .map(item => ({ no: item.no, title: item.title, key: item.key }));
}

function scrollToQuestion(key) {
  const block = document.querySelector(`.question-block[data-question-key="${key}"]`);
  if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hasCompleteQuestions(actionLabel) {
  const missing = getMissingQuestions();
  if (missing.length === 0) return true;

  const list = missing.slice(0, 8).map(q => `Q${q.no}. ${q.title}`).join('\n');
  const more = missing.length > 8 ? `\n...另有 ${missing.length - 8} 題` : '';
  alert(`還有 ${missing.length} 題尚未填寫，無法${actionLabel}：\n${list}${more}`);
  scrollToQuestion(missing[0].key);
  return false;
}

// ── 儲存 & 顯示結果 ──────────────────────────────────────────────────────────
async function saveAndPreview(goToResult) {
  showError('form-error', '');
  if (!hasCompleteQuestions(goToResult ? '查看評級結果' : '儲存草稿')) return;

  const btn = goToResult
    ? document.getElementById('preview-result-btn')
    : document.getElementById('save-draft-btn');
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = goToResult ? '計算中…' : '儲存中…';

  try {
    const formData = collectFormData();
    const res = await Auth.authFetch(`${RISK_API}/${_assessId}/save`, {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      showError('form-error', data.error || '儲存失敗');
      return;
    }
    _lastResult = data;
    if (goToResult) {
      showResult(data);
      showStep('result');
    } else {
      showError('form-error', '');
      document.getElementById('form-error').className = 'msg-info show';
      document.getElementById('form-error').textContent = '✅ 草稿已儲存';
      setTimeout(() => {
        document.getElementById('form-error').className = 'msg-info';
      }, 2000);
    }
  } catch (e) {
    showError('form-error', '網路錯誤，請重試');
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
}

// ── 結果頁 ───────────────────────────────────────────────────────────────────
const GRADE_COLORS = {
  A: '#8B0000', B: '#D32F2F', C: '#E65100', D: '#388E3C',
};

function showResult(data) {
  const grade = data.final_grade || 'D';
  const info  = (data.grade_info || {});
  const color = GRADE_COLORS[grade] || '#388E3C';

  const circle = document.getElementById('result-circle');
  circle.textContent = grade;
  circle.style.background = color;

  document.getElementById('result-label').textContent = info.label || `${grade} 級`;
  document.getElementById('result-desc').style.color = color;
  document.getElementById('result-desc').textContent = info.desc || '';

  // 處置措施
  const treatments = data.treatments || [];
  document.getElementById('treatment-list').innerHTML =
    treatments.map(t => `<li>${t}</li>`).join('');

  // A 級危害因子
  const hits = data.grade_a_hits || [];
  if (hits.length > 0) {
    document.getElementById('grade-a-warning').hidden = false;
    document.getElementById('grade-a-hit-list').innerHTML =
      hits.map(h => `<div>• ${h}</div>`).join('');
  } else {
    document.getElementById('grade-a-warning').hidden = true;
  }

  // 分數資訊
  document.getElementById('result-scores').textContent =
    `健康分數：${data.health_score} ／ 關鍵因子：${data.critical_count} 項`;

  // 按鈕綁定
  document.getElementById('back-to-form-btn').onclick = () => showStep('form');
  document.getElementById('new-assessment-btn').onclick = resetToLookup;
  document.getElementById('submit-btn').onclick = doSubmit;
}

async function doSubmit() {
  const pw = document.getElementById('submit-password').value;
  showError('submit-error', '');

  if (!pw) {
    showError('submit-error', '請輸入密碼');
    return;
  }
  if (!hasCompleteQuestions('送出文件')) return;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = '送出中…';

  try {
    const res = await Auth.authFetch(`${RISK_API}/${_assessId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ password: pw }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      showError('submit-error', data.error || '送出失敗');
      btn.disabled = false;
      btn.textContent = '確認送出';
      return;
    }
    // 成功
    document.getElementById('submit-form').hidden = true;
    const suc = document.getElementById('submit-success');
    suc.textContent = '✅ 評估已成功送出！';
    suc.classList.add('show');
  } catch (e) {
    showError('submit-error', '網路錯誤，請重試');
    btn.disabled = false;
    btn.textContent = '確認送出';
  }
}

// ── 照片上傳 ─────────────────────────────────────────────────────────────────
function buildPhotoGrid(angleLabels) {
  const grid = document.getElementById('photo-grid');
  grid.innerHTML = Object.entries(angleLabels).map(([angle, label]) => `
    <div class="photo-slot" id="slot-${angle}" data-angle="${angle}"
         onclick="openPhotoUpload(${angle})">
      <div class="slot-label">${label}</div>
      <button class="photo-del" onclick="deletePhoto(event,${angle})">✕</button>
    </div>
  `).join('');
}

function openPhotoUpload(angle) {
  _activeSlot = angle;
  const input = document.getElementById('photo-file-input');
  input.value = '';
  input.onchange = () => handlePhotoFile(input.files[0]);
  input.click();
}

async function handlePhotoFile(file) {
  if (!file || _activeSlot === null) return;
  const angle = _activeSlot;
  const slot = document.getElementById(`slot-${angle}`);
  slot.classList.add('photo-uploading');

  try {
    // 前端壓縮（長邊 1600px）
    const compressed = await compressImage(file, 1600, 0.82);
    const formData = new FormData();
    formData.append('photo', compressed, `photo_${angle}.jpg`);
    formData.append('angle', angle);

    const res = await Auth.authFetch(`${RISK_API}/${_assessId}/photos`, {
      method: 'POST',
      headers: {},   // 讓瀏覽器自動設 multipart boundary
      body: formData,
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok || !data.ok) {
      alert(data.error || '照片上傳失敗');
      return;
    }
    _photoSlots[angle] = { photo_id: data.photo_id, url: data.url };
    slot.innerHTML =
      `<img src="${data.url}" alt="${data.angle_label}">` +
      `<button class="photo-del" onclick="deletePhoto(event,${angle})">✕</button>`;
    slot.classList.add('has-photo');
  } catch (e) {
    alert('上傳失敗，請重試');
  } finally {
    slot.classList.remove('photo-uploading');
  }
}

async function deletePhoto(event, angle) {
  event.stopPropagation();
  const info = _photoSlots[angle];
  if (!info) return;

  if (!confirm('確定刪除這張照片？')) return;

  try {
    const res = await Auth.authFetch(
      `${RISK_API}/${_assessId}/photos/${info.photo_id}`,
      { method: 'DELETE' }
    );
    if (!res) return;
    if (res.ok) {
      delete _photoSlots[angle];
      const label = (_formData.angle_labels || {})[angle] || `角度${angle}`;
      const slot = document.getElementById(`slot-${angle}`);
      slot.classList.remove('has-photo');
      slot.innerHTML =
        `<div class="slot-label">${label}</div>` +
        `<button class="photo-del" onclick="deletePhoto(event,${angle})">✕</button>`;
    }
  } catch (e) {
    alert('刪除失敗，請重試');
  }
}

async function compressImage(file, maxSide, quality) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
          else       { w = Math.round(w * maxSide / h); h = maxSide; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── QR 掃描器 ────────────────────────────────────────────────────────────────
function bindQrScanner() {
  document.getElementById('qr-open-btn').addEventListener('click', openQr);
  document.getElementById('qr-cancel').addEventListener('click', closeQr);
}

async function openQr() {
  const wrap = document.getElementById('qr-scanner-wrap');
  const video = document.getElementById('qr-video');
  wrap.style.display = 'block';

  try {
    _qrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = _qrStream;
    requestAnimationFrame(scanQrFrame);
  } catch {
    wrap.style.display = 'none';
    alert('無法開啟相機，請使用手動輸入');
  }
}

function closeQr() {
  if (_qrStream) { _qrStream.getTracks().forEach(t => t.stop()); _qrStream = null; }
  document.getElementById('qr-scanner-wrap').style.display = 'none';
}

function scanQrFrame() {
  if (!_qrStream) return;
  const video = document.getElementById('qr-video');
  if (video.readyState !== video.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(scanQrFrame); return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const imgData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imgData.data, imgData.width, imgData.height);
  if (code && code.data) {
    closeQr();
    const parsed = parseTreeCode(code.data);
    if (parsed) {
      document.getElementById('tree-code-input').value = parsed;
      doLookup();
    }
  } else {
    requestAnimationFrame(scanQrFrame);
  }
}

// ── 步驟切換 ─────────────────────────────────────────────────────────────────
function showStep(name) {
  const steps = ['lookup', 'tree-info', 'form', 'result'];
  steps.forEach(s => {
    document.getElementById(`step-${s}`).hidden = (s !== name);
  });
  // 步驟指示
  const barMap = { lookup: 1, 'tree-info': 1, form: 2, result: 3 };
  const active = barMap[name] || 1;
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(`sbar-${n}`);
    el.className = n < active ? 'done' : n === active ? 'active' : '';
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToLookup() {
  _tree = null; _assessId = null; _lastResult = null; _photoSlots = {};
  document.getElementById('tree-code-input').value = '';
  showStep('lookup');
}

// ── PDF 匯出 ─────────────────────────────────────────────────────────────────
async function exportPDF() {
  if (!_assessId || !_lastResult) return;
  if (!hasCompleteQuestions('下載 PDF')) return;

  const btn = document.getElementById('pdf-btn');
  if (btn) { btn.disabled = true; btn.textContent = '產生中…'; }

  try {
    // 動態載入 jsPDF，並內嵌繁中文字型避免中文亂碼。
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await loadPdfCjkFont(doc);
    const pageW = 210, margin = 14, contentW = pageW - margin * 2;
    let y = 18;

    // ── 標題 ──
    const grade = _lastResult.final_grade || 'D';
    const gradeInfo = _lastResult.grade_info || {};
    const gradeColor = { A:[139,0,0], B:[211,47,47], C:[230,81,0], D:[56,142,60] }[grade] || [56,142,60];

    doc.setFillColor(26, 92, 42);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont(PDF_CJK_FONT_NAME, 'bold');
    doc.text('Tree Risk Assessment Report', margin, 10);
    doc.setFontSize(9); doc.setFont(PDF_CJK_FONT_NAME, 'normal');
    doc.text('台北市樹木風險評估報告  taipei-trees.org', margin, 17);
    doc.setTextColor(0, 0, 0);
    y = 32;

    // ── 樹木基本資料 ──
    if (_tree) {
      doc.setFontSize(11); doc.setFont(PDF_CJK_FONT_NAME, 'bold');
      doc.text('樹木基本資料', margin, y); y += 7;
      doc.setFontSize(9); doc.setFont(PDF_CJK_FONT_NAME, 'normal');
      const treeRows = [
        ['樹籍編號', _tree.registry_code || '—'],
        ['樹種',     _tree.species_name || '—'],
        ['行政區',   _tree.district || '—'],
        ['位置',     _tree.managing_unit || '—'],
        ['樹高',     _tree.height_m != null ? `${_tree.height_m} m` : '—'],
        ['胸徑',     _tree.dbh_cm   != null ? `${_tree.dbh_cm} cm` : '—'],
      ];
      treeRows.forEach(([k, v]) => {
        doc.setFont(PDF_CJK_FONT_NAME, 'bold'); doc.text(k + '：', margin, y);
        doc.setFont(PDF_CJK_FONT_NAME, 'normal'); doc.text(v, margin + 22, y);
        y += 5.5;
      });
      y += 4;
    }

    // ── 評級結果 ──
    doc.setFillColor(...gradeColor);
    doc.roundedRect(margin, y, contentW, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28); doc.setFont(PDF_CJK_FONT_NAME, 'bold');
    doc.text(grade, margin + 8, y + 16);
    doc.setFontSize(13);
    doc.text(gradeInfo.label || `${grade} 級`, margin + 22, y + 10);
    doc.setFontSize(9); doc.setFont(PDF_CJK_FONT_NAME, 'normal');
    doc.text(gradeInfo.desc || '', margin + 22, y + 18);
    doc.setTextColor(0, 0, 0);
    y += 28;

    // 分數
    doc.setFontSize(8); doc.setTextColor(100, 100, 100);
    doc.text(
      `健康分數：${_lastResult.health_score}  ／  關鍵因子：${_lastResult.critical_count} 項  ／  評估 ID：${_assessId}`,
      margin, y
    );
    doc.setTextColor(0, 0, 0);
    y += 7;

    // ── A 級危害 ──
    const hits = _lastResult.grade_a_hits || [];
    if (hits.length > 0) {
      doc.setFillColor(255, 243, 205);
      doc.rect(margin, y, contentW, 6 + hits.length * 5.5, 'F');
      doc.setFontSize(9); doc.setFont(PDF_CJK_FONT_NAME, 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('⚠ A 級重大危害因子', margin + 3, y + 5);
      y += 8;
      doc.setFont(PDF_CJK_FONT_NAME, 'normal');
      hits.forEach(h => {
        doc.text(`• ${h}`, margin + 5, y); y += 5.5;
      });
      doc.setTextColor(0, 0, 0);
      y += 3;
    }

    // ── 建議處置 ──
    const treatments = _lastResult.treatments || [];
    if (treatments.length > 0) {
      doc.setFontSize(11); doc.setFont(PDF_CJK_FONT_NAME, 'bold');
      doc.text('建議處置措施', margin, y); y += 7;
      doc.setFontSize(9); doc.setFont(PDF_CJK_FONT_NAME, 'normal');
      treatments.forEach(t => {
        doc.text(`▶  ${t}`, margin + 3, y); y += 5.5;
      });
      y += 4;
    }

    // ── 頁尾 ──
    const now = new Date().toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' });
    doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
    doc.text(`評估日期：${now}   ／   台北市樹木查詢平台  taipei-trees.org`, margin, 290);

    // ── 儲存 ──
    const treeCode = _tree?.registry_code || 'unknown';
    doc.save(`樹木風險評估_${treeCode}_${now.replace(/\//g,'-')}.pdf`);

  } catch (e) {
    console.error('PDF 產生失敗', e);
    alert('PDF 產生失敗，請重試');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📄 下載 PDF 報告'; }
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 分享連結 ─────────────────────────────────────────────────────────────────
function shareReport() {
  const url = `${location.origin}/risk-report.html?id=${_assessId}`;
  if (navigator.share) {
    navigator.share({ title: '樹木風險評估報告', url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = document.getElementById('share-btn');
      if (btn) { const orig = btn.textContent; btn.textContent = '✅ 已複製！'; setTimeout(() => btn.textContent = orig, 2000); }
    });
  }
}

// ── 工具 ─────────────────────────────────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = msg ? 'msg-error show' : 'msg-error';
}
