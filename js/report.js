const REPORT_PHOTO_LIMIT = 3;
const REPORT_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const REPORT_ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const reportState = {
  lat: '',
  lng: '',
  tree: {
    code: '',
    category: '',
    species: '',
    district: '',
    managingUnit: '',
  },
};

function readReportParams() {
  const params = new URLSearchParams(location.search);
  reportState.tree.code = params.get('tree_code') || params.get('code') || '';
  reportState.tree.category = params.get('tree_category') || '';
  reportState.tree.species = params.get('species_name') || '';
  reportState.tree.district = params.get('district') || '';
  reportState.tree.managingUnit = params.get('managing_unit') || '';
  reportState.lat = params.get('lat') || '';
  reportState.lng = params.get('lng') || '';
}

function renderReportContext() {
  const title = document.getElementById('context-title');
  const summary = document.getElementById('context-summary');
  const locationInput = document.getElementById('location-text');
  const tree = reportState.tree;

  if (!tree.code) {
    title.textContent = '尚未指定樹木';
    summary.textContent = '可從地圖或樹木詳情頁進入通報；也可以直接描述位置。';
    return;
  }

  const name = tree.species || '這棵樹';
  title.textContent = `${name}｜${tree.code}`;
  const place = [tree.district, tree.managingUnit].filter(Boolean).join('，');
  summary.textContent = place
    ? `系統會一併帶入樹籍編號與位置：${place}。`
    : '系統會一併帶入樹籍編號。';
  if (place && !locationInput.value) locationInput.value = place;
}

function getSelectedIssueType() {
  return document.querySelector('input[name="issue_type"]:checked')?.value || '';
}

function getSelectedPhotos() {
  return Array.from(document.getElementById('photos').files || []);
}

function getReportPayload() {
  const tree = reportState.tree;
  return {
    tree_code: tree.code,
    tree_category: tree.category || (tree.code ? 'street' : 'unknown'),
    species_name: tree.species,
    district: tree.district,
    managing_unit: tree.managingUnit,
    source: tree.code ? 'tree_detail' : 'home_entry',
    issue_type: getSelectedIssueType(),
    urgency: document.getElementById('urgency').value,
    description: document.getElementById('description').value.trim(),
    location_text: document.getElementById('location-text').value.trim(),
    contact_info: document.getElementById('contact-info').value.trim(),
    lat: reportState.lat,
    lng: reportState.lng,
    website: document.getElementById('website').value,
  };
}

function validateReport(payload, photos) {
  if (!payload.issue_type) return '請選擇問題類型';
  if (payload.description.length < 10) return '問題描述需至少 10 個字';
  if (!payload.tree_code && !payload.location_text && (!payload.lat || !payload.lng)) {
    return '請提供位置描述、使用目前位置，或先從地圖選擇一棵樹';
  }
  if (photos.length > REPORT_PHOTO_LIMIT) return '照片最多 3 張';
  const invalidType = photos.find(file => !REPORT_ALLOWED_PHOTO_TYPES.has(file.type));
  if (invalidType) return `「${invalidType.name}」不是支援的圖片格式，請使用 JPG、PNG 或 WebP`;
  const oversized = photos.find(file => file.size > REPORT_PHOTO_MAX_BYTES);
  if (oversized) return `「${oversized.name}」超過 8MB，請改用較小的照片`;
  return '';
}

function renderPhotoPreview() {
  const preview = document.getElementById('photo-preview');
  const photos = getSelectedPhotos();
  if (!photos.length) {
    preview.innerHTML = '';
    return;
  }

  preview.innerHTML = '';
  photos.slice(0, REPORT_PHOTO_LIMIT).forEach((file, index) => {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const item = document.createElement('div');
    item.className = 'photo-preview-item';
    const number = document.createElement('span');
    number.textContent = String(index + 1);
    const name = document.createElement('strong');
    name.textContent = file.name;
    const size = document.createElement('small');
    size.textContent = `${sizeMb} MB`;
    item.append(number, name, size);
    preview.appendChild(item);
  });
  if (photos.length > REPORT_PHOTO_LIMIT) {
    const warning = document.createElement('div');
    warning.className = 'photo-preview-warning';
    warning.textContent = '照片最多 3 張，請移除多餘照片後再送出。';
    preview.appendChild(warning);
  }
}

