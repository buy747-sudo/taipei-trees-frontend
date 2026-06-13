// js/sheet.js — bottom sheet + history.pushState

const TREE_MAILBOX_MOODS = ['🌿', '💚', '🌸', '🙏', '💫', '🌳', '☀️', '🌧️', '❤️', '😊'];

function sheetEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function treeMailboxKey(treeCode) {
  return `tt_tree_mailbox:${treeCode || 'unknown'}`;
}

function readTreeMailbox(treeCode) {
  try {
    const raw = localStorage.getItem(treeMailboxKey(treeCode));
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function writeTreeMailbox(treeCode, items) {
  try {
    localStorage.setItem(treeMailboxKey(treeCode), JSON.stringify(items.slice(0, 20)));
  } catch {
    showToast('無法儲存祈福牌，請確認瀏覽器儲存設定');
  }
}

function normalizeTreeMessages(data) {
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeTreeMessage(item) {
  return {
    id: item.id || item.message_id || '',
    nickname: item.nickname || '匿名',
    message: item.message || item.content || '',
    mood: item.mood || '🌿',
    date: String(item.created_at || item.date || '').slice(0, 10),
  };
}

function isLikelySpamTreeMessage(text) {
  const value = String(text || '').toLowerCase();
  const blockedPatterns = [
    /https?:\/\//,
    /www\./,
    /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/,
    /\b[a-z0-9-]+\.(com|tw|net|org|xyz|top|shop)\b/,
    /09\d{2}[\s-]?\d{3}[\s-]?\d{3}/,
    /line\s*id|telegram|whatsapp|加line|加賴|私訊/,
    /投資|貸款|借錢|保證獲利|穩賺|賺錢|兼職|代辦|免費領|點擊|博彩|賭博|匯款|虛擬貨幣|股票群/,
    /(.)\1{8,}/,
  ];
  return blockedPatterns.some((pattern) => pattern.test(value));
}

function renderSheetPassbook(tree, benefitData) {
  const passbook = document.getElementById('sheet-passbook');
  if (!passbook) return;

  const co2 = Number(tree.annual_co2_kg || benefitData?.co2_kg || 0);
  const co2Text = co2 > 0 ? `${co2} kg CO₂ / 年` : '資料建置中';
  const km = co2 > 0 ? Math.max(1, Math.round(co2 / 0.196)) : null;
  const category = CATEGORY_LABEL[tree.tree_category] || '樹木';
  const dbh = tree.dbh_cm != null ? `胸徑 ${tree.dbh_cm} cm` : '胸徑資料建置中';
  const district = tree.district || '台北市';
  const species = tree.species_name || '這棵樹';

  passbook.innerHTML =
    `<div class="passbook-cover">` +
      `<div class="passbook-kicker">這棵樹的城市貢獻</div>` +
      `<p>這棵${sheetEscapeHtml(species)}每天站在城市裡，默默幫我們留下綠色資產。</p>` +
      `<div class="passbook-tags">` +
        `<span>${sheetEscapeHtml(district)}</span>` +
        `<span>${sheetEscapeHtml(dbh)}</span>` +
        `<span>${sheetEscapeHtml(category)}</span>` +
      `</div>` +
    `</div>` +
    `<div class="passbook-carbon-card">` +
      `<div class="passbook-carbon-icon" aria-hidden="true">♻</div>` +
      `<div>` +
        `<div class="passbook-carbon-label">每年固碳量</div>` +
        `<div class="passbook-carbon-value">約 ${sheetEscapeHtml(co2Text)}</div>` +
        `<div class="passbook-carbon-story">${km ? `每年約等同少開車 ${km} 公里` : '目前先呈現已知樹木資料，其他效益待方法學穩定後再補。'}</div>` +
      `</div>` +
    `</div>`;
  passbook.hidden = false;
}

async function loadTreeMailboxMessages(treeCode) {
  if (typeof apiFetchTreeMessages === 'function') {
    const data = await apiFetchTreeMessages(treeCode);
    return { source: 'public', messages: normalizeTreeMessages(data).map(normalizeTreeMessage).slice(0, 20) };
  }
  return { source: 'local', messages: readTreeMailbox(treeCode).map(normalizeTreeMessage) };
}

async function submitTreeMailboxMessage(treeCode, payload) {
  if (typeof apiCreateTreeMessage === 'function') {
    const data = await apiCreateTreeMessage(treeCode, payload);
    const message = data.message ? normalizeTreeMessage(data.message) : normalizeTreeMessage(payload);
    return { source: 'public', message };
  }
  const next = [{ ...payload, date: new Date().toISOString().slice(0, 10) }, ...readTreeMailbox(treeCode)];
  writeTreeMailbox(treeCode, next);
  return { source: 'local', message: normalizeTreeMessage(next[0]) };
}

function renderTreeMailboxContent(tree, messages, source = 'public') {
  const mailbox = document.getElementById('tree-mailbox');
  if (!mailbox) return;

  const treeCode = tree.registry_code || '';
  const isPublic = source === 'public';
  const messageHtml = messages.length
    ? messages.map((m) =>
        `<article class="mailbox-tag">` +
          `<div class="mailbox-tag-mood">${sheetEscapeHtml(m.mood || '🌿')}</div>` +
          `<div class="mailbox-tag-text">${sheetEscapeHtml(m.message)}</div>` +
          `<div class="mailbox-tag-footer">` +
            `<span>${sheetEscapeHtml(m.nickname)}</span>` +
            `<time>${sheetEscapeHtml(m.date)}</time>` +
          `</div>` +
        `</article>`
      ).join('')
    : `<div class="mailbox-empty">這棵樹還沒有留言，成為第一個留言的人吧！🌱</div>`;

  mailbox.innerHTML =
    `<div class="mailbox-header">` +
      `<h3>🏷 樹的信箱</h3>` +
      `<small>${isPublic ? '公開顯示' : '暫存在本裝置'} · ${messages.length ? `${messages.length} 張祈福牌` : '尚無祈福牌'}</small>` +
    `</div>` +
    `<p class="mailbox-note">${isPublic ? '看看大家寫給這棵樹的話，也可以留下一張祈福牌。' : '公開祈福牌服務暫時無法同步，這裡先保存在你的裝置。'} 請不要留下個資、網址、聯絡方式或廣告內容；不適當內容可能會被隱藏。</p>` +
    `<div class="mailbox-list">${messageHtml}</div>` +
    `<form class="mailbox-form">` +
      `<div class="mailbox-form-title">✍ 留下你對這棵樹的話</div>` +
      `<div class="mailbox-moods" role="group" aria-label="選擇祈福牌心情">` +
        TREE_MAILBOX_MOODS.map((m, i) =>
          `<button type="button" class="mailbox-mood${i === 0 ? ' active' : ''}" data-mood="${sheetEscapeHtml(m)}">${sheetEscapeHtml(m)}</button>`
        ).join('') +
      `</div>` +
      `<input name="nickname" maxlength="10" autocomplete="nickname" placeholder="你的暱稱（最多10字）">` +
      `<textarea name="message" maxlength="100" rows="3" placeholder="寫下你想對這棵樹說的話…（最多100字）"></textarea>` +
      `<div class="mailbox-form-foot">` +
        `<small>${isPublic ? '送出後會公開顯示，請勿留下個資。' : '目前先保存在本裝置，請勿留下個資。'}</small>` +
        `<span class="mailbox-count">0/100</span>` +
      `</div>` +
      `<button type="submit" class="mailbox-submit">掛上祈福牌 🏷</button>` +
    `</form>`;
  mailbox.hidden = false;

  let selectedMood = TREE_MAILBOX_MOODS[0];
  mailbox.querySelectorAll('.mailbox-mood').forEach((button) => {
    button.addEventListener('click', () => {
      selectedMood = button.dataset.mood || TREE_MAILBOX_MOODS[0];
      mailbox.querySelectorAll('.mailbox-mood').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
    });
  });

  const textarea = mailbox.querySelector('textarea[name="message"]');
  const counter = mailbox.querySelector('.mailbox-count');
  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length}/100`;
  });

  mailbox.querySelector('.mailbox-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nicknameInput = mailbox.querySelector('input[name="nickname"]');
    const nickname = nicknameInput.value.trim().slice(0, 10);
    const message = textarea.value.trim().slice(0, 100);
    if (!nickname) {
      showToast('請填寫暱稱');
      nicknameInput.focus();
      return;
    }
    if (!message) {
      showToast('請寫下想對樹說的話');
      textarea.focus();
      return;
    }
    const combinedText = `${nickname} ${message}`;
    if (isLikelySpamTreeMessage(combinedText)) {
      showToast('請不要留下網址、聯絡方式或廣告內容');
      textarea.focus();
      return;
    }
    const submit = mailbox.querySelector('.mailbox-submit');
    submit.disabled = true;
    try {
      const result = await submitTreeMailboxMessage(treeCode, { nickname, message, mood: selectedMood });
      const nextMessages = [result.message, ...messages].slice(0, 20);
      renderTreeMailboxContent(tree, nextMessages, result.source);
      showToast(result.source === 'public' ? '祈福牌已公開掛上' : '祈福牌已暫存在本裝置');
    } catch (error) {
      const localNext = [{ nickname, message, mood: selectedMood, date: new Date().toISOString().slice(0, 10) }, ...readTreeMailbox(treeCode)];
      writeTreeMailbox(treeCode, localNext);
      renderTreeMailboxContent(tree, localNext.map(normalizeTreeMessage), 'local');
      showToast('公開祈福牌暫時無法同步，已先保存在本裝置');
      console.error(error);
    }
  });
}

function renderTreeMailbox(tree) {
  return; /* mailbox hidden by product decision 2026-06-13 */
  const mailbox = document.getElementById('tree-mailbox');
  if (!mailbox) return;
  mailbox.innerHTML =
    `<div class="mailbox-header">` +
      `<h3>🏷 樹的信箱</h3>` +
      `<small>載入中</small>` +
    `</div>` +
    `<div class="mailbox-empty">正在讀取大家的祈福牌…</div>`;
  mailbox.hidden = false;

  const treeCode = tree.registry_code || '';
  loadTreeMailboxMessages(treeCode)
    .then(({ messages, source }) => renderTreeMailboxContent(tree, messages, source))
    .catch((error) => {
      console.error(error);
      renderTreeMailboxContent(tree, readTreeMailbox(treeCode).map(normalizeTreeMessage), 'local');
    });
}

function openSheet(tree) {
  const sheet = document.getElementById('detail-sheet');
  const overlay = document.getElementById('sheet-overlay');

  document.getElementById('sheet-code').textContent = tree.registry_code || '';
  const badge = document.getElementById('sheet-badge');
  badge.textContent = CATEGORY_LABEL[tree.tree_category] || '';
  badge.className = tree.tree_category === 'protected' ? 'badge-protected' : 'badge-street';

  // 擬人化問候語
  const greeting = document.getElementById('sheet-greeting');
  if (greeting) {
    const speciesName = tree.species_name || '這棵樹';
    greeting.textContent = `您好，我是 ${speciesName} 🌳`;
    greeting.hidden = false;
  }

  const title = document.getElementById('sheet-title');
  title.textContent = tree.species_name || '未知樹種';
  if (tree.scientific_name) {
    const em = document.createElement('small');
    em.style.cssText = 'display:block;font-size:0.75em;color:#888;font-style:italic;font-weight:400;';
    em.textContent = tree.scientific_name;
    title.appendChild(em);
  }

  const rows = [
    ['行政區', tree.district],
    ['路段位置', tree.managing_unit],
    ['樹高', tree.height_m != null ? `${tree.height_m} m` : null],
    ['胸徑', tree.dbh_cm != null ? `${tree.dbh_cm} cm` : null],
    ['冠幅', tree.crown_m != null ? `${tree.crown_m} m` : null],
    ['樹齡', tree.age_years != null ? `${tree.age_years} 年` : null],
    ['調查日期', tree.gov_survey_date],
  ].filter(([, v]) => v);

  const tbody = document.getElementById('sheet-table');
  tbody.innerHTML = rows.map(([k, v]) =>
    `<tr><td>${k}</td><td>${v}</td></tr>`
  ).join('');

  // 生態效益（優先用 API 固碳值，否則用 benefits.js 計算）
  const benefitData = typeof calcBenefits === 'function' ? calcBenefits(tree) : null;
  renderSheetPassbook(tree, benefitData);
  renderTreeMailbox(tree);
  const carbon = document.getElementById('sheet-carbon');
  if (carbon) {
    carbon.innerHTML = '';
    carbon.hidden = true;
  }

  // 效益摘要小卡
  const benefitEl = document.getElementById('sheet-benefits');
  const detailBtn = document.getElementById('sheet-detail-btn');
  const reportBtn = document.getElementById('sheet-report-btn');
  if (benefitData) {
    const rain = benefitData.rain_L >= 1000
      ? (benefitData.rain_L / 1000).toFixed(1) + ' 噸'
      : benefitData.rain_L + ' L';
    const ntd = benefitData.airpoll_ntd >= 1000
      ? 'NT$' + (benefitData.airpoll_ntd / 1000).toFixed(1) + 'k'
      : 'NT$' + benefitData.airpoll_ntd;
    const estNote = benefitData.height_estimated
      ? `<div class="bchip-note">＊樹高依胸徑估算</div>` : '';
    benefitEl.innerHTML =
      `<div class="benefit-chips">` +
      `<span class="bchip">💧 截雨 <strong>${rain}</strong>/年</span>` +
      `<span class="bchip">🌬️ 空污 <strong>${ntd}</strong>/年</span>` +
      `<span class="bchip">☂️ 遮蔭 <strong>${benefitData.shade_m2} m²</strong></span>` +
      `</div>${estNote}`;
    benefitEl.hidden = false;
  } else {
    benefitEl.hidden = true;
  }
  if (detailBtn && tree.registry_code) {
    detailBtn.href = `/tree.html?code=${encodeURIComponent(tree.registry_code)}`;
    detailBtn.hidden = false;
  } else if (detailBtn) {
    detailBtn.hidden = true;
  }

  if (reportBtn) {
    const params = new URLSearchParams();
    if (tree.registry_code) params.set('tree_code', tree.registry_code);
    if (tree.tree_category) params.set('tree_category', tree.tree_category);
    if (tree.species_name) params.set('species_name', tree.species_name);
    if (tree.district) params.set('district', tree.district);
    if (tree.managing_unit) params.set('managing_unit', tree.managing_unit);
    if (tree.lat != null) params.set('lat', tree.lat);
    if (tree.lng != null) params.set('lng', tree.lng);
    reportBtn.href = `/report.html?${params.toString()}`;
    reportBtn.hidden = false;
  }

  // 導航按鈕：點擊後開啟 Google Maps 導航到該樹位置
  const navBtn = document.getElementById('sheet-nav-btn');
  if (navBtn) {
    if (tree.lat != null && tree.lng != null) {
      // Google Maps 導航 URL：iOS / Android 均可開啟 Google Maps app 或瀏覽器版
      navBtn.href = `https://www.google.com/maps/dir/?api=1&destination=${tree.lat},${tree.lng}&travelmode=driving`;
      navBtn.hidden = false;
    } else {
      navBtn.hidden = true;
    }
  }

  // 樹種生態說明
  const eco = document.getElementById('sheet-eco');
  const speciesInfo = typeof getSpeciesInfo === 'function' ? getSpeciesInfo(tree.species_name) : null;
  if (speciesInfo?.traits) {
    const aliasHtml = speciesInfo.aliases?.length
      ? `<div class="eco-aliases">別名：${speciesInfo.aliases.join('、')}</div>` : '';
    eco.innerHTML = `<div class="eco-traits">${speciesInfo.traits}</div>${aliasHtml}`;
    eco.hidden = false;
  } else {
    eco.hidden = true;
  }

  // 受保護樹木故事卡（城市老朋友）
  const storyCard = document.getElementById('sheet-story-card');
  if (storyCard) {
    if (tree.tree_category === 'protected') {
      const district = tree.district || '台北市';
      const species  = tree.species_name || '老樹';

      // 為什麼值得保護：依現有資料挑最有力的一句
      let why;
      if (tree.age_years != null && tree.age_years >= 50) {
        why = `它的樹齡約 ${tree.age_years} 年，靜靜看著這座城市長大，是活的歷史見證。`;
      } else if (tree.dbh_cm != null && tree.dbh_cm >= 100) {
        why = `它的胸徑達 ${Math.round(tree.dbh_cm)} 公分，是一棵成熟的大型樹木，能長到這個規模需要數十年以上的歲月。`;
      } else {
        why = `它依《臺北市樹木保護自治條例》列冊保護，具有景觀、生態、歷史或文化價值。`;
      }

      // PT-{n} → 文化局單棵樹頁面（已驗證編號一一對應）
      const m = /^PT-(\d+)$/.exec(tree.registry_code || '');
      const officialLink = m
        ? `<a class="story-official" href="https://eculture.gov.taipei/trees/zh-tw/tree/${m[1]}" target="_blank" rel="noopener">🔗 查看官方照片與完整資料（臺北市受保護樹木資訊平台）</a>`
        : '';

      storyCard.innerHTML =
        `<div class="story-badge">⭐ 城市老朋友</div>` +
        `<p class="story-intro">這是一棵位於${district}的受保護${species}，已列入臺北市受保護樹木名冊。它不只是路邊的一棵樹，更是陪伴這座城市的老朋友。</p>` +
        `<p class="story-why">${why}</p>` +
        `<div class="story-rules">` +
          `<div class="story-rules-title">🛡️ 保護提醒</div>` +
          `<ul>` +
            `<li>不任意修剪、不釘掛招牌</li>` +
            `<li>不破壞樹皮與根系</li>` +
            `<li>工程施工應避開根系範圍</li>` +
          `</ul>` +
          `<div class="story-1999">緊急倒伏、斷枝、影響人車安全，請撥 <strong>1999</strong> 市民熱線</div>` +
        `</div>` +
        officialLink +
        `<div class="story-note">本站不保存單棵受保護樹木現地照片，官方照片請見上方平台連結。</div>`;
      storyCard.hidden = false;
    } else {
      storyCard.hidden = true;
      storyCard.innerHTML = '';
    }
  }

  // 土地脈絡卡（非同步，不阻塞 sheet 開啟）
  const zoneCard = document.getElementById('sheet-zone-card');
  if (zoneCard && tree.lat != null && tree.lng != null) {
    zoneCard.hidden = true;
    zoneCard.innerHTML = '';
    fetch(`${API_BASE}/zone?lat=${tree.lat}&lng=${tree.lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.zone_name) return;
        // nearby=true 表示樹位於街廓間的馬路上，顯示最近分區
        const prefix = data.nearby ? '鄰近 ' : '';
        zoneCard.innerHTML =
          `<div class="zone-label">📍 土地脈絡（參考）</div>` +
          `<div class="zone-name">${prefix}${data.zone_name}` +
          (data.zone_code ? ` <span class="zone-code">${data.zone_code}</span>` : '') +
          `</div>` +
          (data.zone_desc ? `<div class="zone-desc">${data.zone_desc}</div>` : '') +
          `<div class="zone-note">僅供參考，GPS 有數公尺誤差，正式分區以都發局公告為準</div>`;
        zoneCard.hidden = false;
      })
      .catch(() => {});
  } else if (zoneCard) {
    zoneCard.hidden = true;
  }

  sheet.hidden = false;
  overlay.hidden = false;
  document.body.style.overflow = 'hidden';

  history.pushState({ treeId: tree.registry_code }, '', `/?id=${tree.registry_code}`);
}

function closeSheet() {
  document.getElementById('detail-sheet').hidden = true;
  document.getElementById('sheet-overlay').hidden = true;
  document.body.style.overflow = '';
  if (history.state && history.state.treeId) {
    history.pushState({}, '', '/');
  }
}

function initSheet() {
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  document.getElementById('sheet-overlay').addEventListener('click', closeSheet);

  document.getElementById('sheet-share').addEventListener('click', () => {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: '台北市樹木資訊', url });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => showToast('連結已複製'));
    } else {
      showToast('請手動複製網址列');
    }
  });

  // 頁面載入時若 URL 有 ?id= 參數，自動開 sheet
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) {
    apiFetchTree(id).then(data => {
      if (data && data.tree) openSheet(data.tree);
      else showToast('找不到此樹籍資料');
    });
  }

  window.addEventListener('popstate', (e) => {
    if (!e.state || !e.state.treeId) {
      document.getElementById('detail-sheet').hidden = true;
      document.getElementById('sheet-overlay').hidden = true;
      document.body.style.overflow = '';
    }
  });
}
