/* ============================================================
   祈福卡（絵馬）— framework-free behaviour. No React / no build.
   Composer → choose theme → hang (swing + furin chime) → share
   (LINE/FB/Threads/IG) → friend's landing view (Leaflet + ema).
   ------------------------------------------------------------
   PRODUCTION NOTES
   • Share links carry only ?code & ?wish_id & ?style.
   • TODO: resolve wish text server-side from wish_id via
     GET /public/wishes/:id — do NOT trust ?wish in the URL.
     The ?wish/?to/?from URL params below are only a demo fallback.
   • Tree data is fetched live from /public/tree/:code (apiFetchTree).
   ============================================================ */
(function () {
  "use strict";

  /* ── Themes ─────────────────────────────────────────────── */
  var THEMES = {
    sakura: {
      key: "sakura", cls: "ema--sakura", name: "櫻粉・良緣", focus: "良緣", emoji: "🌸",
      alias: "pink", forTypes: ["flowering"],
      blessing: "愛情、人際關係、家庭和樂",
      suggestions: ["願有情人終成眷屬", "祝闔家和樂、平安喜樂", "願與摯愛長長久久"],
      motif: ['<span class="ema__motif" style="top:20%;right:8%;font-size:.95em;opacity:.5">🌸</span>',
              '<span class="ema__motif" style="bottom:16%;left:8%;font-size:.7em;opacity:.4;transform:rotate(-18deg)">🌸</span>'].join("")
    },
    evergreen: {
      key: "evergreen", cls: "ema--evergreen", name: "常綠・健康", focus: "健康", emoji: "🍃",
      alias: "green", forTypes: ["evergreen", "conifer"], senior: true,
      blessing: "松柏長青，無病息災（長輩友善大字）",
      suggestions: ["祝身體健康、無病息災", "願松柏長青、福壽綿延", "祝阿公阿嬤呷百二"],
      motif: '<span class="ema__motif" style="bottom:14%;right:9%;font-size:.85em;opacity:.55">🍃</span>'
    },
    amber: {
      key: "amber", cls: "ema--amber", name: "琥珀・學業", focus: "學業", emoji: "🍁",
      alias: "amber", forTypes: ["deciduous"],
      blessing: "秋楓銀杏，金榜題名、大考順利",
      suggestions: ["祝金榜題名、考試順利", "願學業精進、心想事成", "祝大考一切順利"],
      motif: ['<span class="ema__motif" style="top:21%;right:8%;font-size:.9em;opacity:.55">🍁</span>',
              '<span class="ema__motif" style="bottom:15%;left:9%;font-size:.68em;opacity:.45;transform:rotate(20deg)">🍂</span>'].join("")
    },
    sky: {
      key: "sky", cls: "ema--sky", name: "青空・轉運", focus: "轉運", emoji: "☁️",
      alias: "blue", forTypes: ["palm", "other"],
      blessing: "晴空爽朗，事業突破、生活順心",
      suggestions: ["祝事業突破、鴻圖大展", "願轉換順利、生活順心", "祝工作順遂、財運亨通"],
      motif: '<span class="ema__motif" style="top:22%;left:9%;font-size:.82em;opacity:.5">☁️</span>'
    }
  };
  function resolveTheme(v) {
    if (!v) return "sakura";
    if (THEMES[v]) return v;
    for (var k in THEMES) if (THEMES[k].alias === v) return k;
    return "sakura";
  }

  /* ── API tree → ema tree object ─────────────────────────── */
  var TYPE_COLOR = { evergreen: "#1a5c2a", deciduous: "#9a5a2f", flowering: "#e879a7", palm: "#7cc7d8", conifer: "#0f3f2e", protected: "#f59e0b" };

  function treeApiToEma(t) {
    var type = t.visual_group || t.leaf_type || t.tree_type || "evergreen";
    return {
      code: t.registry_code || "",
      num:  t.registry_code || "",
      type: t.tree_category === "protected" ? type : type,
      protected: t.tree_category === "protected",
      species:  t.species_name  || "樹木",
      district: t.district      || "台北市",
      road:     t.managing_unit || "",
      lat: t.lat,
      lng: t.lng
    };
  }

  /* ── Helpers ────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function qp(name) { return new URLSearchParams(location.search).get(name); }
  function today() {
    var d = new Date(); return d.getFullYear() + "." + String(d.getMonth()+1).padStart(2,"0") + "." + String(d.getDate()).padStart(2,"0");
  }

  /* ── Furin（風鈴）chime — Web Audio, no asset ───────────── */
  var actx = null;
  function audioCtx() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    if (!actx) actx = new AC();
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function strike(c, t, base, vol) {
    [[1, 1, 2], [2.76, .42, 1.4], [5.18, .2, .9], [8.4, .1, .5]].forEach(function (p) {
      var o = c.createOscillator(); o.type = "sine"; o.frequency.value = base * p[0];
      var g = c.createGain(); var peak = vol * p[1];
      g.gain.setValueAtTime(.00012, t);
      g.gain.exponentialRampToValueAtTime(peak, t + .006);
      g.gain.exponentialRampToValueAtTime(.00012, t + p[2]);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + p[2] + .05);
    });
  }
  function isMuted() { return localStorage.getItem("ema-muted") === "1"; }
  function setMuted(m) { localStorage.setItem("ema-muted", m ? "1" : "0"); if (!m) audioCtx(); }
  function chime() {
    if (isMuted()) return; var c = audioCtx(); if (!c) return;
    var t0 = c.currentTime + .01;
    strike(c, t0, 2093, .32); strike(c, t0 + .13, 2093 * 1.5, .13); strike(c, t0 + .34, 2093 * .997, .06);
  }

  /* ── Petals ─────────────────────────────────────────────── */
  var GLYPHS = { sakura: ["🌸", "🌸", "❀"], evergreen: ["🍃", "✦", "🍃"], amber: ["🍁", "🍂", "🍁"], sky: ["☁️", "✦", "☁️"] };
  function petals(theme, count, dense) {
    var g = GLYPHS[theme] || GLYPHS.sakura;
    var wrap = el('<div class="tt-petals" aria-hidden="true"></div>');
    for (var i = 0; i < count; i++) {
      var s = document.createElement("span"); s.className = "tt-petal";
      var size = 0.7 + Math.random() * 1.1, delay = Math.random() * (dense ? 1.4 : 3),
          dur = 4.5 + Math.random() * 4, drift = (Math.random() * 2 - 1) * 40, spin = Math.random() * 2 - 1;
      s.textContent = g[i % g.length];
      s.style.cssText = "left:" + (Math.random() * 100) + "%;font-size:" + size + "rem;--dx:" + drift + "px;--sp:" + spin +
        ";animation:emaFall " + dur + "s linear " + delay + "s infinite;filter:drop-shadow(0 1px 1px rgba(0,0,0,.12))";
      wrap.appendChild(s);
    }
    return wrap;
  }

  /* ── Render an ema plaque (HTML string) ─────────────────── */
  function emaHTML(o) {
    var t = THEMES[o.theme] || THEMES.sakura;
    var wish = (o.wish || "").trim();
    var swing = o.swing && o.swing !== "none" ? ' data-swing="' + o.swing + '"' : "";
    var w = o.width || 240;
    return '' +
      '<figure class="ema ' + t.cls + '"' + swing + ' role="img" aria-label="祈福卡" style="--ema-w:' + w + 'px">' +
        '<div class="ema__cord"><span class="ema__knot"></span></div>' +
        '<div class="ema__plaque">' +
          '<span class="ema__grain"></span><span class="ema__frame"></span><span class="ema__hole"></span>' +
          (o.motif === false ? "" : t.motif) +
          '<span class="ema__focus">' + t.emoji + " " + t.focus + '</span>' +
          (o.to ? '<div class="ema__to">敬祝　' + esc(o.to) + '</div>' : "") +
          '<p class="ema__wish' + (wish ? "" : " is-empty") + '">' + (wish ? esc(wish) : "在這裡寫下你的願望…") + '</p>' +
          ((o.from || o.date) ? '<div class="ema__sig"><span>' + (o.from ? "— " + esc(o.from) : "") + '</span><span>' + esc(o.date || "") + '</span></div>' : "") +
          '<span class="ema__furin">🎐</span>' +
        '</div>' +
      '</figure>';
  }

  /* ── Composer ───────────────────────────────────────────── */
  function mountComposer(root, tree) {
    var suggested = "sakura";
    for (var k in THEMES) if (THEMES[k].forTypes.indexOf(tree.type) >= 0) { suggested = k; break; }
    var cur = { theme: suggested, to: "", wish: "", from: "" };

    var themesHTML = Object.keys(THEMES).map(function (key) {
      var th = THEMES[key];
      return '<button class="cmp__theme ' + (key === cur.theme ? "is-on" : "") + '" data-theme="' + key + '" type="button">' +
        '<span class="chip ' + th.cls + '" style="background:var(--wood)"></span>' +
        '<span><span class="n">' + th.emoji + " " + th.name + '</span><span class="b">' + th.blessing + '</span></span>' +
      '</button>';
    }).join("");

    root.innerHTML = '' +
      '<div class="cmp__head">' +
        '<span style="font-size:1.4rem" aria-hidden="true">🌳</span>' +
        '<div><div class="t">在這棵' + esc(tree.species) + '上掛一張祈福卡</div>' +
        '<div class="s">' + esc(tree.district) + "・" + esc(tree.road) + '　<span class="mono">' + esc(tree.code) + '</span></div></div>' +
        '<button class="cmp__mute" type="button" title="音效">' + (isMuted() ? "🔇" : "🎐") + '</button>' +
      '</div>' +
      '<div class="cmp__stage">' +
        '<div class="tt-branch"></div>' +
        '<div class="cmp__preview"></div>' +
        '<div class="cmp__hung" style="display:none">🎐 掛上樹梢了…</div>' +
      '</div>' +
      '<div class="cmp__body">' +
        '<div><div class="cmp__labelrow"><span class="cmp__steplabel">① 這次想為什麼祈福？</span>' +
          '<span class="cmp__rec" data-rec>為' + esc(tree.species) + '推薦</span></div>' +
          '<div class="cmp__themes">' + themesHTML + '</div></div>' +
        '<div class="cmp__form">' +
          '<span class="cmp__steplabel">② 寫下祝福</span>' +
          '<input class="cmp__input" data-to maxlength="20" placeholder="這張卡送給誰？如：阿嬤、台灣加油（可留白）">' +
          '<textarea class="cmp__input" data-wish maxlength="40" placeholder="寫一句願望或感謝…"></textarea>' +
          '<div class="cmp__counter" data-wish-count>0 / 40 字</div>' +
          '<div class="cmp__suggs"></div>' +
          '<input class="cmp__input" data-from maxlength="16" placeholder="署名（可留白）">' +
        '</div>' +
        '<button class="cmp__hang" type="button" disabled>🎐 掛上樹梢</button>' +
        '<p class="cmp__hint">掛上後可分享到 LINE、FB、Threads、IG，邀朋友一起為這座城市的樹祈福 🌳</p>' +
      '</div>';

    var preview = root.querySelector(".cmp__preview");
    var hungMsg = root.querySelector(".cmp__hung");
    var stage = root.querySelector(".cmp__stage");
    var suggs = root.querySelector(".cmp__suggs");
    var hang = root.querySelector(".cmp__hang");
    var rec = root.querySelector("[data-rec]");
    var inTo = root.querySelector("[data-to]"), inWish = root.querySelector("[data-wish]"), inFrom = root.querySelector("[data-from]");

    function focusColor() { return getComputedStyle(preview.querySelector(".ema")).getPropertyValue("--focus") || "#1a5c2a"; }
    function refreshPreview() {
      preview.innerHTML = emaHTML({ theme: cur.theme, to: cur.to.trim(), wish: cur.wish.trim(), from: cur.from.trim(), date: today(), swing: "none", width: 228 });
      hang.style.background = focusColor();
    }
    function refreshSuggs() {
      var th = THEMES[cur.theme];
      suggs.innerHTML = th.suggestions.map(function (s) {
        return '<button class="cmp__sugg ' + th.cls + '" type="button" style="border-color:var(--focus);color:var(--focus)">' + esc(s) + '</button>'; }).join("");
      suggs.querySelectorAll(".cmp__sugg").forEach(function (b) {
        b.onclick = function () { cur.wish = b.textContent; inWish.value = b.textContent; sync(); };
      });
    }
    function sync() { hang.disabled = cur.wish.trim().length === 0; refreshPreview(); }

    root.querySelectorAll(".cmp__theme").forEach(function (btn) {
      btn.onclick = function () {
        cur.theme = btn.getAttribute("data-theme");
        root.querySelectorAll(".cmp__theme").forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        rec.style.display = cur.theme === suggested ? "" : "none";
        refreshSuggs(); refreshPreview();
      };
    });
    inTo.oninput = function () { cur.to = inTo.value; refreshPreview(); };
    var wishCount = root.querySelector('[data-wish-count]');
    inWish.oninput = function () {
      cur.wish = inWish.value;
      var n = inWish.value.length;
      if (wishCount) {
        wishCount.textContent = n + ' / 40 字';
        wishCount.className = 'cmp__counter' + (n >= 40 ? ' is-full' : n >= 30 ? ' is-near' : '');
      }
      sync();
    };
    inFrom.oninput = function () { cur.from = inFrom.value; refreshPreview(); };

    root.querySelector(".cmp__mute").onclick = function () {
      var next = !isMuted(); setMuted(next); this.textContent = next ? "🔇" : "🎐"; if (!next) chime();
    };

    hang.onclick = function () {
      if (hang.disabled) return;
      var fig = preview.querySelector(".ema");
      fig.setAttribute("data-swing", "in");
      chime();
      stage.appendChild(petals(cur.theme, 18, true));
      hungMsg.style.display = "";
      root.querySelector(".cmp__body").style.opacity = ".4";
      root.querySelector(".cmp__body").style.pointerEvents = "none";
      setTimeout(function () {
        var wishData = {
          tree: tree, theme: cur.theme, to: cur.to.trim(), wish: cur.wish.trim(),
          from: cur.from.trim() || "匿名的祝福", date: today(), wish_id: null
        };
        fetch(API_BASE + "/wishes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tree_code: tree.code,
            wish_text: wishData.wish || "祝這棵樹長長久久",
            style: THEMES[cur.theme] ? THEMES[cur.theme].alias : "sakura",
            nickname: wishData.from
          })
        }).then(function(r) { return r.json(); })
          .then(function(j) { wishData.wish_id = j.wish_id || null; })
          .catch(function() { /* share still works without wish_id */ })
          .finally(function() { openShare(root, wishData); });
      }, 1900);
    };

    rec.style.display = cur.theme === suggested ? "" : "none";
    refreshSuggs(); refreshPreview();
  }

  /* ── Canvas share-image helpers ─────────────────────────── */
  function roundRectPath(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function wrapTextForCanvas(c, text, maxW) {
    var chars = text.split(""), lines = [], line = "";
    chars.forEach(function(ch) {
      var test = line + ch;
      if (c.measureText(test).width > maxW && line.length > 0) { lines.push(line); line = ch; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function generateShareCanvas(data) {
    var DPR = 2, W = 540, H = 540;
    var canvas = document.createElement("canvas");
    canvas.width = W * DPR; canvas.height = H * DPR;
    var c = canvas.getContext("2d");
    c.scale(DPR, DPR);
    var TC = {
      sakura:    { bg1:"#fdf0f5", bg2:"#edadc6", ink:"#8a2150", card:"rgba(255,255,255,0.90)", badge:"#c14b7c", dec:["🌸","🌸","❀"], dark:false },
      evergreen: { bg1:"#1a3d28", bg2:"#091f14",  ink:"#fbf3da", card:"rgba(0,0,0,0.28)",      badge:"#caa24a", dec:["🍃","🌿","🍃"], dark:true  },
      amber:     { bg1:"#fce8bc", bg2:"#d9870e",  ink:"#7a3608", card:"rgba(255,255,255,0.88)", badge:"#bd5410", dec:["🍁","🍂","🍁"], dark:false },
      sky:       { bg1:"#deeeff", bg2:"#5d9fd6",  ink:"#0f3d6e", card:"rgba(255,255,255,0.87)", badge:"#2563c4", dec:["☁️","⭐","☁️"], dark:false }
    };
    var tc = TC[data.theme] || TC.sakura;
    var t = THEMES[data.theme] || THEMES.sakura;
    // Background
    var grd = c.createLinearGradient(0, 0, W * 0.4, H);
    grd.addColorStop(0, tc.bg1); grd.addColorStop(1, tc.bg2);
    c.fillStyle = grd; c.fillRect(0, 0, W, H);
    // Decorative scatter (fixed positions)
    c.font = "22px sans-serif"; c.globalAlpha = 0.10;
    [[42,78],[488,56],[76,468],[496,446],[108,218],[468,206],[252,36],[280,498],[26,298],[516,318],[160,120],[390,410]].forEach(function(p, i) {
      c.fillText(tc.dec[i % 3], p[0], p[1]);
    });
    c.globalAlpha = 1;
    // Card — full bleed, MUJI minimal
    var cx = 14, cy = 14, cw = W - 28, ch = H - 58;
    c.fillStyle = tc.card;
    roundRectPath(c, cx, cy, cw, ch, 20); c.fill();
    c.strokeStyle = tc.dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
    c.lineWidth = 1; roundRectPath(c, cx, cy, cw, ch, 20); c.stroke();
    // Theme badge
    var bw = 116;
    c.fillStyle = tc.badge;
    roundRectPath(c, W/2 - bw/2, cy + 16, bw, 28, 14); c.fill();
    c.fillStyle = "#fff"; c.font = "bold 12px 'Noto Sans TC', sans-serif"; c.textAlign = "center";
    c.fillText(t.emoji + " " + t.focus, W/2, cy + 34);
    // To line
    var bodyTop = cy + 58;
    if (data.to) {
      c.fillStyle = tc.ink; c.globalAlpha = 0.82;
      c.font = "500 15px 'Noto Serif TC', serif"; c.textAlign = "center";
      c.fillText("\u656c\u795d\u3000" + data.to, W/2, bodyTop + 12);
      c.globalAlpha = 1; bodyTop += 36;
    }
    // Wish text
    var wish = data.wish || "";
    var wpx = wish.length <= 10 ? 36 : wish.length <= 18 ? 30 : wish.length <= 28 ? 25 : 20;
    c.font = "700 " + wpx + "px 'Noto Serif TC', serif";
    c.fillStyle = tc.ink; c.textAlign = "center";
    var wlines = wrapTextForCanvas(c, wish, cw - 60);
    var wlh = wpx * 1.65;
    var cardBottom = cy + ch;
    var avail = (cardBottom - 78) - bodyTop;
    var sy = bodyTop + avail / 2 - (wlines.length * wlh) / 2 + wpx * 0.5;
    wlines.forEach(function(ln, i) { c.fillText(ln, W/2, sy + i * wlh); });
    // Thin separator inside card
    c.strokeStyle = tc.dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)";
    c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(cx + 32, cardBottom - 72); c.lineTo(cx + cw - 32, cardBottom - 72); c.stroke();
    // Signature (from + date)
    c.font = "400 13px 'Noto Sans TC', sans-serif"; c.fillStyle = tc.ink; c.globalAlpha = 0.50; c.textAlign = "center";
    c.fillText("\u2014 " + (data.from || "\u533f\u540d\u7684\u795d\u798f") + "\u3000" + data.date, W/2, cardBottom - 48);
    c.globalAlpha = 1;
    // Tree info — very subtle inside card
    c.font = "10px 'Noto Sans TC', sans-serif"; c.fillStyle = tc.ink; c.globalAlpha = 0.30; c.textAlign = "center";
    c.fillText(data.tree.species + "\u3000" + data.tree.district + data.tree.road, W/2, cardBottom - 28);
    c.globalAlpha = 1;
    // Footer — MUJI: just the URL, quiet
    c.fillStyle = tc.dark ? "rgba(255,255,255,0.45)" : "rgba(20,55,30,0.45)";
    c.font = "10px 'Noto Sans TC', sans-serif"; c.globalAlpha = 0.45; c.textAlign = "center";
    c.fillText("taipei-trees.org", W/2, H - 18);
    c.globalAlpha = 1;
    return canvas;
  }

  /* ── Share sheet ────────────────────────────────────────── */
  function openShare(root, data) {
    var t = THEMES[data.theme];
    var url = "https://taipei-trees.org/wish.html?code=" + encodeURIComponent(data.tree.code) +
      (data.wish_id ? "&wish_id=" + encodeURIComponent(data.wish_id) : "") + "&style=" + t.alias;
    var text = "我在台北的一棵" + data.tree.species + "上掛了一張祈福卡 🎐：「" +
      (data.to ? "敬祝" + data.to + "，" : "") + data.wish + "」一起來為城市的樹祈福吧！";

    var shareCanvas = generateShareCanvas(data);
    var previewUrl = shareCanvas.toDataURL("image/jpeg", 0.88);

    function doSaveImage() {
      shareCanvas.toBlob(function(blob) {
        var file = new File([blob], "taipei-tree-wish.jpg", { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "台北市樹木祈福卡", text: text }).catch(function() {});
        } else {
          var a = document.createElement("a"), objUrl = URL.createObjectURL(blob);
          a.href = objUrl; a.download = "taipei-tree-wish.jpg";
          document.body.appendChild(a); a.click();
          setTimeout(function() { a.remove(); URL.revokeObjectURL(objUrl); }, 1000);
          toast("圖片已下載！直接貼到 LINE、IG 等任何地方分享 🎐");
        }
      }, "image/jpeg", 0.88);
    }

    var scrim = el('<div class="sheet__scrim"></div>');
    var sheet = el('<div class="sheet" role="dialog" aria-label="分享祈福卡"></div>');
    sheet.innerHTML =
      '<div class="sheet__grab"></div>' +
      '<div class="sheet__in">' +
        '<div class="sheet__kick" style="color:' + (t.alias === "green" ? "#caa24a" : "#c14b7c") + '">WISH HUNG 🎐</div>' +
        '<h2>祝福掛上了！</h2>' +
        '<p class="sub">存下這張圖片，貼到 LINE、IG、Threads 任何地方都可以分享！</p>' +
        '<div class="sheet__img-wrap"><img src="' + previewUrl + '" class="sheet__img-preview" alt="祈福卡分享圖"></div>' +
        '<button class="btn-save-img" type="button">💾 存圖分享</button>' +
        '<p class="share-hint">在 iOS 上會直接開啟分享選單；在電腦上會下載圖片檔</p>' +
        '<div class="sheet__url"><code>' + esc(url) + '</code><button class="btn-copy" type="button">複製連結</button></div>' +
        '<div class="sheet__row"><button class="btn-preview" type="button">👀 預覽朋友看到的畫面</button><button class="btn-more" type="button">📱 更多…</button></div>' +
        '<button class="btn-again" type="button">完成，再掛一張</button>' +
        '<div class="wish-gallery" style="margin-top:18px;border-top:1px solid var(--border-mint);padding-top:14px">' +
          '<div class="wg-header"><b>🌳 這棵樹上的祈福卡</b><span class="wg-count"></span></div>' +
          '<div class="wg-strip"></div>' +
        '</div>' +
      '</div>';

    function close() { scrim.remove(); sheet.remove(); }
    function toast(msg) { var x = el('<div class="tt-toast">' + esc(msg) + '</div>'); document.body.appendChild(x); setTimeout(function() { x.remove(); }, 3000); }
    function copy() { if (navigator.clipboard) navigator.clipboard.writeText(url); }

    scrim.onclick = close;
    sheet.querySelector(".btn-save-img").onclick = doSaveImage;
    sheet.querySelector(".btn-copy").onclick = function() { copy(); toast("已複製連結 ✓"); };
    sheet.querySelector(".btn-more").onclick = function() {
      if (navigator.share) navigator.share({ title: "台北市樹木祈福卡", text: text, url: url }).catch(function() {});
      else { copy(); toast("已複製連結 ✓"); }
    };
    sheet.querySelector(".btn-again").onclick = function() { close(); mountComposer(root, data.tree); };
    sheet.querySelector(".btn-preview").onclick = function() { close(); mountLanding(root, data); };

    root.appendChild(scrim); root.appendChild(sheet);
    loadWishGallery(data.tree.code, sheet.querySelector(".wg-strip"), sheet.querySelector(".wg-count"), data.wish_id);
  }

  /* ── Wish gallery ──────────────────────────────────────── */
  function loadWishGallery(treeCode, stripEl, countEl, excludeId) {
    stripEl.innerHTML = '<span class="wg-loading">載入中…</span>';
    fetch(API_BASE + "/tree/" + encodeURIComponent(treeCode) + "/wishes")
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(j) {
        if (!j || !j.wishes) return;
        var all = j.wishes;
        if (countEl && all.length) countEl.textContent = "已有 " + all.length + " 張";
        var wishes = all.filter(function(w) { return String(w.id) !== String(excludeId); });
        if (!wishes.length) {
          stripEl.innerHTML = '<span class="wg-empty">你是第一個！成為大家的榜樣 🌱</span>';
          return;
        }
        stripEl.innerHTML = "";
        wishes.forEach(function(w) {
          var theme = resolveTheme(w.style);
          var card = document.createElement("div");
          card.className = "wg-card";
          card.innerHTML = emaHTML({ theme: theme, wish: w.wish_text, from: w.nickname, date: (w.created_at || "").slice(0, 10), width: 108, motif: false, to: "" });
          card.onclick = function() { showWishPopup(w, theme); };
          stripEl.appendChild(card);
        });
      })
      .catch(function() { stripEl.innerHTML = '<span class="wg-empty">無法載入</span>'; });
  }

  function showWishPopup(wish, theme) {
    var scrim = el('<div class="wg-scrim"></div>');
    var popup = el('<div class="wg-popup" role="dialog"></div>');
    popup.innerHTML =
      '<div style="display:flex;justify-content:center;margin-bottom:12px">' +
        emaHTML({ theme: theme, wish: wish.wish_text, from: wish.nickname, date: (wish.created_at || "").slice(0, 10), swing: "idle", width: 220 }) +
      '</div>' +
      '<button class="wg-close" type="button">✕ 關閉</button>';
    function dismiss() { scrim.remove(); popup.remove(); }
    scrim.onclick = dismiss;
    popup.querySelector(".wg-close").onclick = dismiss;
    document.body.appendChild(scrim); document.body.appendChild(popup);
  }

  /* ── Landing (friend's view) ────────────────────────────── */
  function mountLanding(root, data) {
    var t = THEMES[data.theme];
    var tree = data.tree;
    root.innerHTML = '' +
      '<div class="land">' +
        '<div class="land__map" id="ema-map"></div><div class="land__veil"></div>' +
        '<div class="land__top"><div class="t">🌳 台北市樹木查詢</div><div class="s">有人在這棵樹上，為你掛了一張祈福卡</div></div>' +
        '<div class="land__hang">' +
          '<div class="land__branch"><span class="lf" style="left:8%">🍃</span><span class="lf" style="right:8%;transform:scaleX(-1)">🍃</span></div>' +
          '<div style="margin-top:-3px">' + emaHTML({ theme: data.theme, to: data.to, wish: data.wish, from: data.from, date: data.date, swing: "in", width: 240 }) + '</div>' +
        '</div>' +
        '<div class="land__card">' +
          '<div class="land__who"><b>' + esc(data.from) + '</b><span>掛上了一張「' + t.name + '」祈福卡</span></div>' +
          '<div class="land__loc"><span aria-hidden="true">📍</span><span>' + esc(tree.species) + "・" + esc(tree.district) + esc(tree.road) + (tree.protected ? "　⭐ 受保護樹木" : "") + '</span></div>' +
          '<button class="land__cta" type="button">✍️ 我也要掛一張祈福卡</button>' +
          '<div class="land__links"><a href="tree.html?code=' + encodeURIComponent(tree.code) + '">🌳 查看這棵樹</a><a href="/">🗺 城市樹木地圖</a></div>' +
          '<p class="land__foot">台北市樹木查詢平台・公益服務　|　緊急狀況請聯絡 1999</p>' +
          '<div class="wish-gallery" style="margin-top:14px;border-top:1px solid rgba(255,255,255,0.15);padding-top:12px">' +
            '<div class="wg-header"><b style="font-size:.82rem;color:var(--ink-green)">🌳 這棵樹上還有</b><span class="wg-count" style="font-size:.78rem;color:var(--text-muted)"></span></div>' +
            '<div class="wg-strip"></div>' +
          '</div>' +
        '</div>' +
        petalsHTML(data.theme) +
      '</div>';

    root.querySelector(".land__cta").onclick = function () { mountComposer(root, tree); };
    root.querySelector(".land__cta").style.background = t && getComputedStyle(root.querySelector(".ema")).getPropertyValue("--focus");

    if (window.L) {
      var map = L.map("ema-map", { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([tree.lat, tree.lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      var color = TYPE_COLOR[tree.type] || "#1a5c2a";
      var iconHtml = tree.protected
        ? '<span style="width:30px;height:30px;background:' + color + ';display:block;clip-path:polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))"></span>'
        : '<span style="width:24px;height:24px;background:' + color + ';display:block;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></span>';
      L.marker([tree.lat, tree.lng], { icon: L.divIcon({ className: "tt-marker", html: iconHtml, iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map);
      setTimeout(function () { map.invalidateSize(); }, 150);
    }
    var lgStrip = root.querySelector('.wg-strip'), lgCount = root.querySelector('.wg-count');
    if (lgStrip) loadWishGallery(tree.code, lgStrip, lgCount, data.wish_id);
  }
  function petalsHTML(theme) { var d = document.createElement("div"); d.appendChild(petals(theme, 14, false)); return d.innerHTML; }

  /* ── Error / loading screens ────────────────────────────── */
  function showLoading(root) {
    root.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text-muted)">🌳 載入中…</div>';
  }


  function showError(root, msg) {
    root.innerHTML = '<div style="text-align:center;padding:80px 20px;color:var(--text-muted)">' +
      '<div style="font-size:2rem;margin-bottom:12px">🌿</div>' +
      '<p>' + esc(msg) + '</p>' +
      '<a href="/" style="color:var(--green-600);font-weight:700">← 回地圖</a></div>';
  }

  /* ── Intro splash ── 3s golden tree animation (Design v2) ── */
  function showIntro(onDone, opts) {
    var root = document.createElement('div');
    root.id = 'ttintro'; root.className = 'ttintro';
    var stage = document.createElement('div');
    stage.className = 'ttintro__stage';
    root.appendChild(stage);
    document.body.appendChild(root);

    stage.innerHTML =
      '<span class="ttintro__glow"></span>' +
      '<svg class="ttintro__tree" viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs><linearGradient id="ttGold" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FFA500"/>' +
        '</linearGradient></defs>' +
        '<path d="M93 240 C 95 206 96 180 97 156 L103 156 C 104 180 105 206 107 240 Z" fill="url(#ttGold)"/>' +
        '<path d="M100 240 C 84 232 70 234 58 242 C 76 232 90 232 99 238 Z M100 240 C 116 232 130 234 142 242 C 124 232 110 232 101 238 Z" fill="url(#ttGold)"/>' +
        '<g stroke="url(#ttGold)" stroke-width="7" stroke-linecap="round" fill="none">' +
          '<path d="M100 162 C 96 146 84 136 74 130"/>' +
          '<path d="M100 162 C 104 146 116 136 126 130"/>' +
          '<path d="M100 158 C 100 144 100 134 100 124"/>' +
        '</g>' +
        '<path d="M48 118 C 40 96 50 72 72 66 C 76 46 98 38 112 48 C 124 36 146 44 150 64 C 170 70 176 96 162 118 C 170 134 152 150 130 144 C 114 152 86 152 70 144 C 48 150 40 134 48 118 Z" fill="url(#ttGold)"/>' +
        '<g fill="#FFE680" opacity=".5"><circle cx="84" cy="84" r="16"/><circle cx="118" cy="92" r="13"/><circle cx="104" cy="66" r="11"/></g>' +
      '</svg>' +
      '<span class="ttintro__card ttintro__card--1"></span>' +
      '<span class="ttintro__card ttintro__card--2"></span>' +
      '<span class="ttintro__card ttintro__card--3"></span>' +
      '<span class="ttintro__card ttintro__card--4"></span>' +
      '<span class="ttintro__card ttintro__card--5"></span>' +
      '<span class="ttintro__card ttintro__card--6"></span>' +
      '<span class="ttintro__spark ttintro__spark--1"></span>' +
      '<span class="ttintro__spark ttintro__spark--2"></span>' +
      '<span class="ttintro__spark ttintro__spark--3"></span>' +
      '<span class="ttintro__spark ttintro__spark--4"></span>' +
      '<span class="ttintro__spark ttintro__spark--5"></span>' +
      '<span class="ttintro__spark ttintro__spark--6"></span>' +
      '<span class="ttintro__spark ttintro__spark--7"></span>' +
      '<span class="ttintro__spark ttintro__spark--8"></span>' +
      '<span class="ttintro__spark ttintro__spark--9"></span>' +
      '<span class="ttintro__spark ttintro__spark--10"></span>' +
      '<span class="ttintro__spark ttintro__spark--11"></span>' +
      '<span class="ttintro__spark ttintro__spark--12"></span>' +
      '<span class="ttintro__spark ttintro__spark--13"></span>' +
      '<p class="ttintro__sub">在城市的樹梢，掛一張屬於你的祈福卡</p>' +
      (opts && opts.cta ? '<a class="ttintro__cta">去找一棵屬於你的樹 🌳</a>' : '');

    function chime() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        var c = window.__ttCtx || (window.__ttCtx = new AC());
        if (c.state === 'suspended') c.resume();
        var t0 = c.currentTime + 0.02;
        [[2093,.26,0],[3139,.12,.13],[2087,.06,.34]].forEach(function(s) {
          [[1,1,2],[2.76,.42,1.4],[5.18,.2,.9]].forEach(function(p) {
            var o = c.createOscillator(); o.type = 'sine'; o.frequency.value = s[0] * p[0];
            var g = c.createGain(); g.gain.setValueAtTime(.0001, t0+s[2]);
            g.gain.exponentialRampToValueAtTime(s[1]*p[1], t0+s[2]+.006);
            g.gain.exponentialRampToValueAtTime(.0001, t0+s[2]+p[2]);
            o.connect(g).connect(c.destination); o.start(t0+s[2]); o.stop(t0+s[2]+p[2]+.05);
          });
        });
      } catch(e) {}
    }
    document.addEventListener('pointerdown', function u() {
      try { (window.__ttCtx || (window.__ttCtx = new (window.AudioContext||window.webkitAudioContext)())).resume(); } catch(e) {}
    }, { once: true });

    var done = false;
    function leave() {
      if (done) return; done = true;
      root.classList.add('is-leaving');
      setTimeout(function() { if (root.parentNode) root.parentNode.removeChild(root); if (onDone) onDone(); }, 440);
    }
    root.addEventListener('click', leave);
    if (opts && opts.cta) {
      var ctaEl = stage.querySelector('.ttintro__cta');
      if (ctaEl) {
        ctaEl.addEventListener('click', function(e) {
          e.stopPropagation(); e.preventDefault();
          if (done) return; done = true;
          root.classList.add('is-leaving');
          setTimeout(function() { if (root.parentNode) root.parentNode.removeChild(root); window.location.href = '/'; }, 440);
        });
      }
    }
    setTimeout(chime, 780);
    setTimeout(chime, 1700);
    if (!(opts && opts.cta)) setTimeout(leave, 4500);
  }

  /* ── Router ─────────────────────────────────────────────── */
  function start() {
    var root = document.getElementById("app");
    if (!root) return;
    root.className = "tt-app";

    var code = qp("code");
    var wishId = qp("wish_id");
    var styleParam = qp("style");

    if (!code) { showIntro(function() { window.location.href = '/'; }, { cta: true }); return; }

    // fetch tree + intro animation run in parallel
    var fetchResult = null, fetchError = false, introDone = false;

    apiFetchTree(code).then(function(data) {
      fetchResult = data; if (introDone) mount();
    }).catch(function() {
      fetchError = true; if (introDone) showError(root, "載入失敗，請稍後再試。");
    });

    showIntro(function() {
      introDone = true;
      if (fetchError) { showError(root, "載入失敗，請稍後再試。"); return; }
      if (fetchResult) { mount(); return; }
      showLoading(root);
    });

    function mount() {
      if (!fetchResult || !fetchResult.tree) { showError(root, "找不到這棵樹（" + code + "）。"); return; }
      var tree = treeApiToEma(fetchResult.tree);
      if (wishId) {
        fetch(API_BASE + "/wishes/" + encodeURIComponent(wishId))
          .then(function(r) { return r.ok ? r.json() : null; })
          .then(function(j) {
            var w = j && j.wish;
            mountLanding(root, {
              tree: tree, theme: w ? resolveTheme(w.style) : resolveTheme(styleParam),
              to: "", wish: w ? w.wish_text : "祝這棵樹長長久久、城市永遠蒼翠",
              from: w ? w.nickname : "匿名的祝福",
              date: w ? w.created_at.slice(0, 10) : today(), wish_id: wishId
            });
          })
          .catch(function() {
            mountLanding(root, {
              tree: tree, theme: resolveTheme(styleParam),
              to: "", wish: "祝這棵樹長長久久、城市永遠蒼翠",
              from: "匿名的祝福", date: today(), wish_id: wishId
            });
          });
      } else {
        mountComposer(root, tree);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  // expose for embedding elsewhere
  window.EmaWish = { mountComposer: mountComposer, mountLanding: mountLanding, emaHTML: emaHTML, chime: chime, THEMES: THEMES };
})();