function setSubmitting(isSubmitting) {
  const button = document.getElementById('report-submit');
  button.disabled = isSubmitting;
  button.textContent = isSubmitting ? '送出中...' : '送出通報';
}

function showReportSuccess(data, photoResults) {
  const form = document.getElementById('report-form');
  const reportNo = data.report_no || data.report_id || '已建立';
  const photoOk = photoResults.filter(item => item.ok).length;
  const photoFail = photoResults.length - photoOk;
  const photoText = photoResults.length
    ? `照片 ${photoOk} 張已上傳${photoFail ? `，${photoFail} 張未成功` : ''}。`
    : '未附照片。';

  form.innerHTML = '';
  const section = document.createElement('section');
  section.className = 'report-section success-section';
  const kicker = document.createElement('p');
  kicker.className = 'section-kicker';
  kicker.textContent = '通報已送出';
  const title = document.createElement('h2');
  title.textContent = `案件編號 ${reportNo}`;
  const message = document.createElement('p');
  message.textContent = data.message || '已收到您的通報。若為緊急事項，請立即聯絡 1999。';
  const photo = document.createElement('p');
  photo.textContent = photoText;
  const note = document.createElement('p');
  note.textContent = '本站僅接受通報，不保證個案回覆或處理時程。';
  section.append(kicker, title, message, photo, note);

  const actions = document.createElement('div');
  actions.className = 'report-actions';
  const back = document.createElement('a');
  back.className = 'report-secondary';
  back.href = '/';
  back.textContent = '回到地圖';
  const again = document.createElement('a');
  again.className = 'report-primary as-link';
  again.href = '/report.html';
  again.textContent = '再通報一件';
  actions.append(back, again);
  form.append(section, actions);
}

async function uploadReportPhotos(reportId, photos) {
  const results = [];
  for (const file of photos) {
    try {
      await apiUploadPublicReportPhoto(reportId, file);
      results.push({ ok: true, file });
    } catch (error) {
      results.push({ ok: false, file, error });
    }
  }
  return results;
}

async function submitReport(event) {
  event.preventDefault();
  const errorEl = document.getElementById('report-error');
  const payload = getReportPayload();
  const photos = getSelectedPhotos();
  const error = validateReport(payload, photos);
  if (error) {
    errorEl.textContent = error;
    return;
  }

  errorEl.textContent = '';
  setSubmitting(true);

  try {
    const data = await apiCreatePublicReport(payload);
    const reportId = data.report_id;
    const photoResults = reportId ? await uploadReportPhotos(reportId, photos) : [];
    showReportSuccess(data, photoResults);
  } catch (err) {
    errorEl.textContent = err.message || '通報送出失敗，請稍後再試';
    setSubmitting(false);
  }
}

function initGeolocation() {
  const button = document.getElementById('use-location-btn');
  const status = document.getElementById('geo-status');
  button.addEventListener('click', () => {
    if (!navigator.geolocation) {
      status.textContent = '此裝置不支援定位。';
      return;
    }
    status.textContent = '取得定位中...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        reportState.lat = position.coords.latitude.toFixed(6);
        reportState.lng = position.coords.longitude.toFixed(6);
        status.textContent = `已取得位置，精度約 ${Math.round(position.coords.accuracy)} 公尺。`;
      },
      () => {
        status.textContent = '無法取得定位，請改用文字描述位置。';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function initReportPage() {
  readReportParams();
  renderReportContext();
  initGeolocation();
  document.getElementById('photos').addEventListener('change', renderPhotoPreview);
  document.getElementById('report-form').addEventListener('submit', submitReport);
}

initReportPage();
