/* ===========================================================
   Kent Web Design — Project Onboarding wizard
   Vanilla JS. No build step. Drives a step-by-step brief.
   =========================================================== */
(function () {
  'use strict';

  /* -----------------------------------------------------------
     CONFIG — submissions go via Web3Forms (https://web3forms.com).
     ► ONE-TIME SETUP (takes 30 seconds):
       1. Go to https://web3forms.com
       2. Enter the inbox you want briefs to land in (e.g. hello@kentwebdesign.com)
       3. They email you an Access Key — paste it below in place of
          'YOUR-WEB3FORMS-ACCESS-KEY'.
       That's it. Every completed brief (answers + uploaded files) then
       arrives in that inbox automatically — no account, no password.
     Fallback: if a submission ever fails, the customer is offered an
     "email us" / "download" option so nothing is ever lost.
  ----------------------------------------------------------- */
  var WEB3FORMS_KEY = '08688d2a-49ee-4b8e-9e83-e427b02b712b';
  var SUBMIT_ENDPOINT = 'https://api.web3forms.com/submit';
  var SUBMIT_EMAIL = 'hello@kentwebdesign.com'; // used only for the fallback "email us" link
  var STORAGE_KEY = 'kwd_onboarding_v1';

  /* ----------------------------- refs ----------------------------- */
  var form = document.getElementById('obForm');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var stepperEl = document.getElementById('stepper');
  var trackFill = document.getElementById('trackFill');
  var stepLabel = document.getElementById('stepLabel');
  var stepCount = document.getElementById('stepCount');
  var backBtn = document.getElementById('backBtn');
  var nextBtn = document.getElementById('nextBtn');
  var footHint = document.getElementById('footHint');
  var savePill = document.getElementById('savePill');
  var reviewOut = document.getElementById('reviewOut');
  var consent = document.getElementById('consent');
  var overlay = document.getElementById('overlay');
  var overlayCard = document.getElementById('overlayCard');
  var doneScreen = document.getElementById('doneScreen');

  var current = 0;
  var maxReached = 0;
  var files = {}; // key -> [File, ...]

  /* ----------------------------- icons ----------------------------- */
  var FILE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';

  /* ===========================================================
     REPEATABLE ROWS (services, faqs)
     =========================================================== */
  var repeatDefs = {
    services: { ph1: 'Service / product', ph2: 'One-line description', cls: '' },
    faqs: { ph1: 'A question customers ask', ph2: 'Your answer (optional)', cls: 'faq' }
  };

  function makeRow(kind, v1, v2) {
    var def = repeatDefs[kind];
    var row = document.createElement('div');
    row.className = 'rrow ' + def.cls;
    row.innerHTML =
      '<input type="text" placeholder="' + def.ph1 + '" data-col="1">' +
      '<input type="text" placeholder="' + def.ph2 + '" data-col="2">' +
      '<button type="button" class="del" aria-label="Remove row">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
      '</button>';
    if (v1) row.querySelector('[data-col="1"]').value = v1;
    if (v2) row.querySelector('[data-col="2"]').value = v2;
    row.querySelector('.del').addEventListener('click', function () {
      var list = row.parentNode;
      row.remove();
      if (!list.querySelector('.rrow')) addRow(kind); // keep at least one
      save();
    });
    row.addEventListener('input', save);
    return row;
  }
  function addRow(kind, v1, v2) {
    var list = document.querySelector('[data-repeatlist="' + kind + '"]');
    list.appendChild(makeRow(kind, v1, v2));
  }
  document.querySelectorAll('[data-addrow]').forEach(function (btn) {
    btn.addEventListener('click', function () { addRow(btn.getAttribute('data-addrow')); save(); });
  });

  function readRows(kind) {
    var out = [];
    document.querySelectorAll('[data-repeatlist="' + kind + '"] .rrow').forEach(function (r) {
      var a = r.querySelector('[data-col="1"]').value.trim();
      var b = r.querySelector('[data-col="2"]').value.trim();
      if (a || b) out.push({ a: a, b: b });
    });
    return out;
  }

  /* ===========================================================
     FILE UPLOADS
     =========================================================== */
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function isPreviewable(f) {
    return /^image\//.test(f.type) && f.type !== 'image/heic' && f.type !== 'image/heif';
  }
  function renderFiles(key) {
    var listEl = document.querySelector('[data-filelist="' + key + '"]');
    var field = listEl.closest('.field');
    listEl.innerHTML = '';
    var arr = files[key] || [];
    var imgs = [], docs = [];
    arr.forEach(function (f, i) { (isPreviewable(f) ? imgs : docs).push({ f: f, i: i }); });

    function removeBtn(i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'rm'; b.setAttribute('aria-label', 'Remove');
      b.innerHTML = X_ICON;
      b.addEventListener('click', function () { files[key].splice(i, 1); renderFiles(key); validateField(field); save(); });
      return b;
    }

    if (imgs.length) {
      var grid = document.createElement('div');
      grid.className = 'thumbs';
      imgs.forEach(function (o) {
        var t = document.createElement('div');
        t.className = 'thumb';
        var img = document.createElement('img');
        img.alt = o.f.name;
        try { img.src = URL.createObjectURL(o.f); } catch (e) {}
        t.appendChild(img);
        t.appendChild(removeBtn(o.i));
        grid.appendChild(t);
      });
      listEl.appendChild(grid);
    }
    docs.forEach(function (o) {
      var item = document.createElement('div');
      item.className = 'fileitem';
      item.innerHTML = FILE_ICON +
        '<span class="nm">' + escapeHtml(o.f.name) + '</span>' +
        '<span class="sz">' + fmtSize(o.f.size) + '</span>';
      item.appendChild(removeBtn(o.i));
      listEl.appendChild(item);
    });
  }
  document.querySelectorAll('[data-fileinput]').forEach(function (input) {
    var key = input.getAttribute('data-fileinput');
    var drop = document.querySelector('[data-drop="' + key + '"]');
    input.addEventListener('change', function () {
      var multiple = input.hasAttribute('multiple');
      var incoming = Array.prototype.slice.call(input.files);
      files[key] = multiple ? (files[key] || []).concat(incoming) : incoming;
      renderFiles(key);
      validateField(drop.closest('.field'));
      input.value = '';
    });
    ['dragover', 'dragenter'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (ev) {
      var multiple = input.hasAttribute('multiple');
      var incoming = Array.prototype.slice.call(ev.dataTransfer.files);
      files[key] = multiple ? (files[key] || []).concat(incoming) : incoming.slice(0, 1);
      renderFiles(key);
      validateField(drop.closest('.field'));
    });
  });

  /* ===========================================================
     COLOUR PICKER
     =========================================================== */
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    var a = s * Math.min(l, 1 - l);
    var f = function (n) {
      var k = (n + h / 30) % 12;
      var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      var x = Math.round(255 * c).toString(16);
      return x.length === 1 ? '0' + x : x;
    };
    return '#' + f(0) + f(8) + f(4);
  }
  function buildPaletteColours() {
    var hues = [230, 258, 286, 320, 344, 356, 14, 28, 42, 54, 84, 130, 158, 180, 196, 210];
    var Ls = [26, 34, 42, 50, 58, 66, 74, 82, 88, 93];
    var rows = [];
    hues.forEach(function (h) {
      rows.push(Ls.map(function (l, i) { return hslToHex(h, i >= 8 ? 60 : 76, l); }));
    });
    // neutral row (near-black → white)
    rows.push(Ls.map(function (l) { return hslToHex(220, 8, l); }));
    return rows;
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (x) { var h = x.toString(16); return h.length === 1 ? '0' + h : h; }).join('');
  }
  // Pull the dominant colours out of an uploaded logo, client-side via canvas.
  function extractLogoColours(file, cb) {
    if (!file || !/^image\//.test(file.type) || /heic|heif/.test(file.type)) { cb([]); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = 64, h = Math.max(1, Math.round(64 * (img.height || 1) / (img.width || 1)));
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      var ctx = cv.getContext('2d');
      var data;
      try { ctx.drawImage(img, 0, 0, w, h); data = ctx.getImageData(0, 0, w, h).data; }
      catch (e) { URL.revokeObjectURL(url); cb([]); return; }
      URL.revokeObjectURL(url);
      var buckets = {};
      for (var i = 0; i < data.length; i += 4) {
        var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;                          // transparent
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (mx > 244 && mn > 244) continue;             // near-white
        if (mx < 12) continue;                          // near-black
        var key = (r >> 4) + '-' + (g >> 4) + '-' + (b >> 4);
        var bk = buckets[key] || (buckets[key] = { c: 0, r: 0, g: 0, b: 0 });
        bk.c++; bk.r += r; bk.g += g; bk.b += b;
      }
      var arr = Object.keys(buckets).map(function (k) {
        var o = buckets[k];
        return { c: o.c, r: Math.round(o.r / o.c), g: Math.round(o.g / o.c), b: Math.round(o.b / o.c) };
      }).sort(function (x, y) { return y.c - x.c; });
      var picked = [];
      arr.forEach(function (o) {
        if (picked.length >= 5) return;
        var far = picked.every(function (p) {
          return Math.abs(p.r - o.r) + Math.abs(p.g - o.g) + Math.abs(p.b - o.b) > 60;
        });
        if (far) picked.push(o);
      });
      cb(picked.map(function (o) { return rgbToHex(o.r, o.g, o.b); }));
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb([]); };
    img.src = url;
  }

  function initColourPicker() {
    var pick = document.querySelector('[data-colourpick]');
    if (!pick) return;
    var grid = pick.querySelector('[data-palette]');
    var pickedWrap = pick.querySelector('[data-picked]');
    var hidden = document.getElementById('brand_colours');
    var pull = document.querySelector('[data-colourpull]');
    var msg = document.querySelector('[data-pullmsg]');
    var selected = [];

    // seed from any saved/restored value (ignore the old "pull" placeholder text)
    var existing = (hidden.value || '').trim();
    if (existing && existing !== 'Pull them from my logo') {
      selected = existing.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }

    function setMsg(text) {
      if (!msg) return;
      msg.textContent = text || '';
      msg.hidden = !text;
    }
    function update() {
      hidden.value = selected.join(', ');
      grid.querySelectorAll('.sw').forEach(function (b) {
        b.classList.toggle('sel', selected.indexOf(b.dataset.hex) > -1);
      });
      pickedWrap.innerHTML = '';
      selected.forEach(function (hex) {
        var c = document.createElement('span');
        c.className = 'chip';
        c.innerHTML = '<span class="dot" style="background:' + hex + '"></span>' + hex +
          '<button type="button" class="x" aria-label="Remove ' + hex + '">' + X_ICON + '</button>';
        c.querySelector('.x').addEventListener('click', function () {
          selected = selected.filter(function (x) { return x !== hex; });
          update();
        });
        pickedWrap.appendChild(c);
      });
      save();
    }
    function toggle(hex) {
      hex = hex.toLowerCase();
      var i = selected.indexOf(hex);
      if (i > -1) selected.splice(i, 1); else selected.push(hex);
      update();
    }

    // build the palette grid once
    buildPaletteColours().forEach(function (row) {
      row.forEach(function (hex) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'sw';
        b.dataset.hex = hex.toLowerCase();
        b.style.background = hex;
        b.setAttribute('aria-label', 'Colour ' + hex);
        b.addEventListener('click', function () { setMsg(''); toggle(hex); });
        grid.appendChild(b);
      });
    });

    // "Pull from my logo" → extract & auto-select the logo's colours
    pull.addEventListener('change', function () {
      if (!pull.checked) { setMsg(''); return; }
      var lf = (files.logo || [])[0];
      if (!lf) { pull.checked = false; setMsg('Upload your logo above first, then tick this and we’ll grab its colours.'); return; }
      setMsg('Reading the colours from your logo…');
      extractLogoColours(lf, function (hexes) {
        pull.checked = false; // it's an action, not a permanent state
        if (!hexes.length) { setMsg('Couldn’t read colours from that file — please tap a few above instead.'); return; }
        var added = 0;
        hexes.forEach(function (h) { h = h.toLowerCase(); if (selected.indexOf(h) === -1) { selected.push(h); added++; } });
        update();
        setMsg(added ? ('Pulled ' + added + ' colour' + (added > 1 ? 's' : '') + ' from your logo — tweak them above if you like.')
                     : 'Those colours are already selected above.');
      });
    });

    update();
  }

  /* ===========================================================
     CONDITIONAL REVEALS
     =========================================================== */
  function syncReveals() {
    document.querySelectorAll('[data-revealfor]').forEach(function (rev) {
      var name = rev.getAttribute('data-revealfor');
      var whens = rev.getAttribute('data-revealwhen').split(',');
      var checked = form.querySelector('input[name="' + name + '"]:checked');
      var on = checked && whens.indexOf(checked.value) > -1;
      rev.classList.toggle('show', !!on);
    });
  }

  /* ===========================================================
     "WRITE IT FOR ME" assist — disable the textarea when ticked
     =========================================================== */
  document.querySelectorAll('[data-assist]').forEach(function (cb) {
    var target = document.getElementById(cb.getAttribute('data-assist'));
    cb.addEventListener('change', function () {
      target.disabled = cb.checked;
      if (cb.checked) target.value = '';
      save();
    });
  });

  /* ===========================================================
     VALIDATION
     =========================================================== */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function validateField(field) {
    if (!field || !field.hasAttribute('data-required')) return true;
    var key = field.getAttribute('data-key');
    var ok = true;

    if (field.hasAttribute('data-file')) {
      ok = (files[key] || []).length > 0;
    } else if (field.hasAttribute('data-repeat')) {
      ok = readRows(field.getAttribute('data-repeat')).length > 0;
    } else {
      var radios = field.querySelectorAll('input[type=radio]');
      var checks = field.querySelectorAll('input[type=checkbox]');
      if (checks.length) {
        ok = field.querySelector('input[type=checkbox]:checked') != null;
      } else if (radios.length) {
        ok = field.querySelector('input[type=radio]:checked') != null;
      } else {
        var inp = field.querySelector('input[type=text],input[type=email],input[type=tel],input[type=url],textarea,select');
        var val = inp ? inp.value.trim() : '';
        ok = val.length > 0;
        if (ok && inp && inp.type === 'email') ok = isEmail(val);
      }
    }
    field.classList.toggle('invalid', !ok);
    return ok;
  }

  function validateStep(stepEl) {
    var firstBad = null;
    stepEl.querySelectorAll('.field[data-required]').forEach(function (f) {
      // skip required fields inside an un-shown reveal
      var rev = f.closest('.reveal');
      if (rev && !rev.classList.contains('show')) return;
      if (!validateField(f) && !firstBad) firstBad = f;
    });
    if (firstBad) {
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var foc = firstBad.querySelector('input,textarea,select');
      if (foc) try { foc.focus({ preventScroll: true }); } catch (e) {}
    }
    return !firstBad;
  }

  // clear invalid state as the user fixes it
  form.addEventListener('input', function (e) {
    var f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) validateField(f);
  });
  form.addEventListener('change', function (e) {
    if (e.target.matches('input[type=radio]')) syncReveals();
    var f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) validateField(f);
    save();
  });

  /* ===========================================================
     NAVIGATION
     =========================================================== */
  function buildStepper() {
    steps.forEach(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.go = i;
      b.innerHTML = '<span class="dot">' + (i === steps.length - 1
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
        : (i)) + '</span><span>' + s.getAttribute('data-title') + '</span>';
      b.addEventListener('click', function () {
        if (i <= maxReached) goTo(i);
      });
      stepperEl.appendChild(b);
    });
  }

  function updateChrome() {
    var total = steps.length;
    trackFill.style.width = ((current) / (total - 1) * 100) + '%';
    stepLabel.textContent = steps[current].getAttribute('data-title').replace(/&amp;/g, '&');
    stepCount.textContent = 'Step ' + (current + 1) + ' of ' + total;

    backBtn.hidden = current === 0;
    var isReview = current === total - 1;
    nextBtn.innerHTML = isReview
      ? 'Send my brief <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
      : 'Continue <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
    footHint.textContent = isReview ? 'Tick the box, then send' : 'Your answers save as you go';

    Array.prototype.forEach.call(stepperEl.children, function (b, i) {
      b.classList.toggle('active', i === current);
      b.classList.toggle('done', i < maxReached && i !== current);
      b.disabled = i > maxReached;
    });
  }

  function goTo(i) {
    if (i === current) return;
    steps[current].classList.remove('is-active');
    current = i;
    maxReached = Math.max(maxReached, current);
    steps[current].classList.add('is-active');
    if (current === steps.length - 1) renderReview();
    syncReveals();
    updateChrome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    save();
  }

  nextBtn.addEventListener('click', function () {
    var isReview = current === steps.length - 1;
    if (isReview) { submitBrief(); return; }
    if (!validateStep(steps[current])) return;
    goTo(current + 1);
  });
  backBtn.addEventListener('click', function () { if (current > 0) goTo(current - 1); });

  // Enter advances (except inside textareas)
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  /* ===========================================================
     AUTOSAVE (text only — files can't be persisted in localStorage)
     =========================================================== */
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var data = collectText();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: current, max: maxReached, data: data }));
        flashSaved();
      } catch (e) {}
    }, 350);
  }
  function flashSaved() {
    savePill.hidden = false;
    savePill.style.opacity = '1';
    clearTimeout(flashSaved._t);
    flashSaved._t = setTimeout(function () { savePill.style.opacity = '0'; }, 1600);
  }

  function collectText() {
    var d = {};
    form.querySelectorAll('input,textarea,select').forEach(function (el) {
      if (el.type === 'file' || !el.name) return;
      if (el.type === 'checkbox') {
        if (el.checked) { (d[el.name] = d[el.name] || []).push(el.value); }
      } else if (el.type === 'radio') {
        if (el.checked) d[el.name] = el.value;
      } else {
        if (el.value.trim()) d[el.name] = el.value;
      }
    });
    d.__services = readRows('services');
    d.__faqs = readRows('faqs');
    return d;
  }

  function restore() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    var saved = raw ? JSON.parse(raw) : null;
    var d = saved && saved.data ? saved.data : {};

    Object.keys(d).forEach(function (name) {
      if (name === '__services' || name === '__faqs') return;
      var val = d[name];
      var els = form.querySelectorAll('[name="' + name + '"]');
      if (!els.length) return;
      if (els[0].type === 'checkbox') {
        els.forEach(function (el) { el.checked = Array.isArray(val) && val.indexOf(el.value) > -1; });
      } else if (els[0].type === 'radio') {
        els.forEach(function (el) { el.checked = el.value === val; });
      } else {
        els[0].value = val;
      }
    });
    // assists
    document.querySelectorAll('[data-assist]').forEach(function (cb) {
      var t = document.getElementById(cb.getAttribute('data-assist'));
      if (cb.checked) t.disabled = true;
    });
    // rows
    (d.__services && d.__services.length ? d.__services : [{}]).forEach(function (r) { addRow('services', r.a, r.b); });
    (d.__faqs && d.__faqs.length ? d.__faqs : [{}]).forEach(function (r) { addRow('faqs', r.a, r.b); });

    if (saved && typeof saved.max === 'number') maxReached = saved.max;
  }

  /* ===========================================================
     REVIEW SCREEN
     =========================================================== */
  var REVIEW_MAP = [
    { step: 0, title: 'Welcome', rows: [['Your name', 'contact_name'], ['Your email', 'contact_filling_email']] },
    { step: 1, title: '1 · The basics', rows: [['Business name', 'business_name'], ['Tagline', 'tagline'], ['What you do', 'what_you_do'], ['Established', 'established'], ['Primary goal', 'primary_goal']] },
    { step: 2, title: '2 · Brand & assets', rows: [['Logo', '@logo'], ['Brand colours', 'brand_colours'], ['Brand guidelines', '@brand_guidelines'], ['Photos', '@photos']] },
    { step: 3, title: '3 · Look & feel', rows: [['Styles they like', 'sample_designs'], ['Sites they like', 'sites_you_like'], ['Sites they dislike', 'sites_you_dislike'], ['Style leaning', 'style_leaning'], ['Font choice', 'font_personality']] },
    { step: 4, title: '4 · What you offer', rows: [['Services / products', '#services'], ['Pricing approach', 'pricing'], ['Prices', 'pricing_detail']] },
    { step: 5, title: '5 · Proof & trust', rows: [['Reviews', 'reviews_choice'], ['Pasted reviews', 'reviews_pasted'], ['Google business name', 'google_business_name'], ['Google rating', 'google_rating'], ['Accreditations', 'accreditations'], ['Guarantees', 'guarantees'], ['Real numbers', 'real_numbers']] },
    { step: 6, title: '6 · Words', rows: [['About / story', 'about_story|about_story_writeforme'], ['FAQs', '#faqs|faqs_suggest']] },
    { step: 7, title: '7 · Local & SEO', rows: [['Areas covered', 'areas_covered'], ['Main search term', 'search_term'], ['Competitors', 'competitors']] },
    { step: 8, title: '8 · Features', rows: [['Features', 'features']] },
    { step: 9, title: '9 · Contact & practical', rows: [['Phone', 'phone'], ['Email', 'public_email'], ['Address', 'address'], ['Opening hours', 'opening_hours'], ['WhatsApp', 'whatsapp'], ['Socials', 'socials'], ['Enquiries go to', 'enquiry_email'], ['Domain & hosting', 'domain']] },
    { step: 10, title: '10 · Logistics', rows: [['Deadline', 'deadline'], ['Avoid', 'avoid'], ['Anything else', 'anything_else']] }
  ];

  function valueFor(token) {
    var d = collectText();
    // combine with a fallback field, e.g. "about_story|about_story_writeforme"
    var parts = token.split('|');
    var primary = parts[0];
    var fallback = parts[1];

    var v = '';
    if (primary[0] === '@') {
      var k = primary.slice(1);
      var fl = files[k] || [];
      v = fl.length ? fl.map(function (f) { return f.name; }).join(', ') : '';
    } else if (primary[0] === '#') {
      var rows = readRows(primary.slice(1));
      v = rows.map(function (r) { return r.b ? r.a + ' — ' + r.b : r.a; }).join('\n');
    } else {
      var raw = d[primary];
      v = Array.isArray(raw) ? raw.join(', ') : (raw || '');
    }
    if (!v && fallback && d[fallback]) v = d[fallback];
    return v;
  }

  function renderReview() {
    var html = '';
    REVIEW_MAP.forEach(function (sec) {
      var rowsHtml = '';
      sec.rows.forEach(function (r) {
        var v = valueFor(r[1]);
        var empty = !v;
        rowsHtml += '<div><dt>' + r[0] + '</dt><dd class="' + (empty ? 'empty' : '') + '">' +
          (empty ? '—' : escapeHtml(v)) + '</dd></div>';
      });
      html += '<div class="review-block">' +
        '<div class="rh"><b>' + sec.title + '</b>' +
        '<button type="button" data-edit="' + sec.step + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>Edit</button></div>' +
        '<dl>' + rowsHtml + '</dl></div>';
    });
    reviewOut.innerHTML = html;
    reviewOut.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { goTo(parseInt(b.getAttribute('data-edit'), 10)); });
    });
  }

  /* ===========================================================
     SUBMIT
     =========================================================== */
  function buildSummaryText() {
    var lines = ['KENT WEB DESIGN — NEW PROJECT ONBOARDING', '========================================', ''];
    REVIEW_MAP.forEach(function (sec) {
      lines.push(sec.title.replace(/&/g, 'and'));
      sec.rows.forEach(function (r) {
        var v = valueFor(r[1]) || '—';
        lines.push('  ' + r[0] + ': ' + v.replace(/\n/g, '\n      '));
      });
      lines.push('');
    });
    return lines.join('\n');
  }

  function submitBrief() {
    if (!consent.checked) {
      consent.parentNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      consent.parentNode.style.borderColor = 'var(--err)';
      return;
    }
    showOverlay('<div class="spinner"></div><h3 style="margin:0;font-family:var(--display);font-weight:500">Sending your brief…</h3><p class="muted" style="margin:.4em 0 0">Uploading your files, one moment.</p>');

    // Upload any files straight to storage, then save the brief (with the file
    // references) to the Kent Web Design portal database.
    uploadFiles()
      .then(function (uploaded) {
        var d = collectText();
        d.__files = uploaded;
        return fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(d)
        });
      })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
      .then(function (r) {
        if (r.ok && r.j && r.j.success !== false) { onSuccess(); }
        else { throw new Error((r.j && r.j.message) || 'Submission failed'); }
      })
      .catch(function () { onError(); });
  }

  // For each chosen file: ask the portal for a one-time upload URL, then PUT the
  // file directly to storage. Returns { logo:[...], brand_guidelines:[...], photos:[...] }.
  function uploadFiles() {
    var fields = ['logo', 'brand_guidelines', 'photos'];
    var uploaded = { logo: [], brand_guidelines: [], photos: [] };
    var jobs = [];
    fields.forEach(function (field) {
      (files[field] || []).forEach(function (f) {
        var type = f.type || 'application/octet-stream';
        var job = fetch('/api/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.name, type: type, field: field })
        })
          .then(function (res) { return res.json(); })
          .then(function (j) {
            if (!j.url) throw new Error('No upload URL');
            return fetch(j.url, { method: 'PUT', headers: { 'Content-Type': type }, body: f })
              .then(function (put) {
                if (!put.ok) throw new Error('Upload failed');
                uploaded[field].push({ key: j.key, name: f.name, type: type, size: f.size });
              });
          });
        jobs.push(job);
      });
    });
    return Promise.all(jobs).then(function () { return uploaded; });
  }

  function onSuccess() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    hideOverlay();
    var d = collectText();
    document.getElementById('doneName').textContent = d.contact_name ? d.contact_name + '!' : '— that’s everything!';
    form.style.display = 'none';
    document.getElementById('obFoot').style.display = 'none';
    document.getElementById('progressBar').style.display = 'none';
    stepperEl.style.display = 'none';
    doneScreen.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onError(note) {
    var summary = buildSummaryText();
    var mailHref = 'mailto:' + SUBMIT_EMAIL + '?subject=' +
      encodeURIComponent('My website brief') + '&body=' + encodeURIComponent(summary);
    overlayCard.innerHTML =
      '<h3 style="margin:0 0 .4em;font-family:var(--display);font-weight:500">Couldn’t send automatically</h3>' +
      '<p class="muted" style="margin:0">' + (note ? escapeHtml(note) + ' ' : '') + 'No problem — your answers are safe. Send them to us with either button below, then we’ll sort the files.</p>' +
      '<div class="err-actions">' +
      '<a class="btn btn-accent" href="' + mailHref + '">Email my answers to us</a>' +
      '<button class="btn btn-line" type="button" id="dlBtn">Download my answers</button>' +
      '<button class="btn btn-ghost" type="button" id="retryBtn">Try again</button>' +
      '</div>';
    document.getElementById('retryBtn').addEventListener('click', function () { hideOverlay(); submitBrief(); });
    document.getElementById('dlBtn').addEventListener('click', function () {
      var blob = new Blob([summary], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'kent-web-design-brief.txt';
      a.click();
    });
  }

  function showOverlay(html) { overlayCard.innerHTML = html; overlay.classList.add('show'); }
  function hideOverlay() { overlay.classList.remove('show'); }

  /* ----------------------------- util ----------------------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----------------------------- init ----------------------------- */
  buildStepper();
  restore();
  initColourPicker();
  syncReveals();
  updateChrome();
})();
