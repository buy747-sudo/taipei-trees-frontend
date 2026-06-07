// js/export.js — Excel 匯出（含生態效益估算）
// 依賴：SheetJS (XLSX)，在 index.html 以 CDN 載入；API_BASE 來自 config.js

(function () {
  // ── 生態效益係數（i-Tree Taiwan / 農業部林業及自然保育署，依胸徑 DBH 分級）
  // 碳匯直接使用後端 annual_co2_kg（已存 DB），此處只估算雨水節流與空污效益
  const DBH_TIERS = [
    { max: 10,       rain: 0.8,  airNTD: 180  },
    { max: 20,       rain: 1.8,  airNTD: 420  },
    { max: 30,       rain: 3.5,  airNTD: 850  },
    { max: 45,       rain: 6.0,  airNTD: 1500 },
    { max: Infinity, rain: 9.5,  airNTD: 2600 },
  ];
  const DEFAULT_COEFF = { rain: 2.2, airNTD: 480 }; // 無 DBH 資料時

  function getCoeff(dbh) {
    if (!dbh || dbh <= 0) return DEFAULT_COEFF;
    return DBH_TIERS.find(t => dbh < t.max) || DBH_TIERS[DBH_TIERS.length - 1];
  }

  const CATEGORY_ZH = { street: '行道樹', protected: '受保護樹木' };
  const DISTRICTS = [
    '信義區', '大安區', '中正區', '萬華區', '中山區', '松山區',
    '大同區', '內湖區', '南港區', '文山區', '士林區', '北投區',
  ];

  // ── API ─────────────────────────────────────────────────
  async function fetchExportData({ district, category, species }) {
    const p = new URLSearchParams({ district });
    if (category) p.set('category', category);
    if (species && species.trim()) p.set('species', species.trim());
    const res = await fetch(`${API_BASE}/export?${p}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    return data.trees || [];
  }

  // ── Excel 生成 ───────────────────────────────────────────
  function buildExcel(trees, opts) {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1：樹木清單 ──────────────────────────────────
    const headers = [
      '樹籍編號', '樹種', '學名', '科別', '行政區', '類型',
      '胸徑(cm)', '樹高(m)', '樹冠(m)', '樹齡(年)',
      '年固碳量(kgCO₂/年)', '雨水節流(m³/年)', '空污效益(NT$/年)',
    ];

    const rows = trees.map(t => {
      const co2 = t.annual_co2_kg != null ? t.annual_co2_kg : 12; // 後端已算好
      const c   = getCoeff(t.dbh_cm);
      return [
        t.registry_code   || '',
        t.species_name    || '未知',
        t.scientific_name || '',
        t.family          || '',
        t.district        || '',
        CATEGORY_ZH[t.tree_category] || t.tree_category || '',
        t.dbh_cm    != null ? t.dbh_cm   : '',
        t.height_m  != null ? t.height_m : '',
        t.crown_m   != null ? t.crown_m  : '',
        t.age_years != null ? t.age_years : '',
        co2,
        c.rain,
        c.airNTD,
      ];
    });

    const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws1['!cols'] = [
      {wch:16},{wch:12},{wch:22},{wch:12},{wch:8},{wch:10},
      {wch:8},{wch:7},{wch:7},{wch:7},
      {wch:18},{wch:14},{wch:14},
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '樹木清單');

    // ── Sheet 2：效益摘要 ──────────────────────────────────
    const totalCO2  = trees.reduce((s, t) => s + (t.annual_co2_kg != null ? t.annual_co2_kg : 12), 0);
    const totalRain = trees.reduce((s, t) => s + getCoeff(t.dbh_cm).rain, 0);
    const totalAir  = trees.reduce((s, t) => s + getCoeff(t.dbh_cm).airNTD, 0);
    const carKm     = Math.round(totalCO2 / 0.2); // 汽車每公里約 0.2 kg CO₂

    // 樹種 Top 10
    const specMap = {};
    trees.forEach(t => { const n = t.species_name || '未知'; specMap[n] = (specMap[n] || 0) + 1; });
    const top10 = Object.entries(specMap).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const catLabel  = opts.category ? (CATEGORY_ZH[opts.category] || opts.category) : '全部';
    const dateLabel = new Date().toLocaleDateString('zh-TW');

    const summary = [
      ['台北市行道樹生態效益估算報告'],
      [],
      ['── 篩選條件 ──────────────────────'],
      ['行政區',   opts.district],
      ['類型',     catLabel],
      ['樹種篩選', opts.species || '（無篩選）'],
      ['產製日期', dateLabel],
      [],
      ['── 樹木統計 ──────────────────────'],
      ['樹木總數', trees.length, '棵'],
      [],
      ['── 年度生態效益合計 ───────────────'],
      ['年固碳量',   Math.round(totalCO2).toLocaleString(),  'kg CO₂ / 年'],
      ['  ↳ 換算',  carKm.toLocaleString(),                 '公里（相當於汽車行駛減少）'],
      ['雨水節流',   Math.round(totalRain).toLocaleString(), 'm³ / 年'],
      ['空污效益',   Math.round(totalAir).toLocaleString(),  'NT$ / 年'],
      [],
      ['── 前十大樹種 ────────────────────'],
      ['樹種', '棵數', '佔比(%)'],
      ...top10.map(([sp, cnt]) => [sp, cnt, ((cnt / trees.length) * 100).toFixed(1) + '%']),
      [],
      ['────────────────────────────────────────────────────────'],
      ['【碳匯】來源：臺北市政府工務局公園路燈工程管理處普查資料（annual_co2_kg）'],
      ['【雨水節流、空污效益】依胸徑（DBH）級距估算'],
      ['【係數來源】行政院農業部林業及自然保育署都市林效益評估 / i-Tree Eco Taiwan'],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2['!cols'] = [{wch:30}, {wch:20}, {wch:20}];
    XLSX.utils.book_append_sheet(wb, ws2, '效益摘要');

    return wb;
  }

  function downloadExcel(wb, district) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    XLSX.writeFile(wb, `台北市行道樹_${district}_${date}.xlsx`);
  }

  // ── UI：匯出對話框 ───────────────────────────────────────
  function buildDialog() {
    const overlay = document.createElement('div');
    overlay.id = 'export-overlay';

    // 預填目前地圖篩選行政區
    const curDistrict = document.getElementById('filter-district')?.value || '';

    overlay.innerHTML = `
      <div id="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dlg-title">
        <h3 id="export-dlg-title">📥 匯出 Excel</h3>
        <div class="export-field">
          <label for="export-district">行政區 <span class="req">*</span></label>
          <select id="export-district">
            <option value="">請選擇行政區</option>
            ${DISTRICTS.map(d =>
              `<option value="${d}"${d === curDistrict ? ' selected' : ''}>${d}</option>`
            ).join('')}
          </select>
        </div>
        <div class="export-field">
          <label for="export-category">類型</label>
          <select id="export-category">
            <option value="">全部</option>
            <option value="street">行道樹</option>
            <option value="protected">受保護樹木</option>
          </select>
        </div>
        <div class="export-field">
          <label for="export-species">樹種（選填）</label>
          <input id="export-species" type="text" placeholder="如：榕樹">
        </div>
        <p class="export-note">匯出內容：樹木清單（胸徑、樹高、年固碳量）+ 效益摘要（雨水節流、空污效益）</p>
        <div class="export-actions">
          <button id="export-confirm">⬇ 下載 Excel</button>
          <button id="export-cancel">取消</button>
        </div>
        <div id="export-status" hidden></div>
      </div>`;

    document.body.appendChild(overlay);

    document.getElementById('export-cancel').addEventListener('click', closeDialog);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeDialog(); });
    document.getElementById('export-confirm').addEventListener('click', doExport);
  }

  function closeDialog() {
    document.getElementById('export-overlay')?.remove();
  }

  async function doExport() {
    const district = document.getElementById('export-district').value.trim();
    if (!district) {
      document.getElementById('export-district').focus();
      showToast('請選擇行政區');
      return;
    }
    const category = document.getElementById('export-category').value;
    const species  = document.getElementById('export-species').value.trim();

    const btn    = document.getElementById('export-confirm');
    const status = document.getElementById('export-status');

    btn.disabled = true;
    btn.textContent = '讀取資料中…';
    status.hidden = false;
    status.className = '';
    status.textContent = `正在抓取 ${district} 的樹木資料…`;

    try {
      const trees = await fetchExportData({ district, category, species });
      if (!trees.length) {
        status.textContent = '⚠️ 此條件查無資料';
        btn.disabled = false;
        btn.textContent = '⬇ 下載 Excel';
        return;
      }
      status.textContent = `共 ${trees.length} 棵，產生 Excel 中…`;
      const wb = buildExcel(trees, { district, category, species });
      downloadExcel(wb, district);
      status.className = 'export-ok';
      status.textContent = `✅ 已下載（${trees.length} 棵，含效益摘要）`;
      btn.textContent = '⬇ 再次下載';
      btn.disabled = false;
    } catch (err) {
      status.className = 'export-err';
      status.textContent = '❌ 資料讀取失敗，請稍後再試';
      btn.textContent = '⬇ 下載 Excel';
      btn.disabled = false;
      console.error('[export]', err);
    }
  }

  // ── 初始化：加匯出按鈕至 stats-bar ─────────────────────
  function initExport() {
    const statsBar = document.getElementById('stats-bar');
    if (!statsBar) return;

    const btn = document.createElement('button');
    btn.id = 'export-btn';
    btn.title = '匯出 Excel（行政區生態效益報告）';
    btn.innerHTML = '<span aria-hidden="true">📥</span> 匯出';
    btn.addEventListener('click', () => {
      if (!document.getElementById('export-overlay')) buildDialog();
    });

    // 插在 stats-toggle 前
    const toggleBtn = document.getElementById('stats-toggle');
    statsBar.insertBefore(btn, toggleBtn);
  }

  window.initExport = initExport;
})();
