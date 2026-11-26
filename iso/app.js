(function () {
  'use strict';
  var DEPTS = [
    { k: 'QA', h: 'dept-qa' }, { k: 'QC', h: 'dept-qc' }, { k: 'HR', h: 'dept-hr' },
    { k: 'الإنتاج', h: 'dept-pr' }, { k: 'المعمل', h: 'dept-lb' }, { k: 'الصيانة', h: 'dept-mt' },
    { k: 'السلامة والصحة المهنية والبيئة', h: 'dept-se' }, { k: 'المشتريات', h: 'dept-pu' }, { k: 'المخازن والخزينة', h: 'dept-wh' }
  ];
  var SE = 'السلامة والصحة المهنية والبيئة';
  var KIND = { procedure: 'إجراء', manual: 'دليل', policy: 'سياسة', plan: 'خطة', wi: 'تعليمات عمل', form: 'نموذج', record: 'سجل مملوء', external: 'وثيقة خارجية', attach: 'مرفق' };
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var OFFICE = { docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', doc: 'Word' };
  var UP_TYPES = { 'application/pdf': 1, 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1, 'image/gif': 1 };
  var EXT_TYPE = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  var FREQ = [['', 'غير محددة'], ['daily', 'يومي'], ['weekly', 'أسبوعي'], ['monthly', 'شهري'], ['quarterly', 'ربع سنوي'], ['yearly', 'سنوي'], ['event', 'عند الحدوث']];
  var FST = [['open', 'مفتوحة', 'bad'], ['prog', 'جارٍ العمل', 'warn'], ['done', 'أُغلقت', 'good']];
  var NOW = new Date(), CY = NOW.getFullYear(), CM = NOW.getMonth() + 1;

  var S = { docs: [], byId: {}, byCode: {}, extra: null, arch: [], na: [], cfg: {}, find: {}, exp: [], roles: {}, names: {}, archState: 'wait', tab: {}, q: '', dq: {}, tq: '', auditor: false,
    cap: { db: null, assets: null, downloads: null, user: null, canEdit: false, uid: '' } };
  try { S.auditor = localStorage.getItem('gem-auditor') === '1'; } catch (e) { }
  var $ = function (id) { return document.getElementById(id); };
  var view = $('view');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function title(r) { return r.t || r.n; }
  function isArchivable(r) { return r.k === 'form' || r.k === 'plan'; }
  function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('on'); }, ms || 4200); }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' م.ب' : Math.max(1, Math.round(n / 1024)) + ' ك.ب'; }
  function fmtDate(s) { if (!s) return ''; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function archOf(id) { return S.arch.filter(function (a) { return a.doc === id; }); }
  function naOf(id) { return S.na.filter(function (a) { return a.doc === id; }); }
  function packCount(code) { if (!code) return 0; var n = 0; for (var i = 0; i < S.docs.length; i++) if (S.docs[i].pc === code) n++; return n; }
  function myDepts() { return S.roles[S.cap.uid] || []; }
  function canWrite() { return !S.auditor && !!S.cap.db && (S.cap.canEdit || myDepts().length > 0); }
  function canWriteDept(d) { return !S.auditor && !!S.cap.db && (S.cap.canEdit || myDepts().indexOf(d) >= 0); }
  function canUp(r) { return !!S.cap.assets && canWriteDept(r.d); }
  function canAdmin() { return !S.auditor && !!S.cap.db && S.cap.canEdit; }

  /* ---------- data ---------- */
  function load() {
    return Promise.all([
      fetch('data/docs.json').then(function (r) { return r.json(); }),
      fetch('data/extra.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      S.docs = res[0]; S.extra = res[1];
      S.docs.forEach(function (r) {
        S.byId[r.i] = r;
        if (r.c && r.k !== 'record' && (!S.byCode[r.c] || S.byCode[r.c].k === 'attach')) S.byCode[r.c] = r;
      });
      S.extra.audit.forEach(function (g, gi) { g.items.forEach(function (f, ii) { f.id = 'f' + gi + '-' + ii; var d = f.r.length && S.byCode[f.r[0]]; f.d = d ? d.d : ''; }); });
    });
  }
  function allFindings() { var a = []; S.extra.audit.forEach(function (g) { g.items.forEach(function (f) { a.push(f); }); }); return a; }
  function fState(f) { return (S.find[f.id] && S.find[f.id].st) || 'open'; }

  function initCaps() {
    if (!window.claude || !window.claude.use) { S.archState = 'off'; return; }
    var use = function (n) { return window.claude.use(n).catch(function () { return null; }); };
    use('downloads').then(function (d) { S.cap.downloads = d; });
    use('user').then(function (u) {
      S.cap.user = u; if (!u) return;
      Promise.resolve(u.canEdit()).then(function (v) { S.cap.canEdit = !!v; render(); }).catch(function () { });
      Promise.resolve(u.id()).then(function (v) { S.cap.uid = v || ''; render(); }).catch(function () { });
    });
    use('assets').then(function (a) { S.cap.assets = a; render(); });
    var timer = setTimeout(function () { if (S.archState === 'wait') { S.archState = 'slow'; render(); } }, 10000);
    use('db').then(function (db) {
      S.cap.db = db;
      if (!db) { clearTimeout(timer); S.archState = 'off'; render(); return; }
      var rows = function (snap) { return snap.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }); };
      db.collection('archive').onSnapshot(function (snap) {
        S.arch = rows(snap); if (!snap.metadata.fromCache) clearTimeout(timer); S.archState = 'ok'; render();
      }, function () { clearTimeout(timer); S.archState = 'off'; render(); });
      var quiet = function () { };
      db.collection('na').onSnapshot(function (s) { S.na = rows(s); render(); }, quiet);
      db.collection('formcfg').onSnapshot(function (s) { S.cfg = {}; rows(s).forEach(function (r) { S.cfg[r.id] = r; }); render(); }, quiet);
      db.collection('findings').onSnapshot(function (s) { S.find = {}; rows(s).forEach(function (r) { S.find[r.id] = r; }); render(); }, quiet);
      db.collection('versions').onSnapshot(function (s) { S.vers = rows(s); render(); }, quiet);
      db.collection('expiry').onSnapshot(function (s) { S.exp = rows(s); render(); }, quiet);
      db.collection('roles').onSnapshot(function (s) { S.roles = {}; rows(s).forEach(function (r) { S.roles[r.id] = Array.isArray(r.depts) ? r.depts : []; }); resolveNames(); render(); }, quiet);
    });
  }
  function resolveNames() {
    var ids = Object.keys(S.roles); if (!ids.length || !S.cap.user) return;
    Promise.resolve(S.cap.user.profiles(ids)).then(function (ps) { ids.forEach(function (i) { S.names[i] = (ps[i] && ps[i].name) || ''; }); render(); }).catch(function () { });
  }

  /* ---------- period logic ---------- */
  function freqOf(r) { return (S.cfg[r.i] && S.cfg[r.i].freq) || ''; }
  function inPeriod(x, f) { if (f === 'yearly') return x.y === CY; if (f === 'quarterly') return x.y === CY && Math.floor((x.m - 1) / 3) === Math.floor((CM - 1) / 3); return x.y === CY && x.m === CM; }
  function periodName(f) { return f === 'yearly' ? 'سنة ' + CY : f === 'quarterly' ? 'الربع ' + (Math.floor((CM - 1) / 3) + 1) + ' من ' + CY : MONTHS[CM - 1] + ' ' + CY; }
  function evStatus(r) {
    var a = archOf(r.i), n = naOf(r.i), p = packCount(r.c), f = freqOf(r), o = { a: a, n: n, p: p, f: f };
    if (f && f !== 'event') {
      if (a.some(function (x) { return inPeriod(x, f); })) { o.cls = 'good'; o.txt = 'مؤرشف عن ' + periodName(f); o.ready = true; }
      else if (n.some(function (x) { return inPeriod(x, f); })) { o.cls = ''; o.txt = 'لا ينطبق عن ' + periodName(f); o.ready = true; }
      else { o.cls = 'bad'; o.txt = 'متأخر عن ' + periodName(f); o.late = true; }
      return o;
    }
    if (a.length) { o.cls = 'good'; o.txt = 'له سجل في الأرشيف'; o.ready = true; }
    else if (n.length) { o.cls = ''; o.txt = 'لا ينطبق'; o.ready = true; }
    else if (p) { o.cls = 'form'; o.txt = 'سجلات مملوءة ضمن الملف'; o.ready = true; }
    else { o.cls = 'warn'; o.txt = 'لا يوجد سجل مؤرشف'; }
    return o;
  }
  function deptStats(k) {
    var d = S.docs.filter(function (r) { return r.d === k; }), f = d.filter(isArchivable), ready = 0, late = 0;
    f.forEach(function (r) { var s = evStatus(r); if (s.ready) ready++; if (s.late) late++; });
    var fs = allFindings().filter(function (x) { return x.d === k; }), done = fs.filter(function (x) { return fState(x) === 'done'; }).length;
    var pf = f.length ? Math.round(100 * ready / f.length) : 100, pn = fs.length ? Math.round(100 * done / fs.length) : null;
    return { all: d.length, forms: f.length, ready: ready, late: late, none: f.length - ready, arch: S.arch.filter(function (a) { return a.d === k; }).length, fs: fs.length, done: done, pf: pf, pn: pn, score: pn == null ? pf : Math.round((pf + pn) / 2) };
  }
  function expItems() {
    var a = (S.extra.expiry || []).map(function (x) { return { name: x.name, d: x.d, date: x.date, note: 'من ' + x.src, fixed: true }; }).concat(S.exp.map(function (x) { return { id: x.id, name: x.name, d: x.d, date: x.date, note: x.note }; }));
    a.forEach(function (x) { x.days = Math.round((new Date(x.date + 'T00:00:00') - new Date(CY, CM - 1, NOW.getDate())) / 86400000); });
    return a.sort(function (p, q) { return p.days - q.days; });
  }

  /* ---------- files ---------- */
  var zipCache = {};
  function getZip(z) {
    if (!zipCache[z]) zipCache[z] = fetch('/_blob/' + S.extra.zips[z]).then(function (r) { if (!r.ok) throw new Error('zip'); return r.arrayBuffer(); }).then(function (b) { return JSZip.loadAsync(b); }).catch(function (e) { delete zipCache[z]; throw e; });
    return zipCache[z];
  }
  function origBlob(r) { return getZip(r.z).then(function (zip) { var f = zip.file(r.i + '.' + r.e); if (!f) throw 0; return f.async('blob'); }); }
  function save(filename, data, okMsg) {
    if (!S.cap.downloads) { toast('الحفظ غير متاح.'); return Promise.resolve(false); }
    return S.cap.downloads.save({ filename: filename, data: data }).then(function () { toast(okMsg || 'تم الحفظ.'); return true; }).catch(function (e) {
      var c = e && e.code;
      if (c === 'declined') return false;
      toast(c === 'rate_limited' ? 'يوجد طلب حفظ مفتوح. أكمله ثم حاول مرة أخرى.' : c === 'host_unavailable' ? 'هذا التطبيق لا يحفظ الملفات. افتح النظام من المتصفح على الكمبيوتر.' : 'تعذر حفظ الملف. حاول مرة أخرى.');
      return false;
    });
  }
  function pdfUrl(r) { return 'pdf/' + r.i + '.pdf'; }
  function savePdf(r) {
    toast('جارٍ تجهيز الملف…', 15000);
    return fetch(pdfUrl(r)).then(function (x) { if (!x.ok) throw 0; return x.blob(); }).then(function (b) { return save(r.n + '.pdf', b, 'حُفظ ملف PDF.'); }).catch(function () { toast('تعذر تحميل الملف. تحقق من الاتصال وحاول مرة أخرى.'); });
  }
  function saveOriginal(r, blank) {
    toast('جارٍ تجهيز الملف الأصلي…', 20000);
    if (r.e === 'pdf') return savePdf(r);
    if (r.e === 'jpeg') return fetch('img/' + r.i + '.jpeg').then(function (x) { return x.blob(); }).then(function (b) { return save(r.n + '.jpeg', b, 'حُفظت الصورة.'); }).catch(function () { toast('تعذر تحميل الملف.'); });
    return origBlob(r).then(function (b) {
      if (r.e !== 'doc') return save(r.n + '.' + r.e, b, blank ? 'حُفظ النموذج الأصلي ' + OFFICE[r.e] + '. افتحه واطبعه.' : 'حُفظ الملف الأصلي (' + OFFICE[r.e] + ').');
      var z = new JSZip(); z.file(r.n + '.doc', b);
      return z.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(function (zb) { return save(r.n + '.zip', zb, 'حُفظ الملف الأصلي داخل ملف مضغوط.'); });
    }).catch(function () { toast('تعذر تحميل الملف الأصلي. تحقق من الاتصال وحاول مرة أخرى.'); });
  }
  function saveDeptForms(k) {
    var forms = S.docs.filter(function (r) { return r.d === k && r.k === 'form' && r.z; });
    if (!forms.length) { toast('لا توجد نماذج في هذا القسم.'); return; }
    toast('جارٍ تجميع ' + forms.length + ' نموذج…', 60000);
    var z = new JSZip(), used = {};
    Promise.all(forms.map(function (r) { return origBlob(r).then(function (b) { var nm = r.n + '.' + r.e; if (used[nm]) nm = r.n + ' (' + r.i + ').' + r.e; used[nm] = 1; z.file(nm, b); }); }))
      .then(function () { return z.generateAsync({ type: 'blob' }); })
      .then(function (b) { return save('نماذج فارغة - ' + k + '.zip', b, 'حُفظت نماذج القسم الفارغة (' + forms.length + ') في ملف واحد.'); })
      .catch(function () { toast('تعذر تجميع النماذج. تحقق من الاتصال وحاول مرة أخرى.'); });
  }

  /* ---------- stored files (archive, versions) ---------- */
  function b64(buf) { var u = new Uint8Array(buf), o = '', i; for (i = 0; i < u.length; i += 0x8000) o += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(o); }
  function storeFile(f) {
    var ext = (f.name.split('.').pop() || '').toLowerCase(), ty = UP_TYPES[f.type] ? f.type : EXT_TYPE[ext];
    if (ty) return S.cap.assets.upload(f, { type: ty }).then(function (res) { return { asset: res.id, ct: res.contentType, size: res.sizeBytes, name: f.name }; });
    return f.arrayBuffer().then(function (buf) { return S.cap.assets.upload(new Blob([b64(buf)], { type: 'text/plain' }), { type: 'text/plain' }); }).then(function (res) { return { asset: res.id, ct: ext, enc: 'b64', size: f.size, name: f.name }; });
  }
  function recBlob(a) {
    return fetch('/_blob/' + a.asset).then(function (x) { if (!x.ok) throw 0; return a.enc === 'b64' ? x.text() : x.blob(); }).then(function (v) {
      if (a.enc !== 'b64') return v;
      var bin = atob(v), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u]);
    });
  }
  function recViewable(a) { return !a.enc && (a.ct === 'application/pdf' || /^image\//.test(a.ct || '')); }
  function recSave(a) {
    toast('جارٍ تجهيز الملف…', 15000);
    recBlob(a).then(function (bl) { var ext = a.enc ? a.ct : a.ct === 'application/pdf' ? 'pdf' : (a.ct || '').split('/')[1] || 'jpg', nm = a.name && /\.[a-z0-9]{2,5}$/i.test(a.name) ? a.name : (a.name || 'record') + '.' + ext; return save(nm, bl, 'حُفظ الملف.'); }).catch(function () { toast('تعذر تحميل الملف.'); });
  }
  function recOpen(a) { if (recViewable(a)) openViewer({ title: a.name, url: '/_blob/' + a.asset, type: a.ct === 'application/pdf' ? 'pdf' : 'img' }); else recSave(a); }
  function dayOf(a) { return a.rd || (a.y + '-' + ('0' + a.m).slice(-2) + '-00'); }
  function dayLabel(k) { var p = k.split('-'); return p[2] === '00' ? MONTHS[+p[1] - 1] + ' ' + p[0] : (+p[2]) + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function amatch(a, q) { if (!q) return true; var r = S.byId[a.doc] || {}; return [a.name, a.no, a.note, a.rd, fmtDate(a.rd), r.c, r.t, r.n].join(' ').toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  function daysHtml(list, showDoc) {
    var days = {}; list.forEach(function (x) { (days[dayOf(x)] = days[dayOf(x)] || []).push(x); });
    return Object.keys(days).sort().reverse().map(function (k) {
      return '<div class="arch-m"><div><b class="num">' + dayLabel(k) + '</b> <small class="num" style="color:var(--muted)">' + days[k].length + ' ملف</small></div>' + days[k].map(function (x) { return afile(x, showDoc); }).join('') + '</div>';
    }).join('');
  }

  /* ---------- viewer ---------- */
  var vTok = 0, vObs = null;
  function closeViewer() { vTok++; if (vObs) { vObs.disconnect(); vObs = null; } $('viewer').classList.remove('on'); $('vpages').innerHTML = ''; }
  function openViewer(o) {
    var tok = ++vTok, pages = $('vpages');
    $('vtitle').textContent = o.title; $('vinfo').textContent = ''; pages.innerHTML = '<p class="empty">جارٍ فتح الورقة…</p>';
    var acts = '';
    if (o.doc) {
      if (o.doc.e !== 'pdf') acts += '<button class="btn pri" data-act="' + (o.doc.k === 'form' ? 'blank' : 'orig') + '" data-id="' + o.doc.i + '">' + (o.doc.k === 'form' ? 'تحميل الأصل للطباعة' : 'تحميل الأصل' + (OFFICE[o.doc.e] ? ' ' + OFFICE[o.doc.e] : '')) + '</button>';
      if (o.doc.e !== 'jpeg') acts += '<button class="btn" data-act="pdf" data-id="' + o.doc.i + '">حفظ PDF</button>';
    }
    acts += '<button class="btn" data-act="closev">إغلاق</button>';
    $('vacts').innerHTML = acts; $('viewer').classList.add('on');
    if (o.type === 'img') { pages.innerHTML = ''; var im = new Image(); im.alt = o.title; im.src = o.url; pages.appendChild(im); return; }
    if (!window.pdfjsLib) { pages.innerHTML = '<p class="empty">تعذر تشغيل عارض PDF. استخدم زر الحفظ.</p>'; return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    pdfjsLib.getDocument({ url: o.url, disableFontFace: true, isEvalSupported: false }).promise.then(function (pdf) {
      if (tok !== vTok) return;
      pages.innerHTML = ''; $('vinfo').textContent = pdf.numPages + ' صفحة';
      var avail = Math.min(pages.clientWidth - 32, 1100), dpr = Math.min(window.devicePixelRatio || 1, 2);
      vObs = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting || en.target._done) return; en.target._done = 1;
          var cv = en.target;
          pdf.getPage(+cv.dataset.p).then(function (pg) {
            if (tok !== vTok) return;
            var vp = pg.getViewport({ scale: 1 }), sc = Math.min(avail / vp.width, 1.6), v2 = pg.getViewport({ scale: sc * dpr });
            cv.width = v2.width; cv.height = v2.height; cv.style.width = (vp.width * sc) + 'px'; cv.style.height = 'auto';
            pg.render({ canvasContext: cv.getContext('2d'), viewport: v2 });
          });
        });
      }, { root: pages, rootMargin: '600px 0px' });
      pdf.getPage(1).then(function (p1) {
        if (tok !== vTok) return;
        var vp = p1.getViewport({ scale: 1 }), sc = Math.min(avail / vp.width, 1.6);
        for (var i = 1; i <= pdf.numPages; i++) {
          var cv = document.createElement('canvas'); cv.dataset.p = i; cv.width = 10; cv.height = 10;
          cv.style.width = (vp.width * sc) + 'px'; cv.style.height = (vp.height * sc) + 'px';
          pages.appendChild(cv); vObs.observe(cv);
        }
      });
    }).catch(function () { if (tok === vTok) pages.innerHTML = '<p class="empty">تعذر فتح الورقة. تحقق من الاتصال، أو استخدم زر الحفظ.</p>'; });
  }
  function viewDoc(r) { openViewer(r.e === 'jpeg' ? { title: title(r), url: 'img/' + r.i + '.jpeg', type: 'img', doc: r } : { title: (r.c ? r.c + ' · ' : '') + title(r), url: pdfUrl(r), type: 'pdf', doc: r }); }

  /* ---------- dialogs ---------- */
  function dlg(html) { $('sheet').innerHTML = html; $('dlg').classList.add('on'); }
  function closeDlg() { $('dlg').classList.remove('on'); $('sheet').innerHTML = ''; }
  function today() { return CY + '-' + ('0' + CM).slice(-2) + '-' + ('0' + NOW.getDate()).slice(-2); }
  function monthOpts() { return MONTHS.map(function (m, i) { return '<option value="' + (i + 1) + '"' + (i + 1 === CM ? ' selected' : '') + '>' + (i + 1) + ' · ' + m + '</option>'; }).join(''); }
  var preset = null;
  function openUpload(r, pre) {
    preset = pre || null;
    dlg('<h2>حفظ سجل في الأرشيف</h2><div><span class="code">' + esc(r.c) + '</span> ' + esc(title(r)) + '</div>' +
      '<div class="two"><label>تاريخ السجل<input id="up-d" type="date" value="' + today() + '"></label><label>رقم السجل أو التشغيلة<input id="up-no" type="text" maxlength="60" placeholder="مثال: رقم الإذن أو كود التشغيلة"></label></div>' +
      (preset ? '<div class="note">سيُحفظ النموذج الذي سجّلت عليه البيانات كملف PDF.</div>' : '<label>الملفات (Word أو Excel أو PDF أو صورة)<input id="up-f" type="file" multiple></label>') +
      '<label>ملاحظة (اختياري)<input id="up-n" type="text" maxlength="200"></label>' +
      '<div id="up-s" class="num" style="color:var(--muted);min-height:1.4em"></div>' +
      '<div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" id="up-go" data-act="doup" data-id="' + r.i + '">حفظ في الأرشيف</button></div>');
  }
  function doUpload(r) {
    var files = preset ? [preset] : Array.prototype.slice.call($('up-f').files || []), dt = $('up-d').value, note = $('up-n').value.trim(), no = $('up-no').value.trim(), st = $('up-s');
    var p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dt);
    if (!p) { st.textContent = 'اختر تاريخ السجل.'; return; }
    if (!files.length) { st.textContent = 'اختر ملفًا واحدًا على الأقل.'; return; }
    var y = +p[1], m = +p[2];
    for (var i = 0; i < files.length; i++) {
      var ext = (files[i].name.split('.').pop() || '').toLowerCase(), direct = UP_TYPES[files[i].type] || EXT_TYPE[ext];
      if (files[i].size > (direct ? 20 : 14) * 1048576) { st.textContent = 'الملف «' + files[i].name + '» أكبر من الحد (' + (direct ? 20 : 14) + ' م.ب). قسّمه أو اضغطه.'; return; }
    }
    $('up-go').disabled = true;
    var done = 0;
    (function next() {
      if (done >= files.length) { closeDlg(); if (preset) { preset = null; closeFill(); } toast('حُفظ ' + files.length + ' ملف في أرشيف ' + MONTHS[m - 1] + ' ' + y + '.'); return; }
      var f = files[done]; st.textContent = 'جارٍ رفع ' + (done + 1) + ' من ' + files.length + '…';
      storeFile(f).then(function (res) {
        var row = { doc: r.i, code: r.c || '', d: r.d, y: y, m: m, rd: dt, no: no, asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: note, at: new Date().toISOString(), by: S.cap.uid };
        if (res.enc) row.enc = res.enc; if (preset) row.filled = true;
        return S.cap.db.collection('archive').add(row);
      }).then(function () { done++; next(); }).catch(function (e) {
        var c = e && e.code; $('up-go').disabled = false;
        st.textContent = (c === 'too_large' ? 'الملف أكبر من الحد المسموح.' : c === 'unsupported_type' ? 'نوع الملف غير مقبول.' : c === 'quota_or_state' || c === 'quota_exceeded' ? 'مساحة الأرشيف ممتلئة. احذف ملفات قديمة ثم حاول.' : c === 'rate_limited' ? 'محاولات كثيرة. انتظر قليلًا ثم حاول.' : 'تعذر الرفع. حاول مرة أخرى.') + (done ? ' (حُفظ ' + done + ' ملف قبل التوقف)' : '');
      });
    })();
  }
  function openNA(r) {
    dlg('<h2>تسجيل «لا ينطبق» عن فترة</h2><div><span class="code">' + esc(r.c) + '</span> ' + esc(title(r)) + '</div><p style="margin:0;color:var(--muted)">يُستخدم عندما لم يحدث ما يستدعي ملء النموذج في هذه الفترة.</p>' +
      '<div class="two"><label>السنة<input id="na-y" type="number" min="2000" max="2100" value="' + CY + '"></label><label>الشهر<select id="na-m">' + monthOpts() + '</select></label></div>' +
      '<label>السبب<input id="na-n" type="text" maxlength="200" placeholder="مثال: لم تقع حوادث خلال الشهر"></label><div id="na-s" style="color:var(--muted);min-height:1.4em"></div>' +
      '<div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-act="dona" data-id="' + r.i + '">تسجيل</button></div>');
  }
  function doNA(r) {
    var y = parseInt($('na-y').value, 10), m = parseInt($('na-m').value, 10), n = $('na-n').value.trim();
    if (!(y >= 2000 && y <= 2100)) { $('na-s').textContent = 'اكتب سنة صحيحة.'; return; }
    if (!n) { $('na-s').textContent = 'اكتب السبب ليظهر أمام المراجع.'; return; }
    S.cap.db.collection('na').add({ doc: r.i, d: r.d, y: y, m: m, note: n, at: new Date().toISOString(), by: S.cap.uid }).then(function () { closeDlg(); toast('سُجّل «لا ينطبق» عن ' + MONTHS[m - 1] + ' ' + y + '.'); }).catch(function () { $('na-s').textContent = 'تعذر التسجيل. قد لا تملك صلاحية الكتابة.'; });
  }
  function askDelete(kind, id, label) {
    dlg('<h2>تأكيد الحذف</h2><p>سيُحذف «' + esc(label) + '» نهائيًا ولا يمكن استرجاعه.</p><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn danger" data-act="dodel" data-kind="' + kind + '" data-id="' + esc(id) + '">حذف نهائي</button></div>');
  }
  function doDelete(kind, id) {
    var p;
    if (kind === 'archive') { var a = S.arch.filter(function (x) { return x.id === id; })[0]; if (!a) { closeDlg(); return; } p = S.cap.db.collection('archive').doc(id).delete().then(function () { return S.cap.assets ? S.cap.assets.delete(a.asset).catch(function () { }) : null; }); }
    else p = S.cap.db.collection(kind).doc(id).delete();
    p.then(function () { closeDlg(); toast('تم الحذف.'); }).catch(function () { closeDlg(); toast('تعذر الحذف. حاول مرة أخرى.'); });
  }
  function archNotice() {
    if (S.archState === 'off') return '<div class="note">الأرشيف غير متاح في هذا العرض. افتح النظام من claude.ai وأنت مسجّل الدخول.</div>';
    if (S.archState === 'wait') return '<div class="note">جارٍ تحميل الأرشيف…</div>';
    if (S.archState === 'slow') return '<div class="note">لم يصل الأرشيف بعد. قد تكون البيانات المعروضة غير محدّثة.</div>';
    return '';
  }

  /* ---------- rendering ---------- */
  function head(t, sub, extra) { return '<div class="top"><div><h1>' + t + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn menu-btn" data-act="menu">الأقسام</button>' + (extra || '') + '</div></div>'; }
  function rowHtml(r, showDept) {
    var n = archOf(r.i).length, sub = '';
    if (r.c) sub += '<span class="code">' + esc(r.c) + '</span>';
    sub += '<span class="pill ' + (r.k === 'form' ? 'form' : '') + '">' + KIND[r.k] + '</span>';
    if (r.t && r.t !== r.n) sub += '<span>' + esc(r.n) + '.' + r.e + '</span>'; else sub += '<span class="ltr">.' + r.e + '</span>';
    if (r.pg > 0) sub += '<span class="num">' + r.pg + ' ص</span>';
    if (showDept) sub += '<span>' + esc(r.d) + (r.s ? ' / ' + esc(r.s) : '') + '</span>';
    if (verOf(r.i).length) sub += '<span class="pill form num">محدَّث ' + verOf(r.i).length + ' مرة</span>';
    var a = '<button class="btn" data-act="view" data-id="' + r.i + '">عرض</button>';
    if (r.k === 'form') a += '<button class="btn pri" data-act="blank" data-id="' + r.i + '">طباعة فارغ</button>';
    else if (r.e !== 'pdf') a += '<button class="btn" data-act="orig" data-id="' + r.i + '">الأصل' + (OFFICE[r.e] ? ' ' + OFFICE[r.e] : '') + '</button>';
    else a += '<button class="btn" data-act="pdf" data-id="' + r.i + '">حفظ PDF</button>';
    if (r.k === 'form' && r.e !== 'jpeg' && canUp(r)) a += '<button class="btn" data-act="fill" data-id="' + r.i + '">تسجيل بيانات</button>';
    if (canUp(r)) a += '<button class="btn" data-act="up" data-id="' + r.i + '">أرشفة</button>';
    a += '<a class="btn" href="#doc-' + r.i + '">الأرشيف' + (n ? ' (' + n + ')' : '') + '</a>';
    return '<div class="row"><div><div class="ttl">' + esc(title(r)) + '</div><div class="sub">' + sub + '</div></div><div class="acts">' + a + '</div></div>';
  }
  function match(r, q) { if (!q) return true; q = q.toLowerCase(); return (r.c + ' ' + (r.t || '') + ' ' + r.n).toLowerCase().indexOf(q) >= 0; }
  function lastPeriod(a) { if (!a.length) return '—'; var b = a.slice().sort(function (x, y) { return (y.y * 12 + y.m) - (x.y * 12 + x.m); })[0]; return MONTHS[b.m - 1] + ' ' + b.y; }
  function freqCell(r) {
    var f = freqOf(r);
    if (!canWriteDept(r.d)) return esc((FREQ.filter(function (x) { return x[0] === f; })[0] || FREQ[0])[1]);
    return '<select class="mini" data-chg="freq" data-id="' + r.i + '" aria-label="دورية النموذج">' + FREQ.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === f ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>';
  }
  function evTable(docs) {
    var rows = docs.filter(isArchivable).map(function (r) {
      var s = evStatus(r), w = canWriteDept(r.d);
      return '<tr><td><span class="code">' + esc(r.c) + '</span></td><td>' + esc(title(r)) + '</td><td>' + freqCell(r) + '</td><td class="num">' + (s.p || '—') + '</td><td class="num">' + (s.a.length || '—') + '</td><td>' + lastPeriod(s.a) + '</td><td><span class="pill ' + s.cls + '">' + s.txt + '</span></td><td><div class="acts"><button class="btn" data-act="view" data-id="' + r.i + '">عرض</button>' + (canUp(r) ? '<button class="btn" data-act="up" data-id="' + r.i + '">أرشفة</button>' : '') + (w ? '<button class="btn" data-act="na" data-id="' + r.i + '">لا ينطبق</button>' : '') + '</div></td></tr>';
    }).join('');
    return '<div class="tblw"><table><thead><tr><th>الكود</th><th>النموذج</th><th>الدورية</th><th>سجلات ضمن الملف</th><th>في الأرشيف</th><th>آخر فترة مؤرشفة</th><th>الحالة</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function afile(x, showDoc) {
    var rr = showDoc ? S.byId[x.doc] : null;
    var meta = [x.rd ? fmtDate(x.rd) : '', x.no ? 'رقم ' + x.no : '', x.note || ''].filter(Boolean).join(' · ');
    return '<div class="afile"><span>' + (rr ? '<a href="#doc-' + rr.i + '">' + esc(rr.c || title(rr)) + '</a> · ' : '') + (x.filled ? '<span class="pill form">مسجّل على النظام</span> ' : '') + esc(x.name) + (meta ? ' <small style="color:var(--muted)">' + esc(meta) + '</small>' : '') + ' <small class="num" style="color:var(--muted)">' + fmtSize(x.size || 0) + '</small></span><span class="acts">' + (recViewable(x) ? '<button class="btn" data-act="aview" data-id="' + esc(x.id) + '">عرض</button>' : '') + '<button class="btn" data-act="asave" data-id="' + esc(x.id) + '">حفظ</button>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="archive" data-id="' + esc(x.id) + '" data-label="' + esc(x.name) + '">حذف</button>' : '') + '</span></div>';
  }

  function vHome() {
    var q = S.q, c = function (k) { return S.docs.filter(function (r) { return r.k === k; }).length; };
    var h = head('نظام وثائق ISO 9001', 'كل أوراق نظام الإدارة مرتبة حسب القسم، مع أرشيف لكل قسم وطباعة النماذج الفارغة.', '<label class="search"><input id="q" type="search" placeholder="ابحث بالكود أو اسم الورقة" value="' + esc(q) + '" aria-label="بحث في كل الأوراق"></label>');
    if (q) {
      var res = S.docs.filter(function (r) { return match(r, q); });
      return h + '<details class="sec" open><summary><span class="t">نتائج البحث</span><small class="num">' + res.length + ' ورقة</small></summary><div class="rows">' + (res.slice(0, 120).map(function (r) { return rowHtml(r, true); }).join('') || '<div class="row">لا توجد ورقة بهذا الاسم أو الكود.</div>') + '</div></details>';
    }
    var st = DEPTS.map(function (d) { return deptStats(d.k); }), late = st.reduce(function (n, s) { return n + s.late; }, 0), fAll = allFindings(), fOpen = fAll.filter(function (f) { return fState(f) !== 'done'; }).length, ex = expItems().filter(function (x) { return x.days <= 30; }).length;
    var overall = Math.round(st.reduce(function (n, s) { return n + s.score; }, 0) / st.length);
    h += '<div class="tiles"><div class="tile"><b class="num">' + overall + '%</b><span>جاهزية المصنع للمراجعة</span></div><div class="tile"><b class="num">' + S.docs.length + '</b><span>ورقة في ' + DEPTS.length + ' أقسام</span></div><div class="tile"><b class="num">' + c('form') + '</b><span>نموذج · ' + c('procedure') + ' إجراء · ' + c('wi') + ' تعليمات</span></div><div class="tile"><b class="num">' + (S.archState === 'ok' ? S.arch.length : '—') + '</b><span>ملف في الأرشيف</span></div>' +
      '<a class="tile" href="#evidence" style="text-decoration:none;color:inherit"><b class="num" style="color:var(--' + (late ? 'bad' : 'good') + ')">' + late + '</b><span>نموذج دوري متأخر</span></a>' +
      '<a class="tile" href="#expiry" style="text-decoration:none;color:inherit"><b class="num" style="color:var(--' + (ex ? 'warn' : 'good') + ')">' + ex + '</b><span>ينتهي خلال 30 يومًا</span></a>' +
      (S.auditor ? '' : '<a class="tile" href="#audit" style="text-decoration:none;color:inherit"><b class="num" style="color:var(--' + (fOpen ? 'warn' : 'good') + ')">' + fOpen + '</b><span>ملاحظة تدقيق لم تُغلق</span></a>') + '</div>';
    var ml = S.byCode['GEM-QA-F-7.5-01'];
    if (ml) h += '<details class="sec" open><summary><span class="t">القائمة الرئيسية للمعلومات الموثقة</span><small>المجلد الرئيسي IMS</small></summary><div class="rows">' + rowHtml(ml) + '</div></details>';
    h += '<h2 style="font-size:18px">جاهزية الأقسام</h2><div class="grid">' + DEPTS.map(function (d, i) {
      var s = st[i];
      return '<a class="dcard" href="#' + d.h + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>' + dIcon(d.k, 26) + ' ' + esc(dName(d.k)) + '</h3><b class="num" style="font-family:var(--display);font-size:20px;color:var(--' + (s.score >= 80 ? 'good' : s.score >= 40 ? 'warn' : 'bad') + ')">' + s.score + '%</b></div><div class="bar"><i style="width:' + s.score + '%"></i></div><div class="meta"><span class="num">' + s.ready + ' من ' + s.forms + ' نموذج له دليل</span>' + (s.fs && !S.auditor ? '<span>·</span><span class="num">' + s.done + ' من ' + s.fs + ' ملاحظة أُغلقت</span>' : '') + '</div><div class="meta"><span class="num">' + s.all + ' ورقة</span><span>·</span><span class="num">' + s.arch + ' في الأرشيف</span>' + (s.late ? '<span class="pill bad num">' + s.late + ' متأخر</span>' : '') + '</div></a>';
    }).join('') + '</div><p style="margin:0;color:var(--muted);font-size:13px">الجاهزية = متوسط نسبة النماذج التي لها دليل (سجل مؤرشف أو «لا ينطبق» أو سجلات ضمن الملف) ونسبة ملاحظات التدقيق المغلقة للقسم.</p>';
    h += '<h2 style="font-size:18px">للعرض على المراجع</h2><div class="grid">' +
      '<a class="dcard" href="#evidence"><h3>قائمة الأدلة</h3><div class="meta">لكل نموذج: هل له سجل مملوء في الأرشيف أم ناقص أم متأخر.</div></a>' +
      '<a class="dcard" href="#trace"><h3>بحث الأرشيف وتتبع التشغيلة</h3><div class="meta">ابحث برقم أو اسم أو تاريخ في كل ما أُرشف.</div></a>' +
      '<a class="dcard" href="#iso"><h3>ربط الأوراق ببنود ISO 9001</h3><div class="meta">كل بند والإجراء والنماذج التي تغطيه.</div></a>' +
      '<a class="dcard" href="#expiry"><h3>تواريخ الانتهاء</h3><div class="meta">المعايرة والعقود والتراخيص وما يقترب موعده.</div></a></div>';
    return h;
  }

  function vDept(d) {
    var docs = S.docs.filter(function (r) { return r.d === d.k; }), tab = S.tab[d.k] || 'docs', q = S.dq[d.k] || '', s = deptStats(d.k);
    var h = head(dIcon(d.k, 30) + ' ' + esc(dName(d.k)) + (canAdmin() ? ' <button class="btn noprint" data-x="rndept" data-id="' + d.h + '" style="font-size:12px;vertical-align:middle">تغيير الاسم</button>' : ''), '<span class="num">' + s.all + ' ورقة · ' + s.forms + ' نموذج · ' + s.arch + ' ملف في الأرشيف · الجاهزية ' + s.score + '%</span>', (tab === 'docs' ? '<label class="search"><input id="dq" type="search" placeholder="ابحث في أوراق القسم" value="' + esc(q) + '" aria-label="بحث في أوراق القسم"></label>' : ''));
    h += '<div class="tabs" role="tablist">' + [['docs', 'الأوراق'], ['arch', 'الأرشيف'], ['ev', 'قائمة الأدلة']].map(function (t) { return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
    if (tab === 'docs') {
      var secs = [], map = {};
      docs.forEach(function (r) { if (!match(r, q)) return; if (!map[r.s]) { map[r.s] = []; secs.push(r.s); } map[r.s].push(r); });
      if (!secs.length) h += '<p class="empty">لا توجد ورقة بهذا الاسم أو الكود في القسم.</p>';
      secs.forEach(function (sn) {
        var rs = map[sn], open = q || (rs.length <= 16 && sn.indexOf('ملفات الموردين') !== 0);
        h += '<details class="sec"' + (open ? ' open' : '') + '><summary><span class="t">' + esc(sn || 'المجلد الرئيسي للقسم') + '</span><small class="num">' + rs.length + ' ورقة</small></summary><div class="rows">' + rs.map(function (r) { return rowHtml(r); }).join('') + '</div></details>';
      });
    } else if (tab === 'arch') {
      h += archNotice();
      if (S.archState === 'ok' && !canWriteDept(d.k) && !S.auditor) h += '<div class="note">العرض للقراءة فقط. حفظ ملفات في أرشيف هذا القسم متاح لمن خُصص له القسم من صفحة الصلاحيات.</div>';
      var aq = S.aq || '';
      h += '<label class="search" style="flex:none;max-width:460px"><input id="aq" type="search" placeholder="ابحث في أرشيف القسم: اسم، رقم، تاريخ، كود" value="' + esc(aq) + '" aria-label="بحث في أرشيف القسم"></label>';
      var withA = docs.filter(function (r) { return archOf(r.i).filter(function (a) { return amatch(a, aq); }).length || (!aq && naOf(r.i).length); });
      if (!withA.length) h += '<p class="empty">' + (aq ? 'لا يوجد ملف مؤرشف بهذا البحث في القسم.' : 'أرشيف القسم فارغ. افتح تبويب «الأوراق» واضغط «أرشفة» أو «تسجيل بيانات» أمام أي ورقة.') + '</p>';
      withA.forEach(function (r) {
        var a = archOf(r.i).filter(function (x) { return amatch(x, aq); }), nas = aq ? [] : naOf(r.i);
        h += '<details class="sec" open><summary><span class="t">' + (r.c ? '<span class="code">' + esc(r.c) + '</span> ' : '') + esc(title(r)) + '</span><small class="num">' + a.length + ' ملف</small></summary><div class="rows">' + daysHtml(a) +
          nas.map(function (x) { return '<div class="arch-m"><div class="afile"><span><span class="pill">لا ينطبق</span> ' + MONTHS[x.m - 1] + ' ' + esc(x.y) + ' · ' + esc(x.note || '') + '</span>' + (canAdmin() ? '<span class="acts"><button class="btn danger" data-act="del" data-kind="na" data-id="' + esc(x.id) + '" data-label="لا ينطبق ' + MONTHS[x.m - 1] + ' ' + esc(x.y) + '">حذف</button></span>' : '') + '</div></div>'; }).join('') +
          '<div class="row"><div></div><div class="acts">' + (canUp(r) ? '<button class="btn pri" data-act="up" data-id="' + r.i + '">أرشفة سجل جديد</button>' : '') + '<a class="btn" href="#doc-' + r.i + '">صفحة الورقة</a></div></div></div></details>';
      });
    } else {
      h += archNotice() + '<div class="tiles"><div class="tile"><b class="num">' + s.forms + '</b><span>نموذج في القسم</span></div><div class="tile"><b class="num" style="color:var(--good)">' + s.ready + '</b><span>له دليل</span></div><div class="tile"><b class="num" style="color:var(--warn)">' + (s.none - s.late) + '</b><span>لا يوجد له سجل مؤرشف</span></div><div class="tile"><b class="num" style="color:var(--bad)">' + s.late + '</b><span>دوري متأخر</span></div></div>' +
        (canWriteDept(d.k) ? '<div class="note">حدّد دورية كل نموذج من عمود «الدورية» ليظهر تنبيه «متأخر» إذا لم يؤرشف سجل عن الفترة الحالية. استخدم «لا ينطبق» عندما لا يوجد ما يُسجَّل في الفترة.</div>' : '') + evTable(docs);
    }
    return h;
  }

  function vEvidence() {
    var h = head('قائمة الأدلة', 'لكل نموذج في النظام: السجل المملوء الذي يُعرض على المراجع، وهل هو موجود في الأرشيف.') + archNotice();
    var tot = { f: 0, r: 0, n: 0, l: 0 }, rows = DEPTS.map(function (d) {
      var s = deptStats(d.k); tot.f += s.forms; tot.r += s.ready; tot.n += s.none - s.late; tot.l += s.late;
      return '<tr><td><a href="#' + d.h + '">' + esc(dName(d.k)) + '</a></td><td class="num">' + s.forms + '</td><td class="num">' + s.ready + '</td><td class="num">' + (s.none - s.late) + '</td><td class="num">' + (s.late ? '<span class="pill bad">' + s.late + '</span>' : '0') + '</td><td style="min-width:130px"><div class="bar"><i style="width:' + s.pf + '%"></i></div></td><td class="num">' + s.pf + '%</td></tr>';
    }).join('');
    h += '<div class="tblw"><table><thead><tr><th>القسم</th><th>النماذج</th><th>لها دليل</th><th>لا يوجد لها سجل مؤرشف</th><th>دوري متأخر</th><th colspan="2">نسبة الأدلة</th></tr></thead><tbody>' + rows + '<tr><td><b>الإجمالي</b></td><td class="num"><b>' + tot.f + '</b></td><td class="num"><b>' + tot.r + '</b></td><td class="num"><b>' + tot.n + '</b></td><td class="num"><b>' + tot.l + '</b></td><td></td><td class="num"><b>' + (tot.f ? Math.round(100 * tot.r / tot.f) : 0) + '%</b></td></tr></tbody></table></div>';
    DEPTS.forEach(function (d) {
      var docs = S.docs.filter(function (r) { return r.d === d.k; });
      h += '<details class="sec"><summary><span class="t">' + esc(dName(d.k)) + '</span><small class="num">' + docs.filter(isArchivable).length + ' نموذج</small></summary><div style="padding:10px">' + evTable(docs) + '</div></details>';
    });
    return h;
  }

  function vTrace() {
    var q = S.tq, f = S.tf || {}, h = head('بحث الأرشيف وتتبع التشغيلة', 'ابحث في كل ما أُرشف: برقم التشغيلة أو الإذن، اسم الملف، الكود، الملاحظة، أو حدّد قسمًا وفترة.') + archNotice();
    h += '<div class="find l"><div class="track"><label style="flex:2;min-width:220px">كلمة أو رقم<input class="mini" id="tq" type="search" value="' + esc(q) + '" placeholder="رقم التشغيلة، اسم الملف، الكود"></label><label>القسم<select class="mini" data-chg="tf" data-k="d"><option value="">كل الأقسام</option>' + DEPTS.map(function (d) { return '<option' + (f.d === d.k ? ' selected' : '') + '>' + esc(d.k) + '</option>'; }).join('') + '</select></label><label>من تاريخ<input class="mini" type="date" data-chg="tf" data-k="from" value="' + esc(f.from || '') + '"></label><label>إلى تاريخ<input class="mini" type="date" data-chg="tf" data-k="to" value="' + esc(f.to || '') + '"></label></div></div>';
    var res = S.arch.filter(function (a) { var dk = dayOf(a); return amatch(a, q) && (!f.d || a.d === f.d) && (!f.from || dk >= f.from) && (!f.to || dk <= f.to + '~'); }).sort(function (p, q2) { return dayOf(p).localeCompare(dayOf(q2)); });
    if (!S.arch.length) return h + '<p class="empty">الأرشيف فارغ. بعد أرشفة السجلات تظهر هنا ويمكن البحث فيها.</p>';
    if (!res.length) return h + '<p class="empty">لا يوجد ملف مؤرشف بهذه المعايير.</p>';
    h += '<p class="num" style="margin:0;color:var(--muted)">' + res.length + ' ملف، مرتبة من الأقدم للأحدث.</p><div class="tblw"><table><thead><tr><th>م</th><th>تاريخ السجل</th><th>القسم</th><th>الورقة</th><th>الرقم</th><th>الملف</th><th></th></tr></thead><tbody>' + res.slice(0, 400).map(function (a, i) {
      var r = S.byId[a.doc] || {};
      return '<tr><td class="num">' + (i + 1) + '</td><td class="num">' + esc(dayLabel(dayOf(a))) + '</td><td>' + esc(a.d) + '</td><td>' + (r.i ? '<a href="#doc-' + r.i + '">' + (r.c ? '<span class="code">' + esc(r.c) + '</span> ' : '') + esc(title(r)) + '</a>' : '') + '</td><td>' + esc(a.no || '') + '</td><td>' + esc(a.name) + (a.note ? ' <small style="color:var(--muted)">' + esc(a.note) + '</small>' : '') + '</td><td><div class="acts">' + (recViewable(a) ? '<button class="btn" data-act="aview" data-id="' + esc(a.id) + '">عرض</button>' : '') + '<button class="btn" data-act="asave" data-id="' + esc(a.id) + '">حفظ</button></div></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }

  /* ---------- one document: versions + daily archive ---------- */
  function verOf(id) { return (S.vers || []).filter(function (v) { return v.doc === id; }).sort(function (p, q) { return String(q.at).localeCompare(String(p.at)); }); }
  function vDoc(r) {
    var q = S.docq || '', a = archOf(r.i), vs = verOf(r.i), w = canUp(r);
    var h = head((r.c ? '<span class="code" style="font-size:15px">' + esc(r.c) + '</span> ' : '') + esc(title(r)), esc(dName(r.d)) + (r.s ? ' / ' + esc(r.s) : '') + ' · ' + KIND[r.k] + (S.names[r.i] && S.names[r.i].t ? ' · الاسم الأصلي: ' + esc(r.t || r.n) : '') + ' · <a href="#' + (DEPTS.filter(function (d) { return d.k === r.d; })[0] || {}).h + '">رجوع للقسم</a>');
    h += '<div class="acts" style="justify-content:flex-start"><button class="btn" data-act="view" data-id="' + r.i + '">عرض</button>' + '<button class="btn" data-act="orig" data-id="' + r.i + '">تعديل الملف</button>' + (canAdmin() ? '<button class="btn" data-x="rn" data-id="' + r.i + '">تغيير الاسم</button>' : '') + (w && r.e !== 'jpeg' ? '<button class="btn pri" data-act="fill" data-id="' + r.i + '">فتح نسخة للملء في Word</button>' : '') + (w && r.e === 'docx' && isArchivable(r) ? '<button class="btn pri" data-x="fos" data-id="' + r.i + '">ملء على الشاشة</button>' : '') + (w ? '<button class="btn" data-act="up" data-id="' + r.i + '">رفع ملف للأرشيف</button><button class="btn" data-act="ver" data-id="' + r.i + '">تحديث الملف (إصدار جديد)</button>' : '') + '</div>';
    h += '<details class="sec" open><summary><span class="t">إصدارات الملف</span><small class="num">' + (vs.length + 1) + '</small></summary><div class="rows">' + vs.map(function (v, i) {
      return '<div class="row"><div><div class="ttl">' + verPill(v, r.i) + esc(v.name) + '</div><div class="sub"><span class="num">' + esc(fmtDate(String(v.at).slice(0, 10))) + '</span>' + (v.note ? '<span>' + esc(v.note) + '</span>' : '') + '<span class="num">' + fmtSize(v.size || 0) + '</span></div></div><div class="acts">' + (recViewable(v) ? '<button class="btn" data-act="vview" data-id="' + esc(v.id) + '">عرض</button>' : '') + verActs(v) + '<button class="btn" data-act="vsave" data-id="' + esc(v.id) + '">تحميل</button>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="versions" data-id="' + esc(v.id) + '" data-label="' + esc(v.name) + '">حذف</button>' : '') + '</div></div>';
    }).join('') + '<div class="row"><div><div class="ttl">' + (curVer(r.i) ? '' : '<span class="pill good">الإصدار الحالي</span> ') + esc(r.n) + '.' + r.e + '</div><div class="sub"><span>الملف الأصلي كما استُلم</span></div></div><div class="acts"><button class="btn" data-act="' + (r.e === 'pdf' ? 'pdf' : 'orig') + '" data-id="' + r.i + '">تحميل</button></div></div></div></details>';
    h += '<h2 style="font-size:18px">أرشيف الورقة حسب يوم التسجيل</h2>' + archNotice() + '<label class="search" style="flex:none;max-width:460px"><input id="docq" type="search" placeholder="ابحث: اسم، رقم، تاريخ، ملاحظة" value="' + esc(q) + '" aria-label="بحث في أرشيف الورقة"></label>';
    var fl = a.filter(function (x) { return amatch(x, q); });
    h += fl.length ? '<div class="sec" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r)">' + daysHtml(fl) + '</div>' : '<p class="empty">' + (a.length ? 'لا يوجد ملف بهذا البحث.' : 'لا توجد ملفات مؤرشفة لهذه الورقة بعد.') + '</p>';
    return h;
  }
  function openVer(r) {
    dlg('<h2>تحديث الملف بإصدار جديد</h2><div>' + (r.c ? '<span class="code">' + esc(r.c) + '</span> ' : '') + esc(title(r)) + '</div><p style="margin:0;color:var(--muted)">يُحفظ الملف الجديد كإصدار حالي، ويبقى الأصل وكل الإصدارات السابقة محفوظة.</p><label>الملف الجديد بعد تعديله وحفظه (Word أو Excel أو PDF)<input id="vr-f" type="file"></label><div class="two"><label>رقم الإصدار<input id="vr-i" type="text" maxlength="10" placeholder="02" dir="ltr"></label><label>وصف التعديل<input id="vr-n" type="text" maxlength="200" placeholder="تعديل البند 5.3"></label></div><p style="margin:0;color:var(--muted);font-size:13px">الإصدار لا يصبح «الحالي» إلا بعد اعتماد المسؤول.</p><div id="vr-s" style="color:var(--muted);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" id="vr-go" data-act="dover" data-id="' + r.i + '">حفظ الإصدار</button></div>');
  }
  function doVer(r) {
    var f = ($('vr-f').files || [])[0], n = $('vr-n').value.trim(), st = $('vr-s');
    if (!f) { st.textContent = 'اختر الملف الجديد.'; return; }
    if (!n) { st.textContent = 'اكتب وصف التعديل ليظهر في سجل الإصدارات.'; return; }
    if (f.size > 10 * 1048576) { st.textContent = 'الملف أكبر من 10 م.ب.'; return; }
    $('vr-go').disabled = true; st.textContent = 'جارٍ الرفع…';
    storeFile(f).then(function (res) { var row = { doc: r.i, d: r.d, asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: n, issue: ($('vr-i').value || '').trim(), st: canAdmin() ? 'approved' : 'pending', at: new Date().toISOString(), by: S.cap.uid }; if (row.st === 'approved') { row.approvedAt = row.at; row.approvedBy = meName(); } if (res.enc) row.enc = res.enc; return S.cap.db.collection('versions').add(row); })
      .then(function () { closeDlg(); if (!canAdmin()) notify('مدير الجودة', 'إصدار جديد ينتظر الاعتماد: ' + (r.c || title(r)), 'doc-' + r.i); toast(canAdmin() ? 'حُفظ الإصدار واعتُمد.' : 'حُفظ الإصدار وينتظر اعتماد المسؤول.'); }).catch(function () { $('vr-go').disabled = false; st.textContent = 'تعذر الرفع. حاول مرة أخرى.'; });
  }

  /* ---------- fill a form on screen ---------- */
  var F = null;
  function closeFill() { F = null; $('filler').classList.remove('on'); $('fpages').innerHTML = ''; }
  function openFill(r) {
    if (!window.pdfjsLib || !window.PDFLib) { toast('أداة التسجيل غير متاحة في هذا العرض.'); return; }
    var v = verOf(r.i)[0], url = v && v.ct === 'application/pdf' && !v.enc ? '/_blob/' + v.asset : pdfUrl(r);
    F = { r: r, pages: [], pt: 11, tick: false }; var me = F, box = $('fpages');
    $('ftitle').textContent = (r.c ? r.c + ' · ' : '') + title(r); box.innerHTML = '<p class="empty">جارٍ فتح النموذج…</p>'; $('filler').classList.add('on');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
    pdfjsLib.getDocument({ url: url, disableFontFace: true, isEvalSupported: false }).promise.then(function (pdf) {
      if (F !== me) return; box.innerHTML = '';
      var n = Math.min(pdf.numPages, 20), avail = Math.min(box.clientWidth - 24, 1000), chain = Promise.resolve();
      for (var i = 1; i <= n; i++) (function (i) {
        chain = chain.then(function () { return pdf.getPage(i); }).then(function (pg) {
          if (F !== me) return;
          var vp = pg.getViewport({ scale: 1 }), v2 = pg.getViewport({ scale: 2 }), wrap = document.createElement('div'), cv = document.createElement('canvas');
          wrap.className = 'fpage'; wrap.style.width = Math.min(avail, vp.width * 1.5) + 'px'; cv.width = v2.width; cv.height = v2.height;
          wrap.appendChild(cv); box.appendChild(wrap); me.pages.push({ wrap: wrap, cv: cv, w: vp.width, h: vp.height });
          return pg.render({ canvasContext: cv.getContext('2d'), viewport: v2 }).promise;
        });
      })(i);
      if (pdf.numPages > n) chain.then(function () { toast('عُرضت أول ' + n + ' صفحة فقط من النموذج.'); });
    }).catch(function () { if (F === me) box.innerHTML = '<p class="empty">تعذر فتح النموذج. تحقق من الاتصال.</p>'; });
  }
  function fillClick(ev) {
    if (!F || ev.target.closest('.fbox')) return;
    var wrap = ev.target.closest('.fpage'); if (!wrap) return;
    var p = F.pages.filter(function (x) { return x.wrap === wrap; })[0], rc = wrap.getBoundingClientRect(), k = rc.width / p.w;
    var b = document.createElement('div'); b.className = 'fbox'; b.contentEditable = 'true'; b.dir = 'auto'; b.dataset.pt = F.pt;
    b.style.fontSize = (F.pt * k) + 'px'; b.style.top = (ev.clientY - rc.top - F.pt * k * 0.75) + 'px'; b.style.right = (rc.right - ev.clientX - 4) + 'px';
    if (F.tick) b.textContent = '✓';
    wrap.appendChild(b); b.focus();
  }
  function fillExport() {
    if (!F) return; var me = F, doc;
    Array.prototype.forEach.call($('fpages').querySelectorAll('.fbox'), function (b) { if (!b.innerText.trim()) b.remove(); });
    if (!$('fpages').querySelector('.fbox')) { toast('لم تُسجَّل أي بيانات بعد. اضغط على مكان في النموذج واكتب.'); return; }
    toast('جارٍ تجهيز النموذج المملوء…', 30000);
    (document.fonts && document.fonts.load ? document.fonts.load('16px "IBM Plex Sans Arabic"') : Promise.resolve()).then(function () { return PDFLib.PDFDocument.create(); }).then(function (d) {
      doc = d; var chain = Promise.resolve();
      me.pages.forEach(function (p) {
        chain = chain.then(function () {
          var c = document.createElement('canvas'), x = c.getContext('2d'), rc = p.wrap.getBoundingClientRect(), k = c.width = p.cv.width; c.height = p.cv.height; k = p.cv.width / rc.width;
          x.drawImage(p.cv, 0, 0); x.fillStyle = '#0b2a6f'; x.textBaseline = 'top'; x.direction = 'rtl'; x.textAlign = 'right';
          Array.prototype.forEach.call(p.wrap.querySelectorAll('.fbox'), function (b) {
            var br = b.getBoundingClientRect(), px = (+b.dataset.pt) * 2; x.font = '500 ' + px + 'px "IBM Plex Sans Arabic", Tahoma, Arial, sans-serif';
            b.innerText.replace(/\r/g, '').split('\n').forEach(function (ln, i) { x.fillText(ln, (br.right - rc.left) * k, (br.top - rc.top) * k + i * px * 1.5 + px * 0.22); });
          });
          return new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.9); }).then(function (bl) { return bl.arrayBuffer(); }).then(function (buf) { return doc.embedJpg(buf); }).then(function (img) { doc.addPage([p.w, p.h]).drawImage(img, { x: 0, y: 0, width: p.w, height: p.h }); });
        });
      });
      return chain;
    }).then(function () { return doc.save(); }).then(function (bytes) {
      if (F !== me) return;
      var nm = (me.r.c || me.r.n) + ' - ' + today() + '.pdf', f; try { f = new File([bytes], nm, { type: 'application/pdf' }); } catch (e) { f = new Blob([bytes], { type: 'application/pdf' }); f.name = nm; }
      $('toast').classList.remove('on'); openUpload(me.r, f);
    }).catch(function () { toast('تعذر تجهيز النموذج المملوء. حاول مرة أخرى.'); });
  }

  function clauseOf(code) { var m = /-(?:QP|F|WI|PL|PO|MN)-(\d+(?:\.\d+)*)/.exec(code || ''); return m ? m[1] : ''; }
  function vIso() {
    var set = {}; S.extra.iso.forEach(function (c) { set[c.c] = []; });
    S.docs.forEach(function (r) {
      if (!r.c || r.d === SE || r.k === 'record' || r.k === 'attach' || r.k === 'external' || r.k === 'procedure' || r.k === 'manual' || r.k === 'policy') return;
      var c = clauseOf(r.c); if (set[c]) set[c].push(r);
    });
    var dep = function (p) { return S.docs.filter(function (r) { return r.pr === p && r.c !== p && r.k !== 'record'; }).length; };
    var h = head('ربط الأوراق ببنود ISO 9001:2015', 'الإجراءات مأخوذة من قسم «المراجع» في كل إجراء، والنماذج والتعليمات حسب رقم البند في كودها.');
    h += '<div class="tblw"><table><thead><tr><th>البند</th><th>الإجراء الذي يغطيه</th><th>النماذج والتعليمات المرقمة بهذا البند</th><th>الحالة</th></tr></thead><tbody>' + S.extra.iso.map(function (c) {
      var procs = c.p.map(function (p) { var r = S.byCode[p], n = dep(p); return '<div><button class="chip" data-act="code" data-code="' + esc(p) + '">' + esc(p) + '</button> ' + esc(r ? title(r) : '') + (n ? ' <small class="num" style="color:var(--muted)">(' + n + ' ورقة تابعة)</small>' : '') + '</div>'; }).join('');
      var docs = set[c.c].map(function (r) { return '<button class="chip" title="' + esc(title(r)) + '" data-act="view" data-id="' + r.i + '">' + esc(r.c) + '</button>'; }).join('');
      var st = c.st === 'ex' ? '<span class="pill">مستثنى</span>' : c.st === 'chk' ? '<span class="pill warn">يحتاج مراجعة</span>' : (c.p.length || set[c.c].length) ? '<span class="pill good">مغطى</span>' : '<span class="pill warn">لا توجد وثيقة تذكره</span>';
      return '<tr><td><b class="num">' + c.c + '</b><br>' + esc(c.t) + '</td><td>' + (procs || '—') + (c.note && !(S.auditor && c.st === 'chk') ? '<div style="color:var(--muted);font-size:13px;margin-top:4px">' + esc(c.note) + '</div>' : '') + '</td><td><div class="chips">' + (docs || '—') + '</div></td><td>' + st + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<div class="note">أوراق قسم «' + SE + '» (' + S.docs.filter(function (r) { return r.d === SE; }).length + ' ورقة) مرقمة على بنود ISO 14001 وISO 45001، ولذلك لا تظهر في هذا الجدول. <a href="#dept-se">افتح القسم</a></div>';
    return h;
  }

  function vAudit() {
    if (S.auditor) return head('ملاحظات التدقيق', '') + '<p class="empty">هذه الصفحة داخلية ولا تظهر في وضع المراجع.</p>';
    var SV = { h: ['bad', 'مهم'], m: ['warn', 'متوسط'], l: ['', 'للعلم'] }, all = allFindings(), cnt = { open: 0, prog: 0, done: 0 }, w = canWrite();
    all.forEach(function (f) { cnt[fState(f)]++; });
    var h = head('ملاحظات التدقيق وخطة التصحيح', '<span class="num">' + all.length + ' ملاحظة من مراجعة الملفات نفسها. لم تُعدَّل أي ورقة أصلية.</span>');
    h += '<div class="tiles"><div class="tile"><b class="num" style="color:var(--bad)">' + cnt.open + '</b><span>مفتوحة</span></div><div class="tile"><b class="num" style="color:var(--warn)">' + cnt.prog + '</b><span>جارٍ العمل</span></div><div class="tile"><b class="num" style="color:var(--good)">' + cnt.done + '</b><span>أُغلقت</span></div><div class="tile"><b class="num">' + Math.round(100 * cnt.done / all.length) + '%</b><span>نسبة الإغلاق</span></div></div>';
    S.extra.audit.forEach(function (g) {
      h += '<div class="grp"><h2>' + esc(g.g) + '</h2>' + g.items.map(function (f) {
        var st = fState(f), o = S.find[f.id] || {}, sd = FST.filter(function (x) { return x[0] === st; })[0];
        var track = w ? '<div class="track"><label>الحالة<select class="mini" data-chg="fst" data-id="' + f.id + '">' + FST.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === st ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label>المسؤول<input class="mini" type="text" maxlength="60" data-chg="fown" data-id="' + f.id + '" value="' + esc(o.owner || '') + '"></label><label>الموعد<input class="mini" type="date" data-chg="fdue" data-id="' + f.id + '" value="' + esc(o.due || '') + '"></label><label style="flex:1;min-width:180px">الإجراء المتخذ<input class="mini" type="text" maxlength="200" data-chg="fnote" data-id="' + f.id + '" value="' + esc(o.note || '') + '"></label></div>'
          : ((o.owner || o.due || o.note) ? '<div style="color:var(--muted);font-size:13px">' + esc([o.owner ? 'المسؤول: ' + o.owner : '', o.due ? 'الموعد: ' + fmtDate(o.due) : '', o.note || ''].filter(Boolean).join(' · ')) + '</div>' : '');
        return '<div class="find ' + f.s + '"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="pill ' + SV[f.s][0] + '">' + SV[f.s][1] + '</span><span class="pill ' + sd[2] + '">' + sd[1] + '</span><h3>' + esc(f.t) + '</h3></div><p>' + esc(f.x) + '</p>' + (f.r.length ? '<div class="chips" style="display:flex;flex-wrap:wrap;gap:5px">' + f.r.map(function (c) { return '<button class="chip" data-act="code" data-code="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' : '') + track + '</div>';
      }).join('') + '</div>';
    });
    return h;
  }

  function vExpiry() {
    var items = expItems(), w = canWrite();
    var h = head('تواريخ الانتهاء', 'المعايرة والعقود والتراخيص. يظهر التنبيه قبل الموعد بثلاثين يومًا.');
    h += '<div class="tblw"><table><thead><tr><th>البند</th><th>القسم</th><th>تاريخ الانتهاء</th><th>المتبقي</th><th>الحالة</th><th>ملاحظة</th><th></th></tr></thead><tbody>' + (items.map(function (x) {
      var p = x.days < 0 ? ['bad', 'منتهٍ'] : x.days <= 30 ? ['warn', 'يقترب'] : ['good', 'سارٍ'];
      return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.d || '') + '</td><td class="num">' + esc(fmtDate(x.date)) + '</td><td class="num">' + (x.days < 0 ? 'منذ ' + (-x.days) + ' يوم' : x.days + ' يوم') + '</td><td><span class="pill ' + p[0] + '">' + p[1] + '</span></td><td>' + esc(x.note || '') + '</td><td>' + (!x.fixed && canAdmin() ? '<button class="btn danger" data-act="del" data-kind="expiry" data-id="' + esc(x.id) + '" data-label="' + esc(x.name) + '">حذف</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="7">لا توجد بنود.</td></tr>') + '</tbody></table></div>';
    h += '<div class="note">البنود التي ملاحظتها «من GEM-…» مقروءة من أوراقكم كما هي. باقي البنود يضيفها من له صلاحية الكتابة.</div>';
    if (w) h += '<div class="find l"><h3>إضافة بند</h3><div class="track"><label style="flex:2;min-width:200px">البند<input class="mini" id="ex-n" type="text" maxlength="120" placeholder="مثال: شهادة الحماية المدنية"></label><label>القسم<select class="mini" id="ex-d">' + DEPTS.map(function (d) { return '<option>' + esc(d.k) + '</option>'; }).join('') + '</select></label><label>تاريخ الانتهاء<input class="mini" id="ex-t" type="date"></label><label style="flex:1;min-width:160px">ملاحظة<input class="mini" id="ex-o" type="text" maxlength="160"></label><button class="btn pri" data-act="exadd" style="align-self:flex-end">إضافة</button></div></div>';
    return h;
  }

  function vAccess() {
    if (!canAdmin()) return head('صلاحيات الأقسام', '') + '<p class="empty">هذه الصفحة لمن له صلاحية التعديل على النظام.</p>';
    var h = head('صلاحيات الأقسام', 'حدّد لكل شخص الأقسام التي يرفع في أرشيفها ويحدّث أدلتها.');
    h += '<div class="note">هذا تنظيم داخل النظام: من لم يُخصَّص له قسم لا تظهر له أزرار الأرشفة والتحديث. يجب أيضًا أن تشارك النظام مع الشخص من زر المشاركة في claude.ai بمستوى Contributor على الأقل، فهذه الصفحة لا تمنح الوصول نفسه. من له مستوى Editor يرفع في كل الأقسام.</div>';
    h += '<label class="search" style="max-width:420px;flex:none"><input id="uq" type="search" placeholder="ابحث باسم الشخص لإضافته" aria-label="بحث عن شخص"></label><div id="uhits" class="chips" style="display:flex;flex-wrap:wrap;gap:6px"></div>';
    var ids = Object.keys(S.roles);
    if (!ids.length) return h + '<p class="empty">لم يُخصَّص أي قسم لأي شخص بعد.</p>';
    h += '<div class="tblw"><table><thead><tr><th>الشخص</th>' + DEPTS.map(function (d) { return '<th>' + esc(dName(d.k)) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' + ids.map(function (id) {
      return '<tr><td>' + esc(S.names[id] || 'مستخدم') + '</td>' + DEPTS.map(function (d) { return '<td><input type="checkbox" data-chg="role" data-id="' + esc(id) + '" data-dept="' + esc(d.k) + '"' + (S.roles[id].indexOf(d.k) >= 0 ? ' checked' : '') + ' aria-label="' + esc(d.k) + '"></td>'; }).join('') + '<td><button class="btn danger" data-act="del" data-kind="roles" data-id="' + esc(id) + '" data-label="صلاحيات ' + esc(S.names[id] || 'المستخدم') + '">إزالة</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }

  function route() { var h = (location.hash || '').replace('#', ''); return h || 'home'; }
  function renderNav() {
    var r = route(), a = function (h, t, n, ic) { return '<a href="#' + h + '"' + (r === h ? ' aria-current="page"' : '') + '><span>' + (ic || '') + esc(t) + '</span>' + (n != null ? '<small class="num">' + n + '</small>' : '') + '</a>'; };
    var ex = expItems().filter(function (x) { return x.days <= 30; }).length;
    $('nav').innerHTML = '<div style="font-size:11px;color:var(--muted);padding:0 12px 6px" class="num">الإصدار 9</div>' + a('home', 'الرئيسية') + a('search', 'بحث شامل') + '<h4>الأقسام</h4>' + DEPTS.filter(function (d) { return deptAllowed(d.k); }).map(function (d) { return a(d.h, dName(d.k), S.docs.filter(function (x) { return x.d === d.k; }).length, dIcon(d.k, 18)); }).join('') +
      '<h4>للعرض على المراجع</h4>' + a('evidence', 'قائمة الأدلة') + a('trace', 'بحث الأرشيف') + a('iso', 'بنود ISO 9001') + a('expiry', 'تواريخ الانتهاء', ex || null) +
      '<h4>التشغيل</h4>' + (S.auditor ? '' : a('mine', 'شغلي') + a('m', 'شاشة الصالة') + a('notes', 'الإشعارات', unread() || null)) + (S.auditor ? '' : a('alerts', 'التنبيهات', alertData().total || null)) + a('orders', 'أوامر الإنتاج', S.ord.filter(function (o) { return !o.closed; }).length || null) + a('stock', 'الخزينة والمخزون') + a('cust', 'العملاء: شكاوى ورضا', S.x.complaints.filter(function (c) { return c.st !== 'مغلقة'; }).length || null) + a('batch', 'ملف التشغيلة') + a('ncr', 'عدم المطابقة', S.ncr.filter(function (n) { return n.st !== 'مغلقة'; }).length || null) + a('equip', 'المعدات والمعايرة', equipDue().length || null) + a('training', 'مصفوفة التدريب') + a('kpi', 'مؤشرات الأداء') + a('cycles', 'خطوات الإجراءات') + a('purchases', 'المشتريات') + a('suppliers', 'سجل الموردين') + (S.auditor ? '' : a('bulk', 'رفع بيانات')) + (S.auditor ? '' : '<h4>إدارة داخلية</h4>' + a('audit', 'ملاحظات التدقيق', allFindings().filter(function (f) { return fState(f) !== 'done'; }).length) + a('audits', 'التدقيق الداخلي') + a('mr', 'مراجعة الإدارة') + a('risks', 'المخاطر والفرص') + a('report', 'التقرير الشهري') + a('log', 'سجل النشاط') + (S.cap.canEdit ? a('access', 'المستخدمون') + a('library', 'مكتبة الأوراق') : '')) +
      '<button class="btn" data-act="auditor" style="margin:14px 6px 6px;justify-content:center" aria-pressed="' + S.auditor + '">' + (S.auditor ? 'إيقاف وضع المراجع' : 'تشغيل وضع المراجع') + '</button>';
  }
  var lastRoute = '';
  function render() {
    if (!S.extra) return;
    var act = document.activeElement;
    if (act && act.dataset && act.dataset.chg && act.tagName !== 'SELECT' && act.type !== 'checkbox') { render._pending = true; return; }
    var r = route(), d = DEPTS.filter(function (x) { return x.h === r; })[0], dr = /^doc-/.test(r) ? S.byId[r.slice(4)] : null;
    var fid = act && /^(q|dq|tq|uq|aq|docq)$/.test(act.id || '') ? act.id : '', pos = fid ? act.selectionStart : 0, keep = {};
    ['ex-n', 'ex-o', 'ex-t', 'uq', 'nu-u', 'nu-n', 'nu-p', 'bk-d'].forEach(function (i) { if ($(i)) keep[i] = $(i).value; });
    var hits = $('uhits') ? $('uhits').innerHTML : '';
    var open = {}; Array.prototype.forEach.call(view.querySelectorAll('details.sec'), function (el) { var t = el.querySelector('summary .t'); if (t) open[t.textContent] = el.open; });
    var st = $('main').scrollTop;
    view.innerHTML = dr ? vDoc(dr) : d ? vDept(d) : r === 'evidence' ? vEvidence() : r === 'iso' ? vIso() : r === 'audit' ? vAudit() : r === 'trace' ? vTrace() : r === 'expiry' ? vExpiry() : r === 'access' ? vAccess2() : r === 'audits' ? vAudits() : r === 'mr' ? vMr() : r === 'risks' ? vRisks() : r === 'cust' ? vCust() : r === 'stock' ? vStock() : r === 'search' ? vSearch() : r === 'm' ? vMobile() : /^batch-/.test(r) ? (S.bq = decodeURIComponent(r.slice(6)), vBatch()) : /^equip-/.test(r) ? vEquip() : r === 'mine' ? vMine() : r === 'notes' ? vNotes() : r === 'batch' ? vBatch() : r === 'ncr' ? vNcr() : r === 'equip' ? vEquip() : r === 'training' ? vTraining() : r === 'kpi' ? vKpi() : r === 'orders' ? vOrders() : /^order-/.test(r) ? vOrder(r.slice(6)) : r === 'cycles' ? vCycles() : r === 'alerts' ? vAlerts() : /^sup-/.test(r) ? vSupFile2(decodeURIComponent(r.slice(4))) : r === 'purchases' ? vPurchases() : r === 'suppliers' ? vSuppliers() : r === 'library' ? vLibrary2() : r === 'bulk' ? vBulk() : r === 'log' ? vLog() : r === 'report' ? vReport() : vHome();
    if (r === lastRoute) { Array.prototype.forEach.call(view.querySelectorAll('details.sec'), function (el) { var t = el.querySelector('summary .t'); if (t && t.textContent in open && !fid) el.open = open[t.textContent]; }); $('main').scrollTop = st; for (var k in keep) if ($(k)) $(k).value = keep[k]; if ($('uhits')) $('uhits').innerHTML = hits; } else $('main').scrollTop = 0;
    lastRoute = r; renderNav();
    if (fid && $(fid)) { $(fid).focus(); try { $(fid).setSelectionRange(pos, pos); } catch (e) { } }
  }

  /* ---------- events ---------- */
  function setFinding(id, patch) {
    var cur = S.find[id] || {}, o = { st: cur.st || 'open', owner: cur.owner || '', due: cur.due || '', note: cur.note || '' };
    for (var k in patch) o[k] = patch[k];
    o.at = new Date().toISOString(); o.by = S.cap.uid;
    S.cap.db.doc('findings/' + id).set(o).catch(function () { toast('تعذر الحفظ. قد لا تملك صلاحية الكتابة.'); });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) { if ($('rail').classList.contains('on') && !ev.target.closest('#rail')) $('rail').classList.remove('on'); return; }
    var act = b.dataset.act, r = S.byId[b.dataset.id];
    if (act === 'view' && r) viewDoc(r);
    else if (act === 'blank' && r) saveOriginal(r, true);
    else if (act === 'pdf' && r) savePdf(r);
    else if (act === 'orig' && r) saveOriginal(r);
    else if (act === 'bulk') saveDeptForms(b.dataset.dept);
    else if (act === 'up' && r) openUpload(r);
    else if (act === 'fill' && r) openFill(r);
    else if (act === 'fsave') fillExport();
    else if (act === 'fclose') closeFill();
    else if (act === 'ftick') { if (F) { F.tick = !F.tick; b.setAttribute('aria-pressed', F.tick); } }
    else if (act === 'ver' && r) openVer(r);
    else if (act === 'dover' && r) doVer(r);
    else if (act === 'vview' || act === 'vsave') { var vv = (S.vers || []).filter(function (x) { return x.id === b.dataset.id; })[0]; if (vv) { if (act === 'vview') recOpen(vv); else recSave(vv); } }
    else if (act === 'doup' && r) doUpload(r);
    else if (act === 'na' && r) openNA(r);
    else if (act === 'dona' && r) doNA(r);
    else if (act === 'code') { var t = S.byCode[b.dataset.code]; if (t) viewDoc(t); else toast('لا يوجد ملف بهذا الكود في النظام.'); }
    else if (act === 'tab') { var d = DEPTS.filter(function (x) { return x.h === route(); })[0]; if (d) { S.tab[d.k] = b.dataset.tab; lastRoute = ''; render(); } }
    else if (act === 'closev') closeViewer();
    else if (act === 'closed') closeDlg();
    else if (act === 'menu') { $('rail').classList.toggle('on'); ev.stopPropagation(); }
    else if (act === 'auditor') { S.auditor = !S.auditor; try { localStorage.setItem('gem-auditor', S.auditor ? '1' : '0'); } catch (e) { } if (S.auditor && /^(audit|access)$/.test(route())) location.hash = 'home'; lastRoute = ''; render(); toast(S.auditor ? 'وضع المراجع يعمل: العرض فقط، بدون أزرار التعديل والصفحات الداخلية.' : 'أُوقف وضع المراجع.'); }
    else if (act === 'aview' || act === 'asave') {
      var a = S.arch.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!a) return;
      if (act === 'aview') recOpen(a); else recSave(a);
    }
    else if (act === 'del') askDelete(b.dataset.kind, b.dataset.id, b.dataset.label || '');
    else if (act === 'dodel') doDelete(b.dataset.kind, b.dataset.id);
    else if (act === 'exadd') {
      var n = $('ex-n').value.trim(), dt = $('ex-t').value;
      if (!n || !dt) { toast('اكتب اسم البند واختر تاريخ الانتهاء.'); return; }
      S.cap.db.collection('expiry').add({ name: n, d: $('ex-d').value, date: dt, note: $('ex-o').value.trim(), at: new Date().toISOString(), by: S.cap.uid }).then(function () { $('ex-n').value = ''; $('ex-o').value = ''; $('ex-t').value = ''; toast('أُضيف البند.'); render(); }).catch(function () { toast('تعذر الحفظ. قد لا تملك صلاحية الكتابة.'); });
    }
    else if (act === 'uadd') { S.names[b.dataset.id] = b.textContent; S.cap.db.doc('roles/' + b.dataset.id).set({ depts: [] }).then(function () { if ($('uq')) $('uq').value = ''; if ($('uhits')) $('uhits').innerHTML = ''; toast('أُضيف. حدّد أقسامه من الجدول.'); }).catch(function () { toast('تعذر الحفظ.'); }); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.dataset && t.dataset.chg; if (!c || (!S.cap.db && c !== 'tf' && c !== 'fpt')) return;
    if (c === 'freq') S.cap.db.doc('formcfg/' + t.dataset.id).set({ freq: t.value, at: new Date().toISOString(), by: S.cap.uid }).catch(function () { toast('تعذر الحفظ. قد لا تملك صلاحية الكتابة.'); });
    else if (c === 'fst') setFinding(t.dataset.id, { st: t.value });
    else if (c === 'fown') setFinding(t.dataset.id, { owner: t.value.trim() });
    else if (c === 'fdue') setFinding(t.dataset.id, { due: t.value });
    else if (c === 'fnote') setFinding(t.dataset.id, { note: t.value.trim() });
    else if (c === 'tf') { S.tf = S.tf || {}; S.tf[t.dataset.k] = t.value; render(); }
    else if (c === 'fpt') { if (F) F.pt = +t.value; }
    else if (c === 'role') { var cur = (S.roles[t.dataset.id] || []).slice(), i = cur.indexOf(t.dataset.dept); if (t.checked && i < 0) cur.push(t.dataset.dept); if (!t.checked && i >= 0) cur.splice(i, 1); S.cap.db.doc('roles/' + t.dataset.id).set({ depts: cur }).catch(function () { toast('تعذر الحفظ.'); }); }
  });
  document.addEventListener('focusout', function () { if (render._pending) { render._pending = false; setTimeout(render, 0); } });
  document.addEventListener('input', function (ev) {
    var id = ev.target.id;
    if (id === 'q') { S.q = ev.target.value.trim(); render(); }
    else if (id === 'tq') { S.tq = ev.target.value.trim(); render(); }
    else if (id === 'aq') { S.aq = ev.target.value.trim(); render(); }
    else if (id === 'docq') { S.docq = ev.target.value.trim(); render(); }
    else if (id === 'dq') { var d = DEPTS.filter(function (x) { return x.h === route(); })[0]; if (d) { S.dq[d.k] = ev.target.value.trim(); render(); } }
    else if (id === 'uq' && S.cap.user) {
      Promise.resolve(S.cap.user.search(ev.target.value.trim())).then(function (hits) {
        var box = $('uhits'); if (!box) return; box.innerHTML = '';
        (hits || []).forEach(function (p) { if (!p.id || S.roles[p.id]) return; var b = document.createElement('button'); b.className = 'btn'; b.dataset.act = 'uadd'; b.dataset.id = p.id; b.textContent = p.name || 'مستخدم'; box.appendChild(b); });
        if (!box.children.length && ev.target.value.trim()) box.textContent = 'لا يوجد شخص بهذا الاسم، أو البحث غير متاح في هذا العرض.';
      }).catch(function () { });
    }
  });
  $('fpages').addEventListener('click', fillClick);
  $('fpages').addEventListener('focusout', function (ev) { var b = ev.target; if (b.classList && b.classList.contains('fbox') && !b.innerText.trim()) b.remove(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { if ($('dlg').classList.contains('on')) closeDlg(); else if ($('viewer').classList.contains('on')) closeViewer(); } });
  window.addEventListener('hashchange', function () { $('rail').classList.remove('on'); closeDlg(); closeViewer(); closeFill(); S.docq = ''; render(); });


  /* ================= standalone overrides (local files + Firebase) ================= */
  var SCHEME = { docx: 'ms-word', doc: 'ms-word', xlsx: 'ms-excel', pptx: 'ms-powerpoint' };
  function fileUrl(r) { return new URL(r.p.split('/').map(encodeURIComponent).join('/'), location.href).href; }
  function openDoc(r, mode) {
    var u = fileUrl(r), sc = SCHEME[r.e];
    if (!sc) { window.open(u, '_blank'); return; }
    location.href = sc + ':' + (mode === 'new' ? 'nft' : mode === 'edit' ? 'ofe' : 'ofv') + '|u|' + u;
    toast(mode === 'new' ? 'يفتح ' + OFFICE[r.e] + ' نسخة جديدة من النموذج. املأها واحفظها ثم ارفعها بزر «أرشفة».' : mode === 'edit' ? 'يفتح الملف في ' + OFFICE[r.e] + ' للتعديل. بعد الحفظ ارفعه من «تحديث الملف» ليصل لباقي الأجهزة.' : 'يفتح الملف في ' + OFFICE[r.e] + '.', 7000);
  }
  function load() {
    S.docs = window.GEM_DOCS; S.extra = window.GEM_EXTRA;
    S.docs.forEach(function (r) { S.byId[r.i] = r; if (r.c && r.k !== 'record' && (!S.byCode[r.c] || S.byCode[r.c].k === 'attach')) S.byCode[r.c] = r; });
    S.extra.audit.forEach(function (g, gi) { g.items.forEach(function (f, ii) { f.id = 'f' + gi + '-' + ii; var d = f.r.length && S.byCode[f.r[0]]; f.d = d ? d.d : ''; }); });
    return Promise.resolve();
  }
  function viewDoc(r) { openDoc(r, 'view'); }
  function saveOriginal(r, blank) { openDoc(r, blank ? 'new' : 'edit'); }
  function savePdf(r) { openDoc(r, 'view'); }
  function openFill(r) { openDoc(r, 'new'); }
  function saveDeptForms() { toast('نماذج القسم موجودة كملفات داخل مجلد IMS بجانب النظام.'); }
  function canWrite() { return !S.auditor && !!S.cap.db; }
  function canWriteDept() { return !S.auditor && !!S.cap.db; }
  function canUp() { return !S.auditor && !!S.cap.db && !!S.cap.assets; }
  function storeFile(f) {
    var ext = (f.name.split('.').pop() || '').toLowerCase();
    return S.cap.assets.upload(f).then(function (res) { return { asset: res.id, ct: f.type || EXT_TYPE[ext] || ext, size: f.size, name: f.name }; });
  }
  function recBlob(a) { return S.cap.assets.get(a.asset, a.ct); }
  function recViewable(a) { return a.ct === 'application/pdf' || /^image\//.test(a.ct || ''); }
  function recOpen(a) { toast('جارٍ تحميل الملف…', 15000); recBlob(a).then(function (b) { $('toast').classList.remove('on'); window.open(URL.createObjectURL(b), '_blank'); }).catch(function () { toast('تعذر تحميل الملف. تحقق من الاتصال.'); }); }
  function archNotice() {
    if (window.GEM_NOFB) return '<div class="note">المزامنة غير مفعّلة بعد. ضع إعدادات مشروع Firebase في ملف firebase-config.js (الخطوات في ملف «اقرأني»). الأوراق نفسها تعمل الآن من مجلد IMS.</div>';
    if (!S.cap.db) return '<div class="note">سجّل الدخول لتظهر بيانات الأرشيف والمزامنة.</div>';
    return '';
  }
  function rowHtml(r, showDept) {
    var n = archOf(r.i).length, sub = '';
    if (r.c) sub += '<span class="code">' + esc(r.c) + '</span>';
    sub += '<span class="pill ' + (r.k === 'form' ? 'form' : '') + '">' + KIND[r.k] + '</span>';
    if (r.t && r.t !== r.n) sub += '<span>' + esc(r.n) + '.' + r.e + '</span>'; else sub += '<span class="ltr">.' + r.e + '</span>';
    if (showDept) sub += '<span>' + esc(r.d) + (r.s ? ' / ' + esc(r.s) : '') + '</span>';
    if (verOf(r.i).length) sub += '<span class="pill form num">محدَّث ' + verOf(r.i).length + ' مرة</span>';
    var of = OFFICE[r.e], a = '<button class="btn" data-act="view" data-id="' + r.i + '">عرض</button>';
    if (r.k === 'form' && of) a += '<button class="btn pri" data-act="blank" data-id="' + r.i + '">فتح نسخة للملء</button>';
    if (of && !S.auditor) a += '<button class="btn" data-act="orig" data-id="' + r.i + '">تعديل في ' + of + '</button>';
    if (canUp(r)) a += '<button class="btn" data-act="up" data-id="' + r.i + '">أرشفة</button>';
    a += '<a class="btn" href="#doc-' + r.i + '">الأرشيف' + (n ? ' (' + n + ')' : '') + '</a>';
    return '<div class="row"><div><div class="ttl">' + esc(title(r)) + '</div><div class="sub">' + sub + '</div></div><div class="acts">' + a + '</div></div>';
  }
  function vAccess0() {
    if (!canAdmin()) return head('المستخدمون', '') + '<p class="empty">هذه الصفحة للمسؤولين فقط.</p>';
    var us = ((window.GEM_FB && window.GEM_FB.users) || []).filter(function (u) { return !u.replaced; }).sort(function (p, q) { return String(p.username).localeCompare(String(q.username)); });
    var h = head('المستخدمون', 'أضف مستخدمين باسم مستخدم وكلمة مرور، بدون بريد إلكتروني.');
    h += '<div class="find l"><h3>إضافة مستخدم</h3><div class="track"><label>اسم المستخدم (إنجليزي)<input class="mini" id="nu-u" type="text" dir="ltr" maxlength="30" placeholder="ahmed"></label><label style="flex:1;min-width:160px">الاسم<input class="mini" id="nu-n" type="text" maxlength="60" placeholder="أحمد جمال"></label><label>كلمة المرور<input class="mini" id="nu-p" type="text" dir="ltr" maxlength="40" placeholder="6 حروف على الأقل"></label><label>الصلاحية<select class="mini" id="nu-r"><option value="user">مستخدم</option><option value="admin">مسؤول</option></select></label><button class="btn pri" data-adm="uadd" style="align-self:flex-end">إضافة</button></div></div>';
    h += '<div class="tblw"><table><thead><tr><th>اسم المستخدم</th><th>الاسم</th><th>الصلاحية</th><th>الحالة</th><th></th></tr></thead><tbody>' + (us.map(function (u) {
      return '<tr><td class="ltr">' + esc(u.username) + '</td><td>' + esc(u.name || '') + '</td><td>' + (u.role === 'admin' ? 'مسؤول' : 'مستخدم') + '</td><td><span class="pill ' + (u.active ? 'good' : 'bad') + '">' + (u.active ? 'مفعّل' : 'موقوف') + '</span></td><td><div class="acts"><button class="btn" data-adm="urole" data-u="' + esc(u.uid) + '" data-v="' + (u.role === 'admin' ? 'user' : 'admin') + '">' + (u.role === 'admin' ? 'اجعله مستخدمًا' : 'اجعله مسؤولًا') + '</button><button class="btn" data-adm="ureset" data-u="' + esc(u.uid) + '">كلمة مرور جديدة</button><button class="btn ' + (u.active ? 'danger' : '') + '" data-adm="uact" data-u="' + esc(u.uid) + '" data-v="' + (u.active ? '0' : '1') + '">' + (u.active ? 'إيقاف' : 'تفعيل') + '</button></div></td></tr>';
    }).join('') || '<tr><td colspan="5">لا يوجد مستخدمون بعد. أضف أول مستخدم من النموذج أعلاه.</td></tr>') + '</tbody></table></div>';
    h += '<div class="note">المستخدم يدخل باسم المستخدم وكلمة المرور، ويغيّر كلمة مروره من «تغيير كلمة المرور» تحت اسم الشركة. إذا نسيها اضغط «كلمة مرور جديدة» أمام اسمه. «مسؤول» يحذف من الأرشيف ويدير المستخدمين.</div>';
    return h;
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-adm]'), FBX = window.GEM_FB; if (!b || !FBX) return;
    if (b.dataset.adm === 'uadd') {
      var u = ($('nu-u').value || '').trim().toLowerCase(), n = ($('nu-n').value || '').trim(), p = $('nu-p').value || '';
      if (!/^[a-z0-9._-]{3,30}$/.test(u)) { toast('اسم المستخدم: حروف إنجليزية وأرقام فقط، 3 حروف على الأقل.'); return; }
      if (!n) { toast('اكتب اسم الموظف.'); return; }
      if (p.length < 6) { toast('كلمة المرور 6 حروف على الأقل.'); return; }
      b.disabled = true;
      FBX.addUser(u, n, p, $('nu-r').value).then(function () { toast('أُضيف المستخدم ' + u + '. سلّمه اسم المستخدم وكلمة المرور.', 7000); $('nu-u').value = ''; $('nu-n').value = ''; $('nu-p').value = ''; render(); })
        .catch(function (e) { b.disabled = false; toast(/already-in-use/.test(e && e.code || '') ? 'اسم المستخدم مستخدم من قبل. اختر اسمًا آخر.' : /weak-password/.test(e && e.code || '') ? 'كلمة المرور ضعيفة.' : 'تعذرت الإضافة. تأكد من نشر القواعد الجديدة ومن الاتصال.', 7000); });
    } else if (b.dataset.adm === 'urole') FBX.setUser(b.dataset.u, { role: b.dataset.v }).catch(function () { toast('تعذر الحفظ.'); });
    else if (b.dataset.adm === 'ureset') { var FBX = window.GEM_FB || {}, uu = (FBX.users || []).filter(function (y) { return y.uid === b.dataset.u; })[0], np = uu && window.prompt('كلمة المرور الجديدة للمستخدم ' + uu.username + ' (6 حروف على الأقل)'); if (!uu || np == null) return; if (np.length < 6) { toast('كلمة المرور قصيرة.'); return; } FBX.resetPassword(uu, np).then(function () { toast('تم تعيين كلمة مرور جديدة للمستخدم ' + uu.username + '.', 7000); }).catch(function () { toast('تعذر تعيين كلمة المرور. تأكد من نشر القواعد الجديدة.', 7000); }); }
    else if (b.dataset.adm === 'uact') FBX.setUser(b.dataset.u, { active: b.dataset.v === '1' }).catch(function () { toast('تعذر الحفظ.'); });
  });
  window.addEventListener('gem-admins', function () { if (S.cap.user) Promise.resolve(S.cap.user.canEdit()).then(function (v) { S.cap.canEdit = !!v; render(); }); });


  /* ================= extensions: library, purchases, suppliers, bulk, log, report, approvals ================= */
  var WNS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', LOCAL = location.protocol === 'file:';
  S.lib = {}; S.pur = []; S.sup = {}; S.log = []; S.bulk = [];
  function ym(d) { return String(d || '').slice(0, 7); }
  function money(n) { return (+n || 0).toLocaleString('en-US'); }
  function meName() { return (window.GEM_FB && window.GEM_FB.label) || ''; }
  function extSubs() {
    var db = S.cap.db; if (!db || extSubs.done) return; extSubs.done = true;
    var rows = function (s) { return s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }); }, q = function () { };
    db.collection('lib').onSnapshot(function (s) { S.lib = {}; rows(s).forEach(function (r) { S.lib[r.id] = r; }); render(); }, q);
    db.collection('purchases').onSnapshot(function (s) { S.pur = rows(s); render(); }, q);
    db.collection('suppliers').onSnapshot(function (s) { S.sup = {}; rows(s).forEach(function (r) { S.sup[r.id] = r; }); render(); }, q);
    db.collection('log').onSnapshot(function (s) { S.log = rows(s).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }); if (route() === 'log') render(); }, q);
  }
  setInterval(extSubs, 800);

  /* ---- approved versions ---- */
  function okVer(v) { return !v.st || v.st === 'approved'; }
  function curVer(id) { return verOf(id).filter(okVer)[0] || null; }
  function verPill(v, id) { var c = curVer(id); return v.st === 'pending' ? '<span class="pill warn">بانتظار الاعتماد</span> ' : (c && c.id === v.id ? '<span class="pill good">الإصدار الحالي</span> ' : '') + (v.issue ? '<span class="pill">إصدار ' + esc(v.issue) + '</span> ' : ''); }
  function verActs(v) { return v.st === 'pending' && canAdmin() ? '<button class="btn pri" data-x="vok2" data-id="' + esc(v.id) + '">اعتماد</button>' : ''; }

  /* ---- where a document's bytes come from ---- */
  function docBlob(r) {
    var v = curVer(r.i);
    if (v) return recBlob(v);
    if (S.lib[r.i]) return S.cap.assets.get('lib-' + r.i, EXT_TYPE[r.e] || '');
    if (!LOCAL) return fetch(fileUrl(r)).then(function (x) { if (!x.ok) throw 0; return x.blob(); });
    return Promise.reject(new Error('nolib'));
  }
  function openDoc(r, mode) {
    var v = curVer(r.i), sc = SCHEME[r.e];
    if (LOCAL && !v) {
      var u = fileUrl(r);
      if (!sc) { window.open(u, '_blank'); return; }
      location.href = sc + ':' + (mode === 'new' ? 'nft' : mode === 'edit' ? 'ofe' : 'ofv') + '|u|' + u;
      toast(mode === 'new' ? 'يفتح ' + OFFICE[r.e] + ' نسخة جديدة من النموذج. املأها واحفظها ثم ارفعها بزر «أرشفة».' : mode === 'edit' ? 'يفتح الملف في ' + OFFICE[r.e] + ' للتعديل. بعد الحفظ ارفعه من «تحديث الملف» ليصل لباقي الأجهزة.' : 'يفتح الملف في ' + OFFICE[r.e] + '.', 7000);
      return;
    }
    if (mode === 'new' && r.e === 'docx' && isArchivable(r) && !S.auditor) { openFos(r); return; }
    if (mode !== 'dl') { viewDoc(r); return; }
    toast('جارٍ تحميل الملف…', 20000);
    docBlob(r).then(function (b) {
      $('toast').classList.remove('on');
      if (!sc && !v) { window.open(URL.createObjectURL(new Blob([b], { type: EXT_TYPE[r.e] || 'application/octet-stream' })), '_blank'); return; }
      var nm = v ? v.name : r.n + '.' + r.e;
      save(nm, b, 'نزل الملف. افتحه من شريط التنزيلات' + (mode === 'edit' ? '، وبعد التعديل ارفعه من «تحديث الملف».' : mode === 'new' ? '، املأه واحفظه ثم ارفعه بزر «أرشفة».' : '.'));
    }).catch(function () { toast('الملف غير متاح. يرفع المسؤول الأوراق أولًا من صفحة «مكتبة الأوراق».', 7000); });
  }

  /* ---- library: all original documents kept behind sign-in ---- */
  function vLibrary() {
    if (!canAdmin()) return head('مكتبة الأوراق', '') + '<p class="empty">هذه الصفحة للمسؤولين فقط.</p>';
    var n = S.docs.filter(function (r) { return S.lib[r.i]; }).length;
    return head('مكتبة الأوراق', 'تُحفظ الأوراق الأصلية داخل قاعدة البيانات، فلا تفتح إلا لمن سجّل الدخول.') +
      '<div class="tiles"><div class="tile"><b class="num">' + n + ' / ' + S.docs.length + '</b><span>ورقة مرفوعة للمكتبة</span></div></div>' +
      '<div class="find l"><h3>رفع الأوراق</h3><p>اختر مجلد <span class="code">IMS</span> الموجود على هذا الجهاز. يرفع النظام الأوراق الناقصة فقط، ويمكن إيقافه وإكماله لاحقًا.</p><div class="track"><label>مجلد IMS<input id="lib-f" type="file" webkitdirectory multiple></label><button class="btn pri" data-x="libup" style="align-self:flex-end">بدء الرفع</button></div><div id="lib-s" class="num" style="color:var(--muted);min-height:1.4em"></div></div>' +
      '<div class="note">بعد اكتمال الرفع احذف مجلد IMS من GitHub. الحذف لا يمسح النسخ القديمة من تاريخ المستودع، فإن كان المستودع عامًا اجعله خاصًا أو أنشئ مستودعًا جديدًا بملفات النظام فقط.</div>';
  }
  function libUpload() {
    var fs = Array.prototype.slice.call(($('lib-f').files || [])), st = $('lib-s'), byPath = {};
    if (!fs.length) { st.textContent = 'اختر مجلد IMS أولًا.'; return; }
    fs.forEach(function (f) { var p = (f.webkitRelativePath || f.name).replace(/\\/g, '/'), i = p.indexOf('IMS/'); if (i >= 0) byPath[p.slice(i).normalize('NFC')] = f; });
    var todo = S.docs.filter(function (r) { return !S.lib[r.i] && byPath[r.p.normalize('NFC')]; }), i = 0, miss = S.docs.filter(function (r) { return !S.lib[r.i] && !byPath[r.p.normalize('NFC')]; }).length;
    if (!todo.length) { st.textContent = miss ? 'لم أجد الأوراق الناقصة (' + miss + ') في المجلد المختار. اختر مجلد IMS نفسه.' : 'كل الأوراق مرفوعة.'; return; }
    (function next() {
      if (i >= todo.length) { st.textContent = 'اكتمل رفع ' + todo.length + ' ورقة.' + (miss ? ' لم توجد ' + miss + ' ورقة في المجلد.' : ''); return; }
      var r = todo[i]; st.textContent = 'جارٍ رفع ' + (i + 1) + ' من ' + todo.length + ': ' + r.n;
      S.cap.assets.upload(byPath[r.p.normalize('NFC')], { id: 'lib-' + r.i }).then(function (res) { return S.cap.db.doc('lib/' + r.i).set({ size: res.sizeBytes, at: new Date().toISOString() }); }).then(function () { i++; next(); })
        .catch(function () { st.textContent = 'توقف الرفع عند «' + r.n + '». تحقق من الاتصال ثم اضغط «بدء الرفع» للإكمال.'; });
    })();
  }

  /* ---- suppliers ---- */
  function suppliers() {
    var m = {}; (window.GEM_SUPPLIERS || []).forEach(function (s) { m[s.code] = { code: s.code, name: s.name, scope: s.scope, cls: s.cls, src: s.src, status: 'معتمد' }; });
    Object.keys(S.sup).forEach(function (k) { var o = S.sup[k], b = m[k] || { code: k, status: 'معتمد' }; for (var f in o) if (f !== 'id' && o[f] !== '' && o[f] != null) b[f] = o[f]; m[k] = b; });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  function supBy(code) { return suppliers().filter(function (s) { return s.code === code; })[0]; }
  function supOk(p) { var s = p.sup && supBy(p.sup); return !!s && s.status === 'معتمد'; }
  function supLabel(p) { var s = p.sup && supBy(p.sup); return s ? s.name + ' — ' + s.code : (p.supName || ''); }
  function vSuppliers() {
    var w = canWrite(), list = suppliers();
    var h = head('سجل الموردين', 'الموردون المعتمدون من أوراقكم، ومن أُضيف من داخل النظام، مع مشتريات كل مورد.', w ? '<button class="btn pri" data-x="supnew">إضافة مورد</button>' : '');
    var un = S.pur.filter(function (p) { return !supOk(p); });
    if (un.length) h += '<div class="note">يوجد ' + un.length + ' بند شراء بقيمة ' + money(un.reduce(function (a, p) { return a + (+p.value || 0); }, 0)) + ' ج.م من مورد غير معتمد أو غير محدد. <a href="#purchases">افتح المشتريات</a></div>';
    h += '<div class="tblw"><table><thead><tr><th>الكود</th><th>المورد</th><th>ما يورّده</th><th>التصنيف</th><th>الحالة</th><th>المستندات سارية حتى</th><th>عدد المشتريات</th><th>إجماليها</th><th></th></tr></thead><tbody>' + list.map(function (s) {
      var ps = S.pur.filter(function (p) { return p.sup === s.code; });
      return '<tr><td><span class="code">' + esc(s.code) + '</span></td><td><a href="#sup-' + esc(s.code) + '">' + esc(s.name) + '</a></td><td>' + esc(s.scope || '') + '</td><td>' + esc(s.cls || '') + '</td><td><span class="pill ' + (s.status === 'معتمد' ? 'good' : s.status === 'موقوف' ? 'bad' : 'warn') + '">' + esc(s.status) + '</span></td><td class="num">' + esc(fmtDate(s.valid) || '') + '</td><td class="num">' + (ps.length || '—') + '</td><td class="num">' + (ps.length ? money(ps.reduce(function (a, p) { return a + (+p.value || 0); }, 0)) : '—') + '</td><td>' + '<div class="acts"><a class="btn pri" href="#sup-' + esc(s.code) + '">ملف المورد</a>' + (w ? '<button class="btn" data-x="supedit" data-id="' + esc(s.code) + '">تعديل</button>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }
  function supDialog(code) {
    var s = code ? supBy(code) : null, list = suppliers(), nx = 'SUP-' + ('00' + (Math.max.apply(null, list.map(function (x) { return +String(x.code).replace(/\D/g, '') || 0; }).concat([0])) + 1)).slice(-3);
    s = s || { code: nx, name: '', scope: '', cls: 'غير حرج', status: 'تحت الملاحظة', valid: '', alt: '' };
    dlg('<h2>' + (code ? 'تعديل مورد' : 'إضافة مورد') + '</h2><div><span class="code">' + esc(s.code) + '</span></div><label>اسم المورد<input id="sp-n" type="text" maxlength="120" value="' + esc(s.name) + '"></label><label>ما يورّده<input id="sp-s" type="text" maxlength="160" value="' + esc(s.scope || '') + '"></label><div class="two"><label>التصنيف<select id="sp-c"><option' + (s.cls === 'حرج' ? ' selected' : '') + '>حرج</option><option' + (s.cls !== 'حرج' ? ' selected' : '') + '>غير حرج</option></select></label><label>الحالة<select id="sp-t">' + ['معتمد', 'تحت الملاحظة', 'موقوف'].map(function (x) { return '<option' + (s.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div><div class="two"><label>المستندات سارية حتى<input id="sp-v" type="date" value="' + esc(s.valid || '') + '"></label><label>المورد البديل<input id="sp-a" type="text" maxlength="120" value="' + esc(s.alt || '') + '"></label></div><div id="sp-m" style="color:var(--muted);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="supsave" data-id="' + esc(s.code) + '">حفظ</button></div>');
  }

  /* ---- purchases ---- */
  function nextPR(year) { var mx = year === 2026 ? 86 : 0; S.pur.forEach(function (p) { var m = /^PR-(\d{4})-(\d+)$/.exec(p.pr || ''); if (m && +m[1] === year) mx = Math.max(mx, +m[2]); }); return 'PR-' + year + '-' + ('00' + (mx + 1)).slice(-3); }
  function purMonth() { return S.pm == null ? CY + '-' + ('0' + CM).slice(-2) : S.pm; }
  function purList() { var m = purMonth(); return S.pur.filter(function (p) { return !m || ym(p.date) === m; }).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.pr).localeCompare(String(b.pr)); }); }
  function vPurchases() {
    var w = canWrite(), m = purMonth(), list = purList(), months = {}; S.pur.forEach(function (p) { months[ym(p.date)] = 1; }); months[CY + '-' + ('0' + CM).slice(-2)] = 1;
    var h = head('المشتريات', 'كل بند يُسجَّل مرة واحدة، ويخرج منه طلب الشراء وأمر التوريد وسجل المتابعة على نماذجكم.', '<select class="mini" data-chg="pm" aria-label="الشهر"><option value="">كل الشهور</option>' + Object.keys(months).sort().reverse().map(function (k) { return '<option value="' + k + '"' + (k === m ? ' selected' : '') + '>' + MONTHS[+k.slice(5) - 1] + ' ' + k.slice(0, 4) + '</option>'; }).join('') + '</select>' + (w ? '<button class="btn pri" data-x="purnew">بند جديد</button><button class="btn" data-x="purimp">استيراد من Excel</button>' : '') + '<button class="btn" data-x="purlog">تنزيل سجل المتابعة Word</button>');
    var tot = list.reduce(function (a, p) { return a + (+p.value || 0); }, 0), un = list.filter(function (p) { return !supOk(p); });
    h += '<div class="tiles"><div class="tile"><b class="num">' + list.length + '</b><span>بند</span></div><div class="tile"><b class="num">' + money(tot) + '</b><span>الإجمالي ج.م</span></div><div class="tile"><b class="num" style="color:var(--' + (un.length ? 'bad' : 'good') + ')">' + un.length + '</b><span>من مورد غير معتمد أو غير محدد</span></div><div class="tile"><b class="num">' + list.filter(function (p) { return p.status !== 'تم التوريد' && p.status !== 'ملغي'; }).length + '</b><span>لم يورَّد بعد</span></div></div>';
    if (!list.length) return h + '<p class="empty">لا توجد بنود في هذه الفترة.' + (w ? ' اضغط «بند جديد» أو «استيراد من Excel».' : '') + '</p>';
    h += '<div class="tblw"><table><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>البيان</th><th>الإدارة</th><th>الكمية</th><th>المورد</th><th>القيمة</th><th>الحالة</th><th></th></tr></thead><tbody>' + list.map(function (p) {
      return '<tr><td><span class="code">' + esc(p.pr) + '</span></td><td class="num">' + esc(fmtDate(p.date)) + '</td><td>' + esc(p.item) + '</td><td>' + esc(p.dept || '') + '</td><td class="num">' + esc([p.qty, p.unit].filter(Boolean).join(' ')) + '</td><td>' + esc(supLabel(p)) + (supOk(p) ? '' : ' <span class="pill bad">' + (supLabel(p) ? 'غير معتمد' : 'غير محدد') + '</span>') + '</td><td class="num">' + money(p.value) + '</td><td><span class="pill ' + (p.status === 'تم التوريد' ? 'good' : p.status === 'ملغي' ? '' : 'warn') + '">' + esc(p.status || 'مفتوح') + '</span></td><td><div class="acts">' + (w ? '<button class="btn" data-x="puredit" data-id="' + esc(p.id) + '">تعديل</button>' : '') + '<button class="btn" data-x="purpr" data-id="' + esc(p.id) + '">طلب شراء</button><button class="btn" data-x="purpo" data-id="' + esc(p.id) + '">أمر توريد</button>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="purchases" data-id="' + esc(p.id) + '" data-label="' + esc(p.pr) + '">حذف</button>' : '') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }
  function purDialog(id) {
    var p = id ? S.pur.filter(function (x) { return x.id === id; })[0] : null;
    p = p || { pr: nextPR(CY), date: today(), dept: '', item: '', qty: '', unit: '', value: '', sup: '', supName: '', po: '', type: '', need: '', got: '', status: 'مفتوح', purpose: '', note: '' };
    var f = function (l, i, v, t, ex) { return '<label>' + l + '<input id="' + i + '" type="' + (t || 'text') + '" value="' + esc(v == null ? '' : v) + '"' + (ex || '') + '></label>'; };
    dlg('<h2>' + (id ? 'تعديل بند شراء' : 'بند شراء جديد') + '</h2><div class="two">' + f('رقم الطلب', 'pu-pr', p.pr, 'text', ' dir="ltr"') + f('تاريخ الطلب', 'pu-d', p.date, 'date') + '</div>' + f('البيان والمواصفات', 'pu-i', p.item) +
      '<div class="two"><label>الإدارة الطالبة<select id="pu-dp"><option value=""></option>' + DEPTS.map(function (d) { return '<option' + (p.dept === d.k ? ' selected' : '') + '>' + esc(d.k) + '</option>'; }).join('') + '</select></label>' + f('الغرض', 'pu-pp', p.purpose) + '</div>' +
      '<div class="two">' + f('الكمية', 'pu-q', p.qty) + f('الوحدة', 'pu-u', p.unit) + '</div><div class="two">' + f('القيمة ج.م', 'pu-v', p.value, 'number') + '<label>المورد<select id="pu-s"><option value="">غير محدد / مورد آخر</option>' + suppliers().map(function (s) { return '<option value="' + esc(s.code) + '"' + (p.sup === s.code ? ' selected' : '') + '>' + esc(s.code + ' · ' + s.name) + (s.status === 'معتمد' ? '' : ' (' + esc(s.status) + ')') + '</option>'; }).join('') + '</select></label></div>' +
      f('اسم المورد إن لم يكن في السجل', 'pu-sn', p.supName) + '<div class="two">' + f('نوع الشراء', 'pu-t', p.type) + f('رقم أمر التوريد', 'pu-po', p.po, 'text', ' dir="ltr"') + '</div><div class="two">' + f('الموعد المطلوب', 'pu-n', p.need, 'date') + f('تاريخ التوريد الفعلي', 'pu-g', p.got, 'date') + '</div>' +
      '<div class="two"><label>الحالة<select id="pu-st">' + ['مفتوح', 'تم التوريد', 'ملغي'].map(function (x) { return '<option' + (p.status === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' + f('ملاحظات', 'pu-no', p.note) + '</div><div id="pu-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="pursave" data-id="' + esc(id || '') + '">حفظ</button></div>');
  }
  function purSave(id) {
    var g = function (i) { return ($(i).value || '').trim(); }, o = { pr: g('pu-pr'), date: g('pu-d'), item: g('pu-i'), dept: g('pu-dp'), purpose: g('pu-pp'), qty: g('pu-q'), unit: g('pu-u'), value: +g('pu-v') || 0, sup: g('pu-s'), supName: g('pu-s') ? '' : g('pu-sn'), type: g('pu-t'), po: g('pu-po'), need: g('pu-n'), got: g('pu-g'), status: g('pu-st'), note: g('pu-no'), at: new Date().toISOString(), by: S.cap.uid };
    var old = id && S.pur.filter(function (p) { return p.id === id; })[0]; o.order = old ? old.order || '' : S.purOrder || ''; if (!o.pr || !o.date || !o.item) { $('pu-m').textContent = 'رقم الطلب والتاريخ والبيان مطلوبة.'; return; }
    if (S.pur.some(function (p) { return p.pr === o.pr && p.id !== id; })) { $('pu-m').textContent = 'رقم الطلب مستخدم في بند آخر.'; return; }
    var s = o.sup && supBy(o.sup);
    (id ? S.cap.db.doc('purchases/' + id).set(o) : S.cap.db.collection('purchases').add(o)).then(function () { closeDlg(); toast(!s ? 'حُفظ البند. تنبيه: المورد غير معتمد أو غير محدد.' : s.status !== 'معتمد' ? 'حُفظ البند. تنبيه: حالة المورد «' + s.status + '».' : 'حُفظ البند.', 6000); }).catch(function () { $('pu-m').textContent = 'تعذر الحفظ.'; });
  }
  function parseDate(v) {
    if (v instanceof Date) return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
    var s = String(v == null ? '' : v).trim(), m = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(s); if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/.exec(s); if (m) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function purImportDialog() { dlg('<h2>استيراد مشتريات من Excel</h2><p style="margin:0;color:var(--muted)">أول ورقة في الملف، وأول ثلاثة أعمدة بالترتيب: التاريخ، البند، المبلغ. الصف الأول عناوين. تُسجَّل البنود بلا مورد وتكمل بياناتها من «تعديل».</p><label>ملف Excel<input id="im-f" type="file" accept=".xlsx,.xls,.csv"></label><div id="im-s" class="num" style="color:var(--muted);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="purimpgo" id="im-go">استيراد</button></div>'); }
  function purImport() {
    var f = ($('im-f').files || [])[0], st = $('im-s'); if (!f) { st.textContent = 'اختر الملف.'; return; }
    if (!window.XLSX) { st.textContent = 'قارئ Excel غير متاح.'; return; }
    f.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array', cellDates: true }), rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true }).slice(1), ok = [], bad = 0;
      rows.forEach(function (r) { if (!r || (r[0] == null && r[1] == null)) return; var d = parseDate(r[0]), a = +r[2]; if (!d || !String(r[1] || '').trim() || !(a >= 0)) { bad++; return; } ok.push({ date: d, item: String(r[1]).replace(/\s+/g, ' ').trim(), value: a }); });
      if (!ok.length) { st.textContent = 'لم أجد بنودًا صالحة. تأكد من ترتيب الأعمدة.'; return; }
      ok.sort(function (a, b) { return a.date.localeCompare(b.date); });
      $('im-go').disabled = true; var i = 0, nums = {};
      (function next() {
        if (i >= ok.length) { closeDlg(); S.pm = ''; toast('استُورد ' + ok.length + ' بند.' + (bad ? ' تُرك ' + bad + ' صف غير صالح.' : ''), 7000); return; }
        var r = ok[i], y = +r.date.slice(0, 4), base = nums[y] || nextPR(y), n = +base.split('-')[2]; nums[y] = 'PR-' + y + '-' + ('00' + (n + 1)).slice(-3);
        st.textContent = 'جارٍ استيراد ' + (i + 1) + ' من ' + ok.length + '…';
        S.cap.db.collection('purchases').add({ pr: base, date: r.date, item: r.item, value: r.value, dept: '', qty: '', unit: '', sup: '', supName: '', po: '', type: '', need: '', got: '', status: 'مفتوح', purpose: '', note: 'مستورد من ' + f.name, at: new Date().toISOString(), by: S.cap.uid }).then(function () { i++; next(); }).catch(function () { $('im-go').disabled = false; st.textContent = 'توقف الاستيراد بعد ' + i + ' بند.'; });
      })();
    }).catch(function () { st.textContent = 'تعذر قراءة الملف.'; });
  }

  /* ---- fill the company's own Word templates ---- */
  function kids(el, name) { return Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 1 && n.localName === name; }); }
  function cellText(tc) { return Array.prototype.map.call(tc.getElementsByTagNameNS(WNS, 't'), function (t) { return t.textContent; }).join(''); }
  function putCell(doc, tc, text, ltr) {
    if (text == null || text === '') return; var p = kids(tc, 'p')[0]; if (!p) return;
    var r = doc.createElementNS(WNS, 'w:r'), rp = doc.createElementNS(WNS, 'w:rPr'), f = doc.createElementNS(WNS, 'w:rFonts'), t = doc.createElementNS(WNS, 'w:t');
    ['ascii', 'hAnsi', 'cs'].forEach(function (a) { f.setAttributeNS(WNS, 'w:' + a, 'Alyamama SemiBold'); }); rp.appendChild(f);
    ['sz', 'szCs'].forEach(function (a) { var e = doc.createElementNS(WNS, 'w:' + a); e.setAttributeNS(WNS, 'w:val', '16'); rp.appendChild(e); });
    if (!ltr) rp.appendChild(doc.createElementNS(WNS, 'w:rtl'));
    t.setAttribute('xml:space', 'preserve'); t.textContent = String(text); r.appendChild(rp); r.appendChild(t); p.appendChild(r);
  }
  function fillDocx(code, labels, table, filename) {
    var r = S.byCode[code]; if (!r) { toast('النموذج ' + code + ' غير موجود.'); return; }
    if (!window.JSZip) { toast('مولّد Word غير متاح.'); return; }
    toast('جارٍ تجهيز الملف…', 20000);
    var zip;
    docBlob(r).then(function (b) { return JSZip.loadAsync(b); }).then(function (z) { zip = z; return z.file('word/document.xml').async('string'); }).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml'), tbls = Array.prototype.slice.call(doc.getElementsByTagNameNS(WNS, 'tbl'));
      tbls.forEach(function (tb) { kids(tb, 'tr').forEach(function (tr) { var cs = kids(tr, 'tc'); cs.forEach(function (c, i) { var k = cellText(c).trim(); if (labels && labels[k] != null && cs[i + 1] && !cellText(cs[i + 1]).trim()) putCell(doc, cs[i + 1], labels[k]); }); }); });
      if (table) {
        var tb = tbls.filter(function (x) { var tr = kids(x, 'tr')[0]; return tr && cellText(kids(tr, 'tc')[0]).trim() === 'م'; })[0];
        if (tb) { var trs = kids(tb, 'tr'); for (var k = trs.length - 1; k < table.length; k++) trs[trs.length - 1].parentNode.insertBefore(trs[1].cloneNode(true), trs[trs.length - 1].nextSibling); trs = kids(tb, 'tr'); table.forEach(function (row, i) { var cs = kids(trs[i + 1], 'tc'); row.forEach(function (v, j) { if (cs[j]) putCell(doc, cs[j], v); }); }); }
      }
      var out = new XMLSerializer().serializeToString(doc); if (out.indexOf('<?xml') !== 0) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out;
      zip.file('word/document.xml', out); return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    }).then(function (b) { return save(filename, b, 'نزل الملف المملوء. راجعه ثم ارفعه بزر «أرشفة».'); }).catch(function () { toast('تعذر تجهيز الملف. يرفع المسؤول الأوراق أولًا من «مكتبة الأوراق».', 7000); });
  }
  function days(a, b) { if (!a || !b) return ''; var d = Math.round((new Date(b) - new Date(a)) / 86400000); return isFinite(d) && d >= 0 ? String(d) : ''; }
  function purLog() {
    var list = purList(), m = purMonth(); if (!list.length) { toast('لا توجد بنود في هذه الفترة.'); return; }
    fillDocx('GEM-PU-F-8.4-08', null, list.map(function (p, i) { return [i + 1, p.pr, fmtDate(p.date), p.item, p.type, p.po, supLabel(p), money(p.value), fmtDate(p.need), fmtDate(p.got), days(p.date, p.got), p.status, [supOk(p) ? '' : (supLabel(p) ? 'المورد غير معتمد' : 'المورد غير محدد'), p.note].filter(Boolean).join(' – ')]; }), 'GEM-PU-F-8.4-08 سجل متابعة طلبات الشراء - ' + (m || 'كل الشهور') + '.docx');
  }
  function purDoc(id, po) {
    var p = S.pur.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    if (po) { if (!p.po) { toast('اكتب رقم أمر التوريد في البند أولًا من «تعديل».'); return; }
      fillDocx('GEM-PU-F-8.4-06', { 'رقم أمر التوريد (PO-سنة-تسلسل)': p.po, 'التاريخ': fmtDate(p.date), 'المورد وكوده': supLabel(p), 'رقم طلب الشراء': p.pr, 'موعد التسليم': fmtDate(p.need) }, [[1, p.item, '', p.unit, p.qty, '', '', money(p.value)]], 'GEM-PU-F-8.4-06 أمر توريد - ' + p.po + '.docx');
    } else fillDocx('GEM-PU-F-8.4-04', { 'رقم الطلب (PR-سنة-تسلسل)': p.pr, 'التاريخ': fmtDate(p.date), 'الإدارة الطالبة': p.dept, 'تاريخ الاستلام المطلوب': fmtDate(p.need), 'الغرض': p.purpose, 'القيمة التقديرية': money(p.value) }, [[1, '', p.item, p.unit, p.qty, '', '']], 'GEM-PU-F-8.4-04 طلب شراء - ' + p.pr + '.docx');
  }

  /* ---- bulk archive ---- */
  var CODE_RX = /GEM\s*-\s*HR\s*-\s*PA\s*-\s*F\s*-\s*\d\d\s*-\s*\d\d|GEM-[A-Z]{2}-(?:QP|F|WI|PL|PO|MN)-\d+(?:\.\d+)*[a-c]?(?:-\d\d)?/;
  function vBulk() {
    if (!canWrite() || !S.cap.assets) return head('رفع مجمّع للأرشيف', '') + '<p class="empty">سجّل الدخول بحساب له صلاحية الكتابة.</p>';
    var h = head('رفع مجمّع للأرشيف', 'اختر عدة ملفات مرة واحدة. يوزّعها النظام على أوراقها من الكود الموجود في اسم كل ملف.');
    h += '<div class="find l"><div class="track"><label style="flex:2;min-width:240px">الملفات<input id="bk-f" type="file" multiple data-chg="bkfiles"></label><label>تاريخ السجل لما لا يحمل تاريخًا في اسمه<input class="mini" id="bk-d" type="date" value="' + today() + '"></label><button class="btn pri" data-x="bkgo" style="align-self:flex-end"' + (S.bulk.some(function (b) { return b.r; }) ? '' : ' disabled') + '>أرشفة الملفات المطابقة</button></div><div id="bk-s" class="num" style="color:var(--muted);min-height:1.4em"></div></div>';
    if (S.bulk.length) h += '<div class="tblw"><table><thead><tr><th>الملف</th><th>الورقة المطابقة</th><th>التاريخ من الاسم</th><th>الحالة</th></tr></thead><tbody>' + S.bulk.map(function (b) { return '<tr><td>' + esc(b.f.name) + '</td><td>' + (b.r ? '<span class="code">' + esc(b.r.c) + '</span> ' + esc(title(b.r)) : '—') + '</td><td class="num">' + esc(fmtDate(b.dt) || 'يؤخذ من الخانة') + '</td><td><span class="pill ' + (b.done ? 'good' : b.r ? '' : 'warn') + '">' + (b.done ? 'تمت الأرشفة' : b.r ? 'جاهز' : 'لا يوجد كود مطابق في الاسم') + '</span></td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }
  function bulkPick(files) {
    S.bulk = Array.prototype.map.call(files, function (f) { var m = CODE_RX.exec(f.name), code = m ? m[0].replace(/\s+/g, '') : '', d = /(\d{4})-(\d{2})-(\d{2})/.exec(f.name), d2 = /(\d{2})-(\d{2})-(\d{4})/.exec(f.name); return { f: f, r: code ? S.byCode[code] || null : null, dt: d ? d[0] : d2 ? d2[3] + '-' + d2[2] + '-' + d2[1] : '' }; });
    render();
  }
  function bulkGo() {
    var todo = S.bulk.filter(function (b) { return b.r && !b.done; }), dflt = $('bk-d').value, st = $('bk-s'), i = 0;
    if (!todo.length) return; if (!dflt) { st.textContent = 'اختر التاريخ.'; return; }
    (function next() {
      if (i >= todo.length) { toast('تمت أرشفة ' + todo.length + ' ملف.'); render(); return; }
      var b = todo[i], dt = b.dt || dflt; st.textContent = 'جارٍ رفع ' + (i + 1) + ' من ' + todo.length + '…';
      if (b.f.size > 10 * 1048576) { b.r = null; i++; next(); return; }
      storeFile(b.f).then(function (res) { return S.cap.db.collection('archive').add({ doc: b.r.i, code: b.r.c || '', d: b.r.d, y: +dt.slice(0, 4), m: +dt.slice(5, 7), rd: dt, no: '', asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: 'رفع مجمّع', at: new Date().toISOString(), by: S.cap.uid }); }).then(function () { b.done = true; i++; next(); }).catch(function () { st.textContent = 'توقف الرفع عند «' + b.f.name + '».'; render(); });
    })();
  }

  /* ---- activity log ---- */
  var LOGN = { audits: 'تدقيق داخلي', mreviews: 'مراجعة إدارة', risks: 'خطر أو فرصة', complaints: 'شكوى', csat: 'تقييم رضا', supeval: 'تقييم مورد', moves: 'حركة خزينة', ncr: 'عدم مطابقة', equip: 'معدة', staff: 'موظف', courses: 'دورة', kpi: 'مؤشر', names: 'اسم معروض', orders: 'أمر إنتاج', supfiles: 'مرفق مورد', cycles: 'دورة عمل', archive: 'الأرشيف', versions: 'إصدار ملف', na: 'لا ينطبق', formcfg: 'دورية نموذج', findings: 'ملاحظة تدقيق', expiry: 'تاريخ انتهاء', purchases: 'بند شراء', suppliers: 'مورد', users: 'مستخدم', lib: 'مكتبة الأوراق', logins: 'كلمة مرور' }, LOGO = { add: 'إضافة', set: 'تعديل', del: 'حذف' };
  function vLog() {
    var h = head('سجل النشاط', 'من فعل ماذا ومتى. السجل لا يُعدَّل ولا يُحذف.');
    if (!S.log.length) return h + '<p class="empty">لا يوجد نشاط مسجل بعد.</p>';
    return h + '<div class="tblw"><table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>' + S.log.slice(0, 500).map(function (l) {
      var r = l.doc && S.byId[l.doc], t = new Date(l.at);
      return '<tr><td class="num">' + esc(fmtDate(String(l.at).slice(0, 10))) + ' ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + '</td><td>' + esc(l.by || '') + '</td><td>' + (LOGO[l.op] || esc(l.op)) + ' ' + (LOGN[l.coll] || esc(l.coll)) + '</td><td>' + (r ? '<a href="#doc-' + r.i + '">' + esc(r.c || title(r)) + '</a> ' : '') + esc(l.s || '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  /* ---- monthly report ---- */
  function vReport() {
    var m = S.rm || CY + '-' + ('0' + CM).slice(-2), st = DEPTS.map(function (d) { return deptStats(d.k); }), fa = allFindings(), ex = expItems().filter(function (x) { return x.days <= 30; });
    var ar = S.arch.filter(function (a) { return a.y + '-' + ('0' + a.m).slice(-2) === m; }), pu = S.pur.filter(function (p) { return ym(p.date) === m; }), un = pu.filter(function (p) { return !supOk(p); }), late = [];
    S.docs.filter(isArchivable).forEach(function (r) { if (evStatus(r).late) late.push(r); });
    var opts = {}; opts[m] = 1; S.arch.forEach(function (a) { opts[a.y + '-' + ('0' + a.m).slice(-2)] = 1; }); S.pur.forEach(function (p) { opts[ym(p.date)] = 1; });
    var h = head('التقرير الشهري', 'ملخص يُعرض في مراجعة الإدارة: ' + MONTHS[+m.slice(5) - 1] + ' ' + m.slice(0, 4), '<select class="mini noprint" data-chg="rm">' + Object.keys(opts).sort().reverse().map(function (k) { return '<option value="' + k + '"' + (k === m ? ' selected' : '') + '>' + MONTHS[+k.slice(5) - 1] + ' ' + k.slice(0, 4) + '</option>'; }).join('') + '</select><button class="btn pri noprint" data-x="print">طباعة</button>');
    h += '<div class="tiles"><div class="tile"><b class="num">' + Math.round(st.reduce(function (a, s) { return a + s.score; }, 0) / st.length) + '%</b><span>جاهزية المصنع</span></div><div class="tile"><b class="num">' + ar.length + '</b><span>ملف أُرشف في الشهر</span></div><div class="tile"><b class="num">' + late.length + '</b><span>نموذج دوري متأخر</span></div><div class="tile"><b class="num">' + fa.filter(function (f) { return fState(f) !== 'done'; }).length + ' / ' + fa.length + '</b><span>ملاحظة تدقيق لم تُغلق</span></div><div class="tile"><b class="num">' + money(pu.reduce(function (a, p) { return a + (+p.value || 0); }, 0)) + '</b><span>مشتريات الشهر ج.م (' + pu.length + ' بند)</span></div><div class="tile"><b class="num">' + un.length + '</b><span>شراء من مورد غير معتمد</span></div></div>';
    h += '<h2 style="font-size:17px">جاهزية الأقسام</h2><div class="tblw"><table><thead><tr><th>القسم</th><th>الجاهزية</th><th>نماذج لها دليل</th><th>دوري متأخر</th><th>ملاحظات أُغلقت</th><th>أُرشف في الشهر</th></tr></thead><tbody>' + DEPTS.map(function (d, i) { var s = st[i]; return '<tr><td>' + esc(dName(d.k)) + '</td><td class="num">' + s.score + '%</td><td class="num">' + s.ready + ' من ' + s.forms + '</td><td class="num">' + s.late + '</td><td class="num">' + (s.fs ? s.done + ' من ' + s.fs : '—') + '</td><td class="num">' + ar.filter(function (a) { return a.d === d.k; }).length + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (late.length) h += '<h2 style="font-size:17px">النماذج الدورية المتأخرة</h2><div class="tblw"><table><tbody>' + late.map(function (r) { return '<tr><td><span class="code">' + esc(r.c) + '</span></td><td>' + esc(title(r)) + '</td><td>' + esc(r.d) + '</td><td>' + esc(evStatus(r).txt) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    var open = fa.filter(function (f) { return fState(f) !== 'done'; });
    if (open.length) h += '<h2 style="font-size:17px">ملاحظات التدقيق المفتوحة</h2><div class="tblw"><table><thead><tr><th>الملاحظة</th><th>الحالة</th><th>المسؤول</th><th>الموعد</th></tr></thead><tbody>' + open.map(function (f) { var o = S.find[f.id] || {}; return '<tr><td>' + esc(f.t) + '</td><td>' + (fState(f) === 'prog' ? 'جارٍ العمل' : 'مفتوحة') + '</td><td>' + esc(o.owner || '') + '</td><td class="num">' + esc(fmtDate(o.due) || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (ex.length) h += '<h2 style="font-size:17px">ينتهي خلال 30 يومًا</h2><div class="tblw"><table><tbody>' + ex.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.d || '') + '</td><td class="num">' + esc(fmtDate(x.date)) + '</td><td class="num">' + (x.days < 0 ? 'منتهٍ' : x.days + ' يوم') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (un.length) h += '<h2 style="font-size:17px">مشتريات من مورد غير معتمد أو غير محدد</h2><div class="tblw"><table><tbody>' + un.map(function (p) { return '<tr><td><span class="code">' + esc(p.pr) + '</span></td><td>' + esc(p.item) + '</td><td>' + esc(supLabel(p) || 'غير محدد') + '</td><td class="num">' + money(p.value) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id;
    if (x === 'libup') libUpload();
    else if (x === 'supnew') supDialog(); else if (x === 'supedit') supDialog(id);
    else if (x === 'supsave') { var n = ($('sp-n').value || '').trim(); if (!n) { $('sp-m').textContent = 'اكتب اسم المورد.'; return; } S.cap.db.doc('suppliers/' + id).set({ name: n, scope: $('sp-s').value.trim(), cls: $('sp-c').value, status: $('sp-t').value, valid: $('sp-v').value, alt: $('sp-a').value.trim(), at: new Date().toISOString() }).then(function () { closeDlg(); toast('حُفظ المورد.'); }).catch(function () { $('sp-m').textContent = 'تعذر الحفظ.'; }); }
    else if (x === 'purnew') purDialog(); else if (x === 'puredit') purDialog(id); else if (x === 'pursave') purSave(id);
    else if (x === 'purimp') purImportDialog(); else if (x === 'purimpgo') purImport();
    else if (x === 'purlog') purLog(); else if (x === 'purpr') purDoc(id, false); else if (x === 'purpo') purDoc(id, true);
    else if (x === 'bkgo') bulkGo();
    else if (x === 'print') window.print();
    else if (x === 'vok') { var v = (S.vers || []).filter(function (y) { return y.id === id; })[0]; if (!v) return; var o = {}; for (var k in v) if (k !== 'id') o[k] = v[k]; o.st = 'approved'; o.approvedAt = new Date().toISOString(); o.approvedBy = meName(); S.cap.db.doc('versions/' + id).set(o).then(function () { toast('اعتُمد الإصدار وأصبح الإصدار الحالي.'); }).catch(function () { toast('تعذر الاعتماد.'); }); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.dataset && t.dataset.chg;
    if (c === 'pm') { S.pm = t.value; render(); } else if (c === 'rm') { S.rm = t.value; render(); } else if (c === 'bkfiles') bulkPick(t.files);
  });


  /* ================= work cycles: the numbered steps of each department's own procedure ================= */
  S.cyc = [];
  (function () { var t = setInterval(function () { var db = S.cap.db; if (!db) return; clearInterval(t); db.collection('cycles').onSnapshot(function (s) { S.cyc = s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at)); }); if (route() === 'cycles') render(); }, function () { }); }, 800); })();
  function cycDefs() { return window.GEM_CYCLES || []; }
  function ring(pct) { var c = 2 * Math.PI * 26; return '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--line)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="var(--' + (pct >= 100 ? 'good' : 'accent') + ')" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">' + pct + '%</text></svg>'; }
  function vCycles() {
    var defs = cycDefs(), w = canWrite(); if (!defs.length) return head('دورة العمل', '') + '<p class="empty">لا توجد بيانات.</p>';
    var def = defs.filter(function (x) { return x.p === S.cp; })[0] || defs[0], runs = S.cyc.filter(function (c) { return c.proc === def.p; }), run = runs.filter(function (c) { return c.id === S.cr; })[0] || null, pr = S.byCode[def.p];
    var sel = '<select class="mini" data-chg="cp" aria-label="الإجراء">' + DEPTS.map(function (d) { var l = defs.filter(function (x) { return x.d === d.k; }); return l.length ? '<optgroup label="' + esc(dName(d.k)) + '">' + l.map(function (x) { return '<option value="' + esc(x.p) + '"' + (x.p === def.p ? ' selected' : '') + '>' + esc(x.t) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') + '</select>';
    var h = head('دورة العمل', 'خطوات كل قسم كما هي مكتوبة في إجرائه المعتمد، بنفس الترقيم والنص، والنماذج المطلوبة في كل خطوة.', sel + (w ? '<button class="btn pri" data-x="cynew">بدء دورة جديدة</button>' : ''));
    var done = run ? def.s.filter(function (s) { return (run.steps || {})[s.n]; }).length : 0, pct = run ? Math.round(done * 100 / def.s.length) : 0;
    h += '<div class="find l" style="flex-direction:row;align-items:center;gap:14px;flex-wrap:wrap">' + (run ? ring(pct) : '') + '<div style="flex:1;min-width:220px"><div><span class="code">' + esc(def.p) + '</span> ' + (pr ? '<a href="#doc-' + pr.i + '">' + esc(def.t) + '</a>' : esc(def.t)) + ' · ' + esc(def.d) + '</div><div style="color:var(--muted)">' + (run ? 'دورة: <b>' + esc(run.ref) + '</b> · بدأت ' + esc(fmtDate(run.date)) + ' · ' + done + ' من ' + def.s.length + ' خطوة' + (run.closed ? ' · <span class="pill good">مقفلة</span>' : '') : def.s.length + ' خطوة. اختر دورة من القائمة أو ابدأ دورة جديدة لمتابعة التنفيذ خطوة بخطوة.') + '</div></div>' +
      (runs.length ? '<select class="mini" data-chg="cr" aria-label="الدورة"><option value="">عرض الخطوات فقط</option>' + runs.map(function (c) { var n = def.s.filter(function (s) { return (c.steps || {})[s.n]; }).length; return '<option value="' + esc(c.id) + '"' + (run && run.id === c.id ? ' selected' : '') + '>' + esc(c.ref) + ' · ' + esc(fmtDate(c.date)) + ' · ' + n + '/' + def.s.length + '</option>'; }).join('') + '</select>' : '') +
      (run && w && !run.closed && done === def.s.length ? '<button class="btn pri" data-x="cyclose">إقفال الدورة</button>' : '') + (run && canAdmin() ? '<button class="btn danger" data-act="del" data-kind="cycles" data-id="' + esc(run.id) + '" data-label="' + esc(run.ref) + '">حذف</button>' : '') + '</div>';
    h += '<ol class="cyc">' + def.s.map(function (s) {
      var st = run && (run.steps || {})[s.n], forms = s.c.map(function (c) { var r = S.byCode[c]; if (!r) return '<span class="pill warn" title="الكود مذكور في الإجراء ولا يوجد له ملف">' + esc(c) + '</span>'; var n = archOf(r.i).filter(function (a) { return !run || a.rd >= run.date; }).length; return '<a class="pill ' + (n ? 'good' : 'form') + '" href="#doc-' + r.i + '" title="' + esc(title(r)) + '">' + esc(c) + (n ? ' · ' + n + ' سجل' : '') + '</a>'; }).join(' ');
      var body = s.x.indexOf(':') > 0 && s.t ? s.x.slice(s.x.indexOf(':') + 1).trim() : s.x;
      return '<li class="' + (st ? 'ok' : '') + '"><span class="cn num">' + (st ? '✓' : esc(s.n)) + '</span><div class="cb"><div class="ct"><b>' + esc(s.t || s.n) + '</b>' + (st ? ' <span class="pill good">تمت ' + esc(fmtDate(String(st.at).slice(0, 10))) + (st.by ? ' · ' + esc(st.by) : '') + '</span>' : '') + '</div>' + (forms ? '<div class="cf">' + forms + '</div>' : '') + '<details><summary>نص الخطوة من الإجراء</summary><p>' + esc(body).replace(/\n/g, '<br>') + '</p></details>' + (st && st.note ? '<div style="color:var(--muted)">ملاحظة: ' + esc(st.note) + '</div>' : '') + '</div>' +
        (run && w && !run.closed ? '<div class="ca">' + (st ? '<button class="btn" data-x="cyundo" data-id="' + esc(s.n) + '">تراجع</button>' : '<button class="btn pri" data-x="cydone" data-id="' + esc(s.n) + '">تمت الخطوة</button>') + '</div>' : '') + '</li>';
    }).join('') + '</ol>';
    return h;
  }
  function cycSave(run, msg) { var o = {}; for (var k in run) if (k !== 'id') o[k] = run[k]; o.name = run.ref; return S.cap.db.doc('cycles/' + run.id).set(o).then(function () { if (msg) toast(msg); }).catch(function () { toast('تعذر الحفظ.'); }); }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id, defs = cycDefs(), def = defs.filter(function (d) { return d.p === S.cp; })[0] || defs[0], run = S.cyc.filter(function (c) { return c.id === S.cr; })[0];
    if (x === 'cynew') dlg('<h2>بدء دورة جديدة</h2><div><span class="code">' + esc(def.p) + '</span> ' + esc(def.t) + '</div><label>مرجع الدورة<input id="cy-r" type="text" maxlength="80" placeholder="مثال: كود التشغيلة، رقم الطلب، اسم الموظف، الشهر"></label><label>تاريخ البدء<input id="cy-d" type="date" value="' + today() + '"></label><div id="cy-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="cysave">بدء</button></div>');
    else if (x === 'cysave') { var ref = ($('cy-r').value || '').trim(), dt = $('cy-d').value; if (!ref || !dt) { $('cy-m').textContent = 'اكتب المرجع والتاريخ.'; return; } S.cap.db.collection('cycles').add({ proc: def.p, d: def.d, ref: ref, name: ref, date: dt, steps: {}, closed: false, at: new Date().toISOString(), by: meName() }).then(function (r) { closeDlg(); if (r && r.id) S.cr = r.id; toast('بدأت الدورة. اخترها من القائمة إن لم تظهر.'); render(); }).catch(function () { $('cy-m').textContent = 'تعذر الحفظ.'; }); }
    else if (x === 'cydone' && run) { var note = window.prompt('ملاحظة على الخطوة ' + id + ' (اختياري)'); if (note == null) return; run.steps = run.steps || {}; run.steps[id] = { at: new Date().toISOString(), by: meName(), note: note.trim() }; cycSave(run); render(); }
    else if (x === 'cyundo' && run) { delete run.steps[id]; cycSave(run); render(); }
    else if (x === 'cyclose' && run) { run.closed = true; run.closedAt = new Date().toISOString(); cycSave(run, 'أُقفلت الدورة.'); render(); }
  });
  document.addEventListener('change', function (ev) { var t = ev.target, c = t.dataset && t.dataset.chg; if (c === 'cp') { S.cp = t.value; S.cr = ''; render(); } else if (c === 'cr') { S.cr = t.value; render(); } });


  /* ================= department pictures, data upload check, alerts, supplier files ================= */
  var DICON = {
    'QA': '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.500-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    'QC': '<circle cx="10.500" cy="10.500" r="6"/><path d="M15 15l5 5"/><path d="M8 10.500l2 2 3-3.500"/>',
    'HR': '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.500 2.500-6 6-6s6 2.500 6 6"/><circle cx="17" cy="9" r="2.300"/><path d="M16 14.200c3 0 5 2 5 5"/>',
    'الإنتاج': '<path d="M3 20V10l5 3V10l5 3V6h4l1 14z"/><path d="M3 20h18"/><path d="M8 17h2M13 17h2"/>',
    'المعمل': '<path d="M9 3h6"/><path d="M10 3v6l-5 9a2 2 0 0 0 1.800 3h10.400a2 2 0 0 0 1.800-3l-5-9V3"/><path d="M7.500 15h9"/>',
    'الصيانة': '<path d="M14.500 6a4 4 0 0 0-5 5L3 17.500 6.500 21 13 14.500a4 4 0 0 0 5-5l-2.500 2.500-2.500-1-1-2.500z"/>',
    'السلامة والصحة المهنية والبيئة': '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M2 16h20v2H2z"/><path d="M10 8.300V13M14 8.300V13"/>',
    'المشتريات': '<path d="M3 4h2.500l2.500 11h10l2-8H7"/><circle cx="9.500" cy="19" r="1.500"/><circle cx="17" cy="19" r="1.500"/>',
    'المخازن والخزينة': '<rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="12" cy="11.500" r="3"/><path d="M12 8.500v-1.500M12 16v-1.500M6 19v2M18 19v2"/>'
  };
  function dIcon(k, sz) { var p = DICON[k]; return p ? '<svg class="dic" width="' + (sz || 20) + '" height="' + (sz || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p.replace(/\.(\d)00/g, '.$1') + '</svg>' : ''; }

  S.supf = [];
  (function () { var t = setInterval(function () { var db = S.cap.db; if (!db) return; clearInterval(t); db.collection('supfiles').onSnapshot(function (s) { S.supf = s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }); if (/^(sup-|alerts)/.test(route())) render(); }, function () { }); }, 800); })();

  /* ---- reading an uploaded Word file ---- */
  var tplCache = {};
  function xmlTables(xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    return Array.prototype.map.call(doc.getElementsByTagNameNS(WNS, 'tbl'), function (tb) { return kids(tb, 'tr').map(function (tr) { return kids(tr, 'tc').map(function (tc) { return kids(tc, 'p').map(function (p) { return cellText(p).replace(/\s+/g, ' ').trim(); }).filter(Boolean); }); }); });
  }
  function zipText(z, rx) { var fs = Object.keys(z.files).filter(function (n) { return rx.test(n); }); return Promise.all(fs.map(function (n) { return z.file(n).async('string'); })).then(function (a) { return a.join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' '); }); }
  function isNum(s) { return /^[\d٠-٩.\-\/ ]*$/.test(s); }
  function tplFields(r) {
    if (tplCache[r.i]) return tplCache[r.i];
    return tplCache[r.i] = docBlob(r).then(function (b) { return JSZip.loadAsync(b); }).then(function (z) { return z.file('word/document.xml').async('string'); }).then(function (xml) {
      var T = xmlTables(xml), fields = [], grids = [];
      T.forEach(function (rows, ti) {
        var blank = 0;
        rows.forEach(function (cells, ri) {
          var txt = cells.map(function (c) { return c.join(' '); }), filled = txt.filter(function (x) { return x && !isNum(x); }).length;
          if (ri > 0 && !filled) { blank++; return; }
          txt.forEach(function (x, ci) { if (!x && ci > 0 && txt[ci - 1] && !isNum(txt[ci - 1]) && txt[ci - 1].length <= 60) fields.push({ ti: ti, ri: ri, ci: ci, label: txt[ci - 1] }); });
          cells.forEach(function (ps, ci) { ps.forEach(function (p) { if (/[:：]$/.test(p) && p.length <= 40) fields.push({ ti: ti, ri: ri, ci: ci, label: p.replace(/[:：]$/, ''), inl: p }); }); });
        });
        if (blank >= 2 && rows[0]) grids.push({ ti: ti, cols: (rows[rows.length - blank - 1] || rows[0]).map(function (c) { return c.join(' '); }), head: rows[0].map(function (c) { return c.join(' '); }).filter(Boolean).slice(0, 4).join('، '), first: rows.length - blank });
      });
      return { fields: fields, grids: grids };
    });
  }
  function checkDocx(b) {
    return b.f.arrayBuffer().then(function (buf) { return JSZip.loadAsync(buf); }).then(function (z) {
      return zipText(z, /^word\/(document|header\d*|footer\d*)\.xml$/).then(function (all) {
        if (!b.r) { var m = CODE_RX.exec(all); if (m && S.byCode[m[0].replace(/\s+/g, '')]) { b.r = S.byCode[m[0].replace(/\s+/g, '')]; b.how = 'من الكود المكتوب داخل الملف'; } }
        if (!b.r || b.r.e !== 'docx') return;
        return Promise.all([tplFields(b.r), z.file('word/document.xml').async('string')]).then(function (x) {
          var tpl = x[0], U = xmlTables(x[1]), miss = [], seen = {};
          tpl.fields.forEach(function (f) {
            var row = (U[f.ti] || [])[f.ri], empty;
            if (f.inl) { var ps = row && row[f.ci]; if (!ps) return; empty = ps.some(function (p) { return p === f.inl; }); }
            else { if (!row || !row[f.ci - 1] || row[f.ci - 1].join(' ') !== f.label) return; empty = !(row[f.ci] || []).join(''); }
            if (empty && !seen[f.label]) { seen[f.label] = 1; miss.push(f.label.replace(/[:：]$/, '')); }
          });
          tpl.grids.forEach(function (g) { var rows = (U[g.ti] || []).slice(g.first), n = rows.filter(function (cells) { return cells.filter(function (c) { var t = c.join(' '); return t && !isNum(t); }).length > 0; }).length; if (!n) miss.push('الجدول فارغ (' + g.head + ')'); else b.rowsN = (b.rowsN || 0) + n; });
          b.miss = miss; b.checked = true;
        });
      });
    }).catch(function () { b.err = true; });
  }
  function checkXlsx(b) { if (b.r) return Promise.resolve(); return b.f.arrayBuffer().then(function (buf) { return JSZip.loadAsync(buf); }).then(function (z) { return zipText(z, /^xl\/(sharedStrings|worksheets\/sheet\d+)\.xml$/); }).then(function (all) { var m = CODE_RX.exec(all); if (m && S.byCode[m[0].replace(/\s+/g, '')]) { b.r = S.byCode[m[0].replace(/\s+/g, '')]; b.how = 'من الكود المكتوب داخل الملف'; } }).catch(function () { }); }
  function hasRec(r) { return archOf(r.i).length || naOf(r.i).length || S.bulk.some(function (x) { return x.r && x.r.i === r.i; }); }
  function skipped(r) {
    var out = [];
    cycDefs().forEach(function (def) {
      var k = -1; def.s.forEach(function (s, i) { if (k < 0 && s.c.indexOf(r.c) >= 0) k = i; }); if (k < 1) return;
      def.s.slice(0, k).forEach(function (s) { var fs = s.c.map(function (c) { return S.byCode[c]; }).filter(function (x) { return x && isArchivable(x) && x.i !== r.i; }); if (fs.length && !fs.some(hasRec)) out.push({ n: s.n, t: s.t, p: def.p, c: fs.map(function (x) { return x.c; }) }); });
    });
    return out;
  }
  function bulkPick(files) {
    S.bulk = Array.prototype.map.call(files, function (f) { var m = CODE_RX.exec(f.name), code = m ? m[0].replace(/\s+/g, '') : '', d = /(\d{4})-(\d{2})-(\d{2})/.exec(f.name), d2 = /(\d{2})-(\d{2})-(\d{4})/.exec(f.name), r = code ? S.byCode[code] || null : null; return { f: f, r: r, how: r ? 'من الكود في اسم الملف' : '', dt: d ? d[0] : d2 ? d2[3] + '-' + d2[2] + '-' + d2[1] : '', wait: true }; });
    render();
    S.bulk.forEach(function (b) { var e = (b.f.name.split('.').pop() || '').toLowerCase(), p = !window.JSZip ? Promise.resolve() : e === 'docx' ? checkDocx(b) : e === 'xlsx' ? checkXlsx(b) : Promise.resolve(); p.then(function () { b.wait = false; render(); }); });
  }
  function vBulk() {
    if (!canWrite() || !S.cap.assets) return head('رفع بيانات', '') + '<p class="empty">سجّل الدخول بحساب له صلاحية الكتابة.</p>';
    var h = head('رفع بيانات', 'ارفع ملفاتك المملوءة. يحدد النظام مكان كل ملف (القسم والورقة)، ويفحص البنود الناقصة، وينبهك إن كانت خطوة سابقة في الإجراء بلا سجل. يمكنك تغيير المكان والتاريخ قبل الأرشفة.');
    h += '<div class="find l"><div class="track"><label style="flex:2;min-width:240px">الملفات<input id="bk-f" type="file" multiple data-chg="bkfiles"></label><label>تاريخ السجل لما لا يحمل تاريخًا<input class="mini" id="bk-d" type="date" value="' + today() + '"></label><button class="btn pri" data-x="bkgo" style="align-self:flex-end"' + (S.bulk.some(function (b) { return b.r && !b.done; }) ? '' : ' disabled') + '>أرشفة الملفات الجاهزة</button></div><div id="bk-s" class="num" style="color:var(--muted);min-height:1.4em"></div></div>';
    if (!S.bulk.length) return h;
    h += '<datalist id="bk-codes">' + S.docs.filter(function (r) { return r.c && isArchivable(r); }).map(function (r) { return '<option value="' + esc(r.c) + '">' + esc(title(r)) + '</option>'; }).join('') + '</datalist>';
    h += S.bulk.map(function (b, i) {
      var sk = b.r ? skipped(b.r) : [], cls = b.done ? 'l' : !b.r ? 'h' : (b.miss && b.miss.length) || sk.length ? 'm' : 'l';
      var x = '<div class="find ' + cls + '"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b>' + esc(b.f.name) + '</b>' + (b.done ? '<span class="pill good">تمت الأرشفة</span>' : b.wait ? '<span class="pill">جارٍ الفحص…</span>' : '') + '</div>';
      if (b.r) x += '<div><b>المكان:</b> ' + dIcon(b.r.d, 16) + ' ' + esc(b.r.d) + ' ← <a href="#doc-' + b.r.i + '"><span class="code">' + esc(b.r.c) + '</span> ' + esc(title(b.r)) + '</a>' + (b.how ? ' <span style="color:var(--muted)">(' + b.how + ')</span>' : '') + '</div>';
      else if (!b.wait) x += '<div style="color:var(--bad)">لم أتعرف على مكان هذا الملف. اكتب كود الورقة في الخانة.</div>';
      if (b.checked) x += b.miss.length ? '<div><b>البنود الناقصة (' + b.miss.length + '):</b> ' + b.miss.slice(0, 25).map(function (m) { return '<span class="pill warn">' + esc(m) + '</span>'; }).join(' ') + (b.miss.length > 25 ? ' …' : '') + '</div>' : '<div><span class="pill good">لا توجد خانات فارغة</span>' + (b.rowsN ? ' <span class="num" style="color:var(--muted)">' + b.rowsN + ' صف مسجل</span>' : '') + '</div>';
      else if (b.r && !b.wait) x += '<div style="color:var(--muted)">' + (b.err ? 'تعذر فحص محتوى الملف.' : 'فحص الخانات الناقصة متاح لنماذج Word فقط.') + '</div>';
      if (sk.length) x += '<div><b>تنبيه، خطوات سابقة في الإجراء بلا سجل:</b> ' + sk.slice(0, 6).map(function (s) { return '<a class="pill bad" href="#cycles" data-x="gocyc" data-id="' + esc(s.p) + '" title="' + esc(s.c.join(' · ')) + '">' + esc(s.n + ' ' + s.t) + '</a>'; }).join(' ') + '</div>';
      if (!b.done) x += '<div class="track"><label>كود الورقة<input class="mini" list="bk-codes" dir="ltr" value="' + esc(b.r ? b.r.c : '') + '" data-chg="bkcode" data-i="' + i + '"></label><label>تاريخ السجل<input class="mini" type="date" value="' + esc(b.dt) + '" data-chg="bkdate" data-i="' + i + '"></label><button class="btn" data-x="bkdrop" data-id="' + i + '" style="align-self:flex-end">استبعاد</button></div>';
      return x + '</div>';
    }).join('');
    return h;
  }
  function bulkGo() {
    var todo = S.bulk.filter(function (b) { return b.r && !b.done; }), dflt = $('bk-d').value, st = $('bk-s'), i = 0;
    if (!todo.length) return; if (!dflt) { st.textContent = 'اختر التاريخ.'; return; }
    (function next() {
      if (i >= todo.length) { toast('تمت أرشفة ' + todo.length + ' ملف.'); render(); return; }
      var b = todo[i], dt = b.dt || dflt; st.textContent = 'جارٍ رفع ' + (i + 1) + ' من ' + todo.length + '…';
      if (b.f.size > 10 * 1048576) { b.r = null; i++; next(); return; }
      storeFile(b.f).then(function (res) { return S.cap.db.collection('archive').add({ doc: b.r.i, code: b.r.c || '', d: b.r.d, y: +dt.slice(0, 4), m: +dt.slice(5, 7), rd: dt, no: '', asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: b.miss && b.miss.length ? 'ناقص ' + b.miss.length + ' بند: ' + b.miss.slice(0, 6).join('، ') : 'رفع بيانات', at: new Date().toISOString(), by: S.cap.uid }); }).then(function () { b.done = true; i++; next(); }).catch(function () { st.textContent = 'توقف الرفع عند «' + b.f.name + '».'; render(); });
    })();
  }

  /* ---- alerts: what is missing over the last month ---- */
  function monthAgo() { var d = new Date(); d.setDate(d.getDate() - 30); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function alertData() {
    var from = monthAgo(), o = { from: from, forms: [], cyc: [], vers: [], exp: [], pur: [], fin: [], codes: [], supf: [] }, td = today();
    S.docs.filter(isArchivable).forEach(function (r) {
      var a = archOf(r.i), f = freqOf(r), last = a.map(function (x) { return x.rd || ''; }).sort().pop() || '';
      if (naOf(r.i).length && !a.length) return; if (f === 'event' && a.length) return; if (last >= from) return;
      o.forms.push({ r: r, last: last, f: f, tip: !a.length ? 'املأ نسخة وارفعها، أو سجّل «لا ينطبق» مع السبب.' : f ? 'النموذج دوري وآخر سجل له قديم. املأ سجل الفترة الحالية.' : 'حدّد دورية النموذج من صفحته حتى يُحسب التأخير بدقة، أو اختر «عند الحدوث».' });
    });
    o.cyc = S.cyc.filter(function (c) { return !c.closed && c.date < from; });
    o.vers = (S.vers || []).filter(function (v) { return v.st === 'pending'; });
    o.exp = expItems().filter(function (x) { return x.days <= 30; });
    S.supf.forEach(function (x) { if (x.valid) { var dd = Math.round((new Date(x.valid) - new Date(td)) / 86400000); if (dd <= 30) o.supf.push({ x: x, days: dd }); } });
    o.pur = S.pur.filter(function (p) { return p.date >= from && !supOk(p); });
    o.fin = allFindings().filter(function (f) { var s = S.find[f.id] || {}; return fState(f) !== 'done' && s.due && s.due < td; });
    var seen = {}; cycDefs().forEach(function (d) { d.s.forEach(function (s) { s.c.forEach(function (c) { if (!S.byCode[c] && !seen[c]) { seen[c] = 1; o.codes.push({ c: c, p: d.p, n: s.n }); } }); }); });
    o.eq = equipDue(); o.nc = S.ncr.filter(function (n) { return n.st !== 'مغلقة' && n.due && n.due < td; }); o.ord = S.ord.filter(function (x) { return ordLate(x) || Object.keys(x.steps || {}).some(function (k) { return (x.steps[k].miss || []).length; }); }); o.total = o.eq.length + o.nc.length + o.ord.length + o.forms.length + o.cyc.length + o.vers.length + o.exp.length + o.pur.length + o.fin.length + o.codes.length + o.supf.length;
    return o;
  }
  function vAlerts() {
    var o = alertData(), w = canWrite();
    var h = head('التنبيهات', 'كل ما هو ناقص أو متأخر منذ ' + fmtDate(o.from) + ' في جميع الأوراق والنماذج، مع المقترح لكل بند.', '<button class="btn noprint" data-x="print">طباعة</button>');
    h += '<div class="tiles"><div class="tile"><b class="num" style="color:var(--' + (o.forms.length ? 'bad' : 'good') + ')">' + o.forms.length + '</b><span>نموذج بلا سجل خلال الشهر</span></div><div class="tile"><b class="num">' + (o.exp.length + o.supf.length) + '</b><span>صلاحية تنتهي خلال 30 يومًا</span></div><div class="tile"><b class="num">' + o.pur.length + '</b><span>شراء من مورد غير معتمد</span></div><div class="tile"><b class="num">' + (o.cyc.length + o.vers.length + o.fin.length) + '</b><span>دورات وإصدارات وملاحظات معلقة</span></div></div>';
    if (!o.total) return h + '<p class="empty">لا توجد تنبيهات.</p>';
    var sec = function (t, n, body, open) { return n ? '<details class="sec"' + (open ? ' open' : '') + '><summary><span class="t">' + t + '</span><small class="num">' + n + '</small></summary><div class="tblw" style="border:0"><table><tbody>' + body + '</tbody></table></div></details>' : ''; };
    DEPTS.forEach(function (d) {
      var l = o.forms.filter(function (x) { return x.r.d === d.k; });
      h += sec(dIcon(d.k, 18) + ' ' + esc(dName(d.k)) + ': نماذج بلا سجل خلال الشهر', l.length, l.map(function (x) {
        var r = x.r, auto = r.c === 'GEM-PU-F-8.4-08' && S.pur.length;
        return '<tr><td><a href="#doc-' + r.i + '"><span class="code">' + esc(r.c || '') + '</span></a></td><td>' + esc(title(r)) + '</td><td class="num">' + (x.last ? 'آخر سجل ' + esc(fmtDate(x.last)) : 'لا يوجد سجل') + '</td><td>' + esc(x.tip) + '</td><td class="noprint"><div class="acts">' + (auto ? '<button class="btn pri" data-x="purlogall">املأه من بيانات المشتريات</button>' : '') + (w && OFFICE[r.e] ? '<button class="btn" data-act="blank" data-id="' + r.i + '">فتح نسخة للملء</button>' : '') + '</div></td></tr>';
      }).join(''));
    });
    h += sec('أوامر إنتاج متأخرة أو بخطوات ناقصة السجلات', o.ord.length, o.ord.map(function (x) { var c = ordCur(x), ms = []; Object.keys(x.steps || {}).forEach(function (k) { (x.steps[k].miss || []).forEach(function (m) { ms.push(k + ': ' + m); }); }); return '<tr><td><a href="#order-' + esc(x.id) + '"><span class="code">' + esc(x.no) + '</span></a></td><td>' + esc(x.cust) + '</td><td>' + (ordLate(x) ? 'تجاوز موعد التسليم ' + esc(fmtDate(x.due)) + (c ? '، وهو عند ' + esc(c.o) : '') : '') + '</td><td>' + (ms.length ? 'ارفع السجلات الناقصة: ' + esc(ms.slice(0, 6).join('، ')) : 'تابع الخطوة الحالية مع المسؤول.') + '</td></tr>'; }).join(''), true);
    h += sec('معايرة أو صيانة مستحقة خلال 30 يومًا', o.eq.length, o.eq.map(function (e) { return '<tr><td><span class="code">' + esc(e.code) + '</span></td><td>' + esc(e.name) + '</td><td>' + (e.next ? 'معايرة: ' + duePill(e.next) : '') + ' ' + (e.pmNext ? 'صيانة: ' + duePill(e.pmNext) : '') + '</td><td>نفّذها وحدّث الموعد من <a href="#equip">المعدات والمعايرة</a>، وارفع الشهادة أو السجل.</td></tr>'; }).join(''), true);
    h += sec('عدم مطابقة تجاوزت موعدها', o.nc.length, o.nc.map(function (n) { return '<tr><td><span class="code">' + esc(n.no) + '</span></td><td>' + esc(n.desc) + '</td><td>' + esc(n.owner || '') + ' · ' + esc(fmtDate(n.due)) + '</td><td>نفّذ الإجراء وأغلقها بعد التحقق. <a href="#ncr">عدم المطابقة</a></td></tr>'; }).join(''), true);
    h += sec('صلاحيات تنتهي خلال 30 يومًا', o.exp.length + o.supf.length, o.exp.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.d || '') + '</td><td class="num">' + esc(fmtDate(x.date)) + '</td><td>' + (x.days < 0 ? 'منتهٍ. جدّده وارفع المستند الجديد.' : 'باقٍ ' + x.days + ' يوم. ابدأ التجديد.') + '</td></tr>'; }).join('') + o.supf.map(function (y) { var s = supBy(y.x.sup); return '<tr><td>' + esc(y.x.kind + ' · ' + y.x.name) + '</td><td><a href="#sup-' + esc(y.x.sup) + '">' + esc(s ? s.name : y.x.sup) + '</a></td><td class="num">' + esc(fmtDate(y.x.valid)) + '</td><td>' + (y.days < 0 ? 'منتهٍ. اطلب من المورد مستندًا ساريًا.' : 'باقٍ ' + y.days + ' يوم.') + '</td></tr>'; }).join(''), true);
    h += sec('مشتريات من مورد غير معتمد أو غير محدد', o.pur.length, o.pur.map(function (p) { return '<tr><td><span class="code">' + esc(p.pr) + '</span></td><td>' + esc(p.item) + '</td><td>' + esc(supLabel(p) || 'غير محدد') + '</td><td>اختر موردًا معتمدًا للبند، أو أضف المورد للسجل وقيّمه. <a href="#purchases">المشتريات</a></td></tr>'; }).join(''), true);
    h += sec('دورات عمل مفتوحة منذ أكثر من شهر', o.cyc.length, o.cyc.map(function (c) { return '<tr><td><span class="code">' + esc(c.proc) + '</span></td><td>' + esc(c.ref) + '</td><td class="num">' + esc(fmtDate(c.date)) + '</td><td>أكمل خطواتها وأقفلها. <a href="#cycles" data-x="gocyc" data-id="' + esc(c.proc) + '">دورة العمل</a></td></tr>'; }).join(''), true);
    h += sec('إصدارات بانتظار الاعتماد', o.vers.length, o.vers.map(function (v) { var r = S.byId[v.doc]; return '<tr><td>' + (r ? '<a href="#doc-' + r.i + '"><span class="code">' + esc(r.c || '') + '</span> ' + esc(title(r)) + '</a>' : '') + '</td><td>' + esc(v.name) + '</td><td class="num">' + esc(fmtDate(v.at)) + '</td><td>راجعه واعتمده من صفحة الورقة.</td></tr>'; }).join(''), true);
    h += sec('ملاحظات تدقيق تجاوزت موعدها', o.fin.length, o.fin.map(function (f) { var s = S.find[f.id] || {}; return '<tr><td>' + esc(f.t) + '</td><td>' + esc(s.owner || '') + '</td><td class="num">' + esc(fmtDate(s.due)) + '</td><td><a href="#audit">ملاحظات التدقيق</a></td></tr>'; }).join(''), true);
    h += sec('أكواد مذكورة في الإجراءات ولا يوجد لها ملف', o.codes.length, o.codes.map(function (c) { return '<tr><td><span class="code">' + esc(c.c) + '</span></td><td>مذكور في <span class="code">' + esc(c.p) + '</span> خطوة ' + esc(c.n) + '</td><td>أضف الملف، أو صحّح الكود في الإجراء بإصدار جديد.</td></tr>'; }).join(''), true);
    return h;
  }

  /* ---- one file per supplier ---- */
  var SKINDS = ['سجل تجاري', 'بطاقة ضريبية', 'شهادة أو ترخيص', 'عرض سعر', 'فاتورة', 'عقد', 'تقييم', 'أخرى'];
  function supDocs(code) { return S.docs.filter(function (r) { return (r.s || '').indexOf(code) >= 0 || (r.n || '').indexOf(code) >= 0; }); }
  function vSupFile(code) {
    var s = supBy(code); if (!s) return head('ملف المورد', '') + '<p class="empty">المورد غير موجود. <a href="#suppliers">سجل الموردين</a></p>';
    var w = canWrite(), docs = supDocs(code), ps = S.pur.filter(function (p) { return p.sup === code; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }), fs = S.supf.filter(function (x) { return x.sup === code; }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }), td = today();
    var h = head(esc(s.name), '<span class="code">' + esc(code) + '</span> · <a href="#suppliers">رجوع لسجل الموردين</a>', (w ? '<button class="btn" data-x="supedit" data-id="' + esc(code) + '">تعديل البيانات</button>' : '') + '<button class="btn noprint" data-x="print">طباعة</button>');
    h += '<div class="tiles"><div class="tile"><b style="font-size:17px"><span class="pill ' + (s.status === 'معتمد' ? 'good' : s.status === 'موقوف' ? 'bad' : 'warn') + '">' + esc(s.status) + '</span></b><span>الحالة · ' + esc(s.cls || '') + '</span></div><div class="tile"><b class="num">' + docs.length + '</b><span>ورقة في ملفه</span></div><div class="tile"><b class="num">' + ps.length + '</b><span>بند شراء</span></div><div class="tile"><b class="num">' + money(ps.reduce(function (a, p) { return a + (+p.value || 0); }, 0)) + '</b><span>إجمالي المشتريات ج.م</span></div><div class="tile"><b class="num">' + fs.length + '</b><span>مرفق</span></div></div>';
    h += '<div class="find l"><div><b>ما يورّده:</b> ' + esc(s.scope || '—') + '</div>' + (s.alt ? '<div><b>المورد البديل:</b> ' + esc(s.alt) + '</div>' : '') + (s.valid ? '<div><b>المستندات سارية حتى:</b> <span class="num">' + esc(fmtDate(s.valid)) + '</span></div>' : '') + (s.src ? '<div style="color:var(--muted)">المصدر: ' + esc(s.src) + '</div>' : '') + '</div>';
    var need = ['GEM-PU-F-8.4-01', 'GEM-PU-F-8.4-03'].filter(function (c) { return !docs.some(function (r) { return (r.n || '').indexOf(c) >= 0; }); });
    if (need.length) h += '<div class="note">ناقص في ملف المورد: ' + need.map(function (c) { var r = S.byCode[c]; return '<span class="code">' + c + '</span> ' + (r ? esc(title(r)) : ''); }).join(' · ') + '</div>';
    h += '<details class="sec" open><summary><span class="t">أوراق المورد في النظام</span><small class="num">' + docs.length + '</small></summary><div class="rows">' + (docs.map(function (r) { return rowHtml(r); }).join('') || '<div class="row">لا توجد أوراق لهذا المورد في مجلد الأوراق.</div>') + '</div></details>';
    h += '<details class="sec" open><summary><span class="t">المشتريات منه</span><small class="num">' + ps.length + '</small></summary>' + (ps.length ? '<div class="tblw" style="border:0"><table><thead><tr><th>رقم الطلب</th><th>التاريخ</th><th>البيان</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>' + ps.map(function (p) { return '<tr><td><span class="code">' + esc(p.pr) + '</span></td><td class="num">' + esc(fmtDate(p.date)) + '</td><td>' + esc(p.item) + '</td><td class="num">' + money(p.value) + '</td><td>' + esc(p.status || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="rows"><div class="row">لا توجد مشتريات مسجلة من هذا المورد.</div></div>') + '</details>';
    h += '<details class="sec" open><summary><span class="t">مرفقات المورد</span><small class="num">' + fs.length + '</small></summary>' + (w ? '<div class="track noprint" style="padding:10px 14px"><label style="flex:2;min-width:200px">الملف<input id="sf-f" type="file"></label><label>النوع<select class="mini" id="sf-k">' + SKINDS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label><label>سارٍ حتى (اختياري)<input class="mini" id="sf-v" type="date"></label><button class="btn pri" data-x="sfadd" data-id="' + esc(code) + '" style="align-self:flex-end">رفع</button></div>' : '') +
      (fs.length ? '<div class="tblw" style="border:0"><table><tbody>' + fs.map(function (x) { var ex = x.valid && x.valid < td; return '<tr><td><span class="pill">' + esc(x.kind) + '</span></td><td>' + esc(x.name) + '</td><td class="num">' + (x.valid ? '<span class="pill ' + (ex ? 'bad' : 'good') + '">' + (ex ? 'منتهٍ ' : 'سارٍ حتى ') + esc(fmtDate(x.valid)) + '</span>' : '') + '</td><td class="num">' + esc(fmtDate(x.at)) + '</td><td class="noprint"><div class="acts"><button class="btn" data-x="sfget" data-id="' + esc(x.id) + '">تحميل</button>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="supfiles" data-id="' + esc(x.id) + '" data-label="' + esc(x.name) + '">حذف</button>' : '') + '</div></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="rows"><div class="row">لا توجد مرفقات.</div></div>') + '</details>';
    return h;
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id;
    if (x === 'bkdrop') { S.bulk.splice(+id, 1); render(); }
    else if (x === 'gocyc') { S.cp = id; S.cr = ''; }
    else if (x === 'purlogall') { S.pm = monthAgo().slice(0, 7); purLog(); }
    else if (x === 'sfadd') { var f = ($('sf-f').files || [])[0]; if (!f) { toast('اختر الملف.'); return; } if (f.size > 10 * 1048576) { toast('الحد الأقصى 10 ميجابايت.'); return; } var kind = $('sf-k').value, valid = $('sf-v').value; toast('جارٍ الرفع…', 20000); storeFile(f).then(function (res) { return S.cap.db.collection('supfiles').add({ sup: id, kind: kind, valid: valid, asset: res.asset, name: res.name, ct: res.ct, size: res.size, at: new Date().toISOString(), by: meName() }); }).then(function () { toast('رُفع المرفق.'); }).catch(function () { toast('تعذر الرفع.'); }); }
    else if (x === 'sfget') { var a = S.supf.filter(function (y) { return y.id === id; })[0]; if (a) recBlob(a).then(function (bl) { return save(a.name, bl, 'نزل الملف.'); }).catch(function () { toast('تعذر التحميل.'); }); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.dataset && t.dataset.chg, b = c && S.bulk[+t.dataset.i]; if (!b) return;
    if (c === 'bkdate') { b.dt = t.value; t.blur(); }
    else if (c === 'bkcode') { var r = S.byCode[t.value.trim()] || null; b.r = r; b.how = r ? 'اخترته أنت' : ''; b.miss = null; b.checked = false; b.rowsN = 0; t.blur(); if (r && /\.docx$/i.test(b.f.name)) { b.wait = true; checkDocx(b).then(function () { b.wait = false; render(); }); } setTimeout(render, 50); }
  });


  /* ================= production orders: one order walked through the company's own process map P01 → P17 ================= */
  S.ord = [];
  (function () { var t = setInterval(function () { var db = S.cap.db; if (!db) return; clearInterval(t); db.collection('orders').onSnapshot(function (s) { S.ord = s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.no).localeCompare(String(a.no)); }); if (/^order/.test(route())) render(); }, function () { }); }, 800); })();
  var PRODS = ['سبائك الذهب 999.9', 'سبائك الذهب 995', 'عملات الذهب 875', 'سبائك الفضة 999.0'];
  function procs() { return ((window.GEM_PROCS || {}).p || []).filter(function (p) { return p.n !== 'P18'; }); }
  function ordCur(o) { var ps = procs(); for (var i = 0; i < ps.length; i++) if (!(o.steps || {})[ps[i].n]) return ps[i]; return null; }
  function ordPct(o) { var ps = procs(); return ps.length ? Math.round(ps.filter(function (p) { return (o.steps || {})[p.n]; }).length * 100 / ps.length) : 0; }
  function ordLate(o) { return !o.closed && o.due && o.due < today(); }
  function ordRecs(o, p, c) { var r = S.byCode[c]; return r ? S.arch.filter(function (a) { return a.order === o.id && a.doc === r.i && (!p || a.step === p.n); }) : []; }
  function nextOrd() { var mx = 0; S.ord.forEach(function (o) { var m = /-(\d+)$/.exec(o.no || ''); if (m && String(o.no).indexOf(String(CY)) >= 0) mx = Math.max(mx, +m[1]); }); return 'OP-' + CY + '-' + ('00' + (mx + 1)).slice(-3); }
  function vOrders() {
    var w = canWrite(), ps = procs(), owners = {}; ps.forEach(function (p) { owners[p.o] = 1; });
    var h = head('أوامر الإنتاج', 'كل أمر إنتاج يمشي على خريطة العمليات المعتمدة GEM-QA-F-4.4-01 من استلام طلب العميل (P01) حتى التسليم للعميل (P17).', '<select class="mini" data-chg="oo" aria-label="المسؤول"><option value="">كل المسؤولين</option>' + Object.keys(owners).map(function (k) { return '<option' + (S.oo === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' + (w ? '<button class="btn pri" data-x="ornew">أمر إنتاج جديد</button>' : ''));
    var list = S.ord.filter(function (o) { var c = ordCur(o); return !S.oo || (c && c.o === S.oo); }), open = S.ord.filter(function (o) { return !o.closed; });
    h += '<div class="tiles"><div class="tile"><b class="num">' + open.length + '</b><span>أمر مفتوح</span></div><div class="tile"><b class="num" style="color:var(--' + (open.filter(ordLate).length ? 'bad' : 'good') + ')">' + open.filter(ordLate).length + '</b><span>تجاوز موعد التسليم</span></div><div class="tile"><b class="num">' + S.ord.filter(function (o) { return o.closed; }).length + '</b><span>أمر سُلِّم للعميل</span></div></div>';
    if (!list.length) return h + '<p class="empty">لا توجد أوامر إنتاج.' + (w ? ' اضغط «أمر إنتاج جديد».' : '') + '</p>';
    h += '<div class="tblw"><table><thead><tr><th>رقم الأمر</th><th>العميل</th><th>المنتج</th><th>الكمية</th><th>موعد التسليم</th><th>الخطوة الحالية</th><th>عند</th><th>التقدم</th><th></th></tr></thead><tbody>' + list.map(function (o) {
      var c = ordCur(o);
      return '<tr><td><a href="#order-' + esc(o.id) + '"><span class="code">' + esc(o.no) + '</span></a></td><td>' + esc(o.cust) + '</td><td>' + esc(o.prod) + (o.spec ? ' · ' + esc(o.spec) : '') + '</td><td class="num">' + esc(o.qty || '') + '</td><td class="num">' + esc(fmtDate(o.due)) + (ordLate(o) ? ' <span class="pill bad">متأخر</span>' : '') + '</td><td>' + (c ? '<span class="code">' + c.n + '</span> ' + esc(c.t) : '<span class="pill good">سُلِّم للعميل</span>') + '</td><td>' + (c ? esc(c.o) : '') + '</td><td class="num">' + ordPct(o) + '%</td><td><a class="btn pri" href="#order-' + esc(o.id) + '">فتح</a></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }
  function vOrder(id) {
    var o = S.ord.filter(function (x) { return x.id === id; })[0]; if (!o) return head('أمر إنتاج', '') + '<p class="empty">الأمر غير موجود. <a href="#orders">أوامر الإنتاج</a></p>';
    var w = canWrite(), ps = procs(), cur = ordCur(o), pu = S.pur.filter(function (p) { return p.order === o.id; });
    var h = head('أمر إنتاج <span class="code">' + esc(o.no) + '</span>', esc(o.cust) + ' · ' + esc(o.prod) + (o.spec ? ' · ' + esc(o.spec) : '') + (o.qty ? ' · الكمية ' + esc(o.qty) : '') + (o.batch ? ' · تشغيلة <a href="#batch" data-x="gobatch" data-id="' + esc(o.batch) + '"><span class="code">' + esc(o.batch) + '</span></a>' : '') + ' · <a href="#orders">رجوع</a>', '<button class="btn noprint" data-x="qr" data-t="' + esc(o.batch || o.no) + '" data-s="' + esc(o.cust + ' · ' + o.prod) + '" data-h="' + (o.batch ? 'batch-' + encodeURIComponent(o.batch) : 'order-' + esc(o.id)) + '">ملصق QR</button>' + (w ? '<button class="btn noprint" data-x="orbatch" data-id="' + esc(o.id) + '">كود التشغيلة</button><button class="btn noprint" data-x="orncr" data-id="' + esc(o.id) + '">تسجيل عدم مطابقة</button>' : '') + '<button class="btn noprint" data-x="print">طباعة</button>' + (canAdmin() && !o.locked ? '<button class="btn danger noprint" data-act="del" data-kind="orders" data-id="' + esc(o.id) + '" data-label="' + esc(o.no) + '">حذف</button>' : ''));
    h += '<div class="find ' + (ordLate(o) ? 'h' : 'l') + '" style="flex-direction:row;align-items:center;gap:14px;flex-wrap:wrap">' + ring(ordPct(o)) + '<div style="flex:1;min-width:220px"><div>' + (cur ? 'الأمر الآن عند: <b>' + esc(cur.o) + '</b> · <span class="code">' + cur.n + '</span> ' + esc(cur.t) : '<span class="pill good">اكتمل الأمر وسُلِّم للعميل</span>') + '</div><div style="color:var(--muted)">تاريخ الأمر <span class="num">' + esc(fmtDate(o.date)) + '</span> · موعد التسليم <span class="num">' + esc(fmtDate(o.due) || 'غير محدد') + '</span>' + (ordLate(o) ? ' <span class="pill bad">تجاوز الموعد</span>' : '') + (o.note ? ' · ' + esc(o.note) : '') + '</div></div></div>';
    h += '<ol class="cyc">' + ps.map(function (p, i) {
      var st = (o.steps || {})[p.n], isCur = cur && cur.n === p.n, nx = ps[i + 1];
      var forms = p.c.map(function (c) { var r = S.byCode[c], n = ordRecs(o, p, c).length; if (!r) return '<span class="pill warn">' + esc(c) + '</span>'; return '<span class="ofm"><a class="pill ' + (n ? 'good' : 'form') + '" href="#doc-' + r.i + '" title="' + esc(title(r)) + '">' + esc(c) + ' ' + esc(title(r)) + (n ? ' · ' + n + ' سجل' : '') + '</a>' + (isCur && w ? (OFFICE[r.e] ? '<button class="btn" data-act="blank" data-id="' + r.i + '">نسخة للملء</button>' : '') + '<button class="btn" data-x="orup" data-id="' + esc(o.id) + '" data-p="' + p.n + '" data-c="' + esc(c) + '">رفع السجل</button>' : '') + '</span>'; }).join('');
      var x = '<li class="' + (st ? 'ok' : '') + (isCur ? ' cur' : '') + '"><span class="cn num">' + (st ? (st.na ? '—' : '✓') : p.n) + '</span><div class="cb"><div class="ct"><b>' + esc(p.t) + '</b> <span style="color:var(--muted)">· ' + esc(p.o) + '</span>' + (st ? ' <span class="pill ' + (st.na ? '' : st.miss && st.miss.length ? 'warn' : 'good') + '">' + (st.na ? 'لا تنطبق على هذا الأمر' : st.miss && st.miss.length ? 'تمت مع نقص ' + st.miss.length + ' سجل' : 'تمت') + ' ' + esc(fmtDate(st.at)) + (st.by ? ' · ' + esc(st.by) : '') + (st.sig ? ' · موقّعة إلكترونيًا' : '') + '</span>' : isCur ? ' <span class="pill warn">الخطوة الحالية</span>' : '') + '</div>';
      if (st && st.note) x += '<div style="color:var(--muted)">' + (st.na ? 'السبب: ' : 'ملاحظة: ') + esc(st.note) + '</div>';
      if (isCur || !st) x += '<div class="oio"><div><b>المدخلات:</b> ' + esc(p['in']).replace(/\n/g, '، ') + '</div><div><b>المخرجات:</b> ' + esc(p.out).replace(/\n/g, '، ') + '</div>' + (p.kpi && p.kpi !== '—' ? '<div><b>المؤشر:</b> ' + esc(p.kpi).replace(/\n/g, ' ') + '</div>' : '') + '</div>';
      if (forms) x += '<div class="cf" style="flex-direction:column;align-items:flex-start">' + forms + '</div>';
      if (p.n === 'P03') x += '<div>' + (pu.length ? pu.map(function (q) { return '<span class="pill ' + (supOk(q) ? 'good' : 'bad') + '">' + esc(q.pr) + ' · ' + esc(q.item) + ' · ' + money(q.value) + '</span>'; }).join(' ') + ' ' : '') + (isCur && w ? '<button class="btn" data-x="orpur" data-id="' + esc(o.id) + '">طلب شراء لهذا الأمر</button>' : '') + '</div>';
      x += '</div>';
      if (isCur && w) x += '<div class="ca" style="display:flex;flex-direction:column;gap:6px"><button class="btn pri" data-x="ordone2" data-id="' + esc(o.id) + '" data-p="' + p.n + '">' + (nx ? 'تمت، وتسليم إلى ' + nx.n : 'تم التسليم للعميل') + '</button><button class="btn" data-x="orna" data-id="' + esc(o.id) + '" data-p="' + p.n + '">لا تنطبق على هذا الأمر</button></div>';
      else if (st && w && !o.closed && (!st.sig || canAdmin()) && (!cur || ps[i + 1] === cur)) x += '<div class="ca"><button class="btn" data-x="orundo" data-id="' + esc(o.id) + '" data-p="' + p.n + '">تراجع</button></div>';
      return x + '</li>';
    }).join('') + '</ol>';
    var intro = (window.GEM_PROCS || {}).intro; if (intro) h += '<div class="note">' + esc(intro) + '</div>';
    return h;
  }
  function ordSave(o, msg) { var c = {}; for (var k in o) if (k !== 'id') c[k] = o[k]; c.name = o.no; return S.cap.db.doc('orders/' + o.id).set(c).then(function () { if (msg) toast(msg, 6000); }).catch(function () { toast('تعذر الحفظ.'); }); }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id, pn = b.dataset.p, o = S.ord.filter(function (y) { return y.id === id; })[0], ps = procs(), p = ps.filter(function (y) { return y.n === pn; })[0];
    if (x === 'purnew') S.purOrder = '';
    else if (x === 'ornew') dlg('<h2>أمر إنتاج جديد</h2><div class="two"><label>رقم الأمر<input id="or-no" type="text" dir="ltr" value="' + esc(nextOrd()) + '"></label><label>تاريخ الأمر<input id="or-d" type="date" value="' + today() + '"></label></div><label>العميل<input id="or-c" type="text" maxlength="120"></label><div class="two"><label>المنتج<select id="or-p">' + PRODS.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label><label>الفئة أو الوزن<input id="or-s" type="text" placeholder="مثال: 10 جم"></label></div><div class="two"><label>العدد أو الكمية<input id="or-q" type="text"></label><label>موعد التسليم المطلوب<input id="or-u" type="date"></label></div><label>متطلبات خاصة<input id="or-n" type="text" maxlength="200"></label><div id="or-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="orsave">فتح الأمر</button></div>');
    else if (x === 'orsave') { var g = function (i) { return ($(i).value || '').trim(); }, n = { no: g('or-no'), name: g('or-no'), date: g('or-d'), cust: g('or-c'), prod: g('or-p'), spec: g('or-s'), qty: g('or-q'), due: g('or-u'), note: g('or-n'), steps: {}, closed: false, at: new Date().toISOString(), by: meName() }; if (!n.no || !n.date || !n.cust) { $('or-m').textContent = 'رقم الأمر والتاريخ والعميل مطلوبة.'; return; } if (S.ord.some(function (y) { return y.no === n.no; })) { $('or-m').textContent = 'رقم الأمر مستخدم.'; return; } S.cap.db.collection('orders').add(n).then(function (r) { closeDlg(); notify(ps[0].o, 'أمر إنتاج جديد ' + n.no + ' (' + n.cust + ') عندك: ' + ps[0].n + ' ' + ps[0].t, r && r.id ? 'order-' + r.id : 'orders'); toast('فُتح الأمر. يبدأ من P01 عند ' + ps[0].o + '.', 7000); if (r && r.id) location.hash = 'order-' + r.id; }).catch(function () { $('or-m').textContent = 'تعذر الحفظ.'; }); }
    else if (x === 'ordone' && o && p) {
      var miss = p.c.filter(function (c) { return S.byCode[c] && !ordRecs(o, p, c).length; }), nx = ps[ps.indexOf(p) + 1];
      if (miss.length && !window.confirm('هذه الخطوة ناقصها ' + miss.length + ' سجل لم يُرفع لهذا الأمر:\n' + miss.join('\n') + '\n\nهل تكمل وتُسجَّل الخطوة «تمت مع نقص»؟')) return;
      var note = window.prompt('ملاحظة على الخطوة ' + p.n + ' (اختياري)'); if (note == null) return;
      o.steps = o.steps || {}; o.steps[p.n] = { at: new Date().toISOString(), by: meName(), note: note.trim(), miss: miss }; if (!nx) { o.closed = true; o.closedAt = new Date().toISOString(); }
      ordSave(o, nx ? 'انتقل الأمر إلى ' + nx.n + ' ' + nx.t + ' عند ' + nx.o + '.' : 'اكتمل الأمر وسُلِّم للعميل.'); render();
    }
    else if (x === 'orna' && o && p) { var why = window.prompt('سبب أن الخطوة ' + p.n + ' «' + p.t + '» لا تنطبق على هذا الأمر (مطلوب)'); if (why == null) return; if (!why.trim()) { toast('اكتب السبب.'); return; } var nx2 = ps[ps.indexOf(p) + 1]; o.steps = o.steps || {}; o.steps[p.n] = { at: new Date().toISOString(), by: meName(), note: why.trim(), na: true }; if (!nx2) { o.closed = true; o.closedAt = new Date().toISOString(); } ordSave(o); render(); }
    else if (x === 'orundo' && o && p) { delete o.steps[p.n]; o.closed = false; ordSave(o); render(); }
    else if (x === 'orup' && o && p) { var r = S.byCode[b.dataset.c]; if (!r) return; dlg('<h2>رفع سجل لأمر ' + esc(o.no) + '</h2><div><span class="code">' + esc(r.c) + '</span> ' + esc(title(r)) + ' · ' + p.n + '</div><label>الملف المملوء<input id="ou-f" type="file"></label><label>تاريخ السجل<input id="ou-d" type="date" value="' + today() + '"></label><div id="ou-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="orupgo" data-id="' + esc(o.id) + '" data-p="' + p.n + '" data-c="' + esc(r.c) + '">رفع وأرشفة</button></div>'); }
    else if (x === 'orupgo' && o && p) { var r2 = S.byCode[b.dataset.c], f = ($('ou-f').files || [])[0], dt = $('ou-d').value; if (!f || !dt) { $('ou-m').textContent = 'اختر الملف والتاريخ.'; return; } if (f.size > 10 * 1048576) { $('ou-m').textContent = 'الحد الأقصى 10 ميجابايت.'; return; } b.disabled = true; $('ou-m').textContent = 'جارٍ الرفع…'; storeFile(f).then(function (res) { return S.cap.db.collection('archive').add({ doc: r2.i, code: r2.c, d: r2.d, y: +dt.slice(0, 4), m: +dt.slice(5, 7), rd: dt, no: o.no, order: o.id, batch: o.batch || '', step: p.n, asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: 'أمر إنتاج ' + o.no + ' · ' + p.n, at: new Date().toISOString(), by: S.cap.uid }); }).then(function () { closeDlg(); toast('أُرشف السجل في ' + r2.d + ' وارتبط بالأمر.', 6000); }).catch(function () { b.disabled = false; $('ou-m').textContent = 'تعذر الرفع.'; }); }
    else if (x === 'orpur' && o) { S.purOrder = o.id; purDialog(); if ($('pu-pp')) $('pu-pp').value = 'أمر إنتاج ' + o.no; }
  });
  document.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset && t.dataset.chg === 'oo') { S.oo = t.value; render(); } });


  /* ================= in-system viewer and display names ================= */
  S.names = {};
  (function () { var t = setInterval(function () { var db = S.cap.db; if (!db) return; clearInterval(t); db.collection('names').onSnapshot(function (s) { S.names = {}; s.docs.forEach(function (d) { S.names[d.id] = d.data() || {}; }); render(); }, function () { }); }, 800); })();
  function title(r) { var o = S.names[r.i]; return (o && o.t) || r.t || r.n; }
  function dName(k) { var d = DEPTS.filter(function (x) { return x.k === k; })[0], o = d && S.names['dept-' + d.h]; return (o && o.t) || k; }
  var vCur = null;
  function vClose() { vCur = null; $('viewer').classList.remove('on'); $('vpages').innerHTML = ''; $('vpages').style.cssText = ''; }
  function showFile(name, getBlob, ext, extra) {
    var pg = $('vpages'), my = vCur = { name: name, blob: null, ext: ext };
    $('vtitle').textContent = name; $('vinfo').textContent = ''; pg.style.cssText = ''; pg.innerHTML = '<p class="empty">جارٍ فتح الملف…</p>';
    $('vacts').innerHTML = (extra || '') + '<button class="btn" data-x="vdl">تنزيل</button><button class="btn" data-x="vprint">طباعة</button><button class="btn pri" data-x="vx">إغلاق</button>';
    $('viewer').classList.add('on');
    getBlob().then(function (b) {
      if (vCur !== my) return; my.blob = b; ext = String(ext || '').toLowerCase();
      if (ext === 'docx' && window.docx) { pg.innerHTML = ''; return window.docx.renderAsync(b, pg, null, { inWrapper: true, breakPages: true, experimental: true, useBase64URL: true }); }
      if ((ext === 'xlsx' || ext === 'xls' || ext === 'csv') && window.XLSX) {
        return b.arrayBuffer().then(function (buf) {
          var wb = XLSX.read(buf, { type: 'array' }), i = 0, draw = function () { pg.innerHTML = '<div class="tabs" style="align-self:stretch">' + wb.SheetNames.map(function (n, k) { return '<button role="tab" aria-selected="' + (k === i) + '" data-sh="' + k + '">' + esc(n) + '</button>'; }).join('') + '</div><div class="xls">' + XLSX.utils.sheet_to_html(wb.Sheets[wb.SheetNames[i]], { header: '', footer: '' }) + '</div>'; };
          pg.onclick = function (e) { var t = e.target.closest('[data-sh]'); if (t) { i = +t.dataset.sh; draw(); } }; draw();
        });
      }
      if (ext === 'pdf') { pg.style.padding = '0'; pg.innerHTML = '<iframe title="' + esc(name) + '" style="width:100%;height:100%;border:0;flex:1" src="' + URL.createObjectURL(new Blob([b], { type: 'application/pdf' })) + '"></iframe>'; return; }
      if (/^(jpe?g|png|gif|webp)$/.test(ext)) { pg.innerHTML = '<img alt="' + esc(name) + '" style="max-width:100%;background:#fff" src="' + URL.createObjectURL(b) + '">'; return; }
      pg.innerHTML = '<p class="empty">هذا النوع (' + esc(ext) + ') لا يُعرض داخل النظام. اضغط «تنزيل» لفتحه.</p>';
    }).catch(function () { if (vCur === my) pg.innerHTML = '<p class="empty">تعذر فتح الملف. إن كانت الأوراق لم تُرفع بعد، يرفعها المسؤول من «مكتبة الأوراق».</p>'; });
  }
  function viewDoc(r) {
    var v = curVer(r.i);
    if (LOCAL && !v && !S.lib[r.i]) { openDoc(r, 'view'); return; }
    showFile((r.c ? r.c + ' · ' : '') + title(r), function () { return docBlob(r); }, v ? (v.name.split('.').pop() || r.e) : r.e, !S.auditor && r.e === 'docx' && isArchivable(r) ? '<button class="btn" data-x="fos" data-id="' + r.i + '">ملء على الشاشة</button>' : '');
  }
  function recOpen(a) { showFile(a.name || 'ملف', function () { return recBlob(a); }, (String(a.name || '').split('.').pop() || '').toLowerCase() || (a.ct === 'application/pdf' ? 'pdf' : String(a.ct || '').split('/').pop())); }
  function recViewable() { return true; }
  function renameDlg(key, cur, orig, what) { dlg('<h2>تغيير اسم ' + what + '</h2><label>الاسم المعروض في النظام<input id="rn-t" type="text" maxlength="160" value="' + esc(cur) + '"></label><p style="margin:0;color:var(--muted);font-size:13px">الاسم الأصلي: ' + esc(orig) + '<br>التغيير في عرض النظام فقط. الملف الأصلي وكوده لا يتغيران.</p><div class="acts"><button class="btn" data-act="closed">إلغاء</button>' + (cur !== orig ? '<button class="btn" data-x="rnreset" data-id="' + esc(key) + '">رجوع للاسم الأصلي</button>' : '') + '<button class="btn pri" data-x="rnsave" data-id="' + esc(key) + '">حفظ</button></div>'); }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id;
    if (x === 'vx') vClose();
    else if (x === 'vdl' && vCur && vCur.blob) save(/\.[a-z0-9]{2,5}$/i.test(vCur.name) ? vCur.name : vCur.name + '.' + (vCur.ext || 'docx'), vCur.blob, 'نزل الملف.');
    else if (x === 'vprint') { document.body.classList.add('pv'); window.print(); setTimeout(function () { document.body.classList.remove('pv'); }, 500); }
    else if (x === 'rn') { var r = S.byId[id]; if (r) renameDlg(id, title(r), r.t || r.n, 'الورقة'); }
    else if (x === 'rndept') { var d = DEPTS.filter(function (y) { return y.h === id; })[0]; if (d) renameDlg('dept-' + id, dName(d.k), d.k, 'القسم'); }
    else if (x === 'rnsave') { var t = ($('rn-t').value || '').trim(); if (!t) { toast('اكتب الاسم.'); return; } S.cap.db.doc('names/' + id).set({ t: t, name: t, at: new Date().toISOString(), by: meName() }).then(function () { closeDlg(); toast('تغيّر الاسم.'); }).catch(function () { toast('تعذر الحفظ.'); }); }
    else if (x === 'rnreset') S.cap.db.doc('names/' + id).delete().then(function () { closeDlg(); toast('رجع الاسم الأصلي.'); }).catch(function () { toast('تعذر الحفظ.'); });
  });
  window.addEventListener('hashchange', vClose);


  /* ================= my work, notifications, e-signature, on-screen fill, batch file, NCR, equipment, training, KPIs, backup, auditor accounts ================= */
  var FBG = function () { return window.GEM_FB || {}; };
  S.notes = []; S.ncr = []; S.equip = {}; S.staff = []; S.courses = []; S.kpi = [];
  (function () {
    var t = setInterval(function () {
      var db = S.cap.db; if (!db) return; clearInterval(t);
      var rows = function (s) { return s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }); }, q = function () { };
      db.collection('notes').onSnapshot(function (s) { S.notes = rows(s).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }); render(); }, q);
      db.collection('ncr').onSnapshot(function (s) { S.ncr = rows(s).sort(function (a, b) { return String(b.no).localeCompare(String(a.no)); }); render(); }, q);
      db.collection('equip').onSnapshot(function (s) { S.equip = {}; rows(s).forEach(function (r) { S.equip[r.id] = r; }); if (/^(equip|alerts|mine)/.test(route())) render(); }, q);
      db.collection('staff').onSnapshot(function (s) { S.staff = rows(s).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); }); if (route() === 'training') render(); }, q);
      db.collection('courses').onSnapshot(function (s) { S.courses = rows(s); if (route() === 'training') render(); }, q);
      db.collection('kpi').onSnapshot(function (s) { S.kpi = rows(s); if (route() === 'kpi') render(); }, q);
    }, 800);
  })();
  function isAud() { var m = FBG().me; return !!(m && m.role === 'auditor'); }
  window.addEventListener('gem-admins', function () { if (isAud() && !S.auditor) { S.auditor = true; render(); } });
  document.addEventListener('click', function (ev) { if (isAud() && ev.target.closest('[data-act="auditor"]')) { ev.stopPropagation(); ev.preventDefault(); toast('هذا حساب مراجع للقراءة فقط.'); } }, true);
  function jobs() { var l = []; procs().forEach(function (p) { if (l.indexOf(p.o) < 0) l.push(p.o); }); ['مدير الجودة', 'مدير الإنتاج', 'مدير المعمل', 'مدير الصيانة', 'مدير الموارد البشرية', 'مسؤول السلامة والبيئة', 'مدير الحسابات والمشتريات'].forEach(function (j) { if (l.indexOf(j) < 0) l.push(j); }); return l; }
  function myJob() { var m = FBG().me; if (m && m.job) return m.job; try { return localStorage.getItem('gem-job') || ''; } catch (e) { return ''; } }
  function jobSel(id, cur, attrs) { return '<select class="mini" id="' + id + '" ' + (attrs || '') + '><option value="">—</option>' + jobs().map(function (j) { return '<option' + (j === cur ? ' selected' : '') + '>' + esc(j) + '</option>'; }).join('') + '</select>'; }

  /* ---- notifications ---- */
  function lastRead() { try { return localStorage.getItem('gem-read') || ''; } catch (e) { return ''; } }
  function myNotes() { var j = myJob(); return S.notes.filter(function (n) { return canAdmin() ? true : n.to === j; }); }
  function unread() { var j = myJob(), lr = lastRead(); return S.notes.filter(function (n) { return n.to === j && n.at > lr && n.by !== meName(); }).length; }
  function notify(to, text, link) { if (!to || !S.cap.db) return; S.cap.db.collection('notes').add({ to: to, text: text, name: text, link: link || '', at: new Date().toISOString(), by: meName() }).catch(function () { }); }
  function contacts(job, text) {
    var us = (FBG().users || []).filter(function (u) { return u.job === job && u.active !== false && !u.replaced; }), out = '';
    us.forEach(function (u) { var ph = String(u.phone || '').replace(/\D/g, ''); if (ph) out += '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + (ph.indexOf('0') === 0 ? '2' + ph : ph) + '?text=' + encodeURIComponent(text) + '">واتساب ' + esc(u.name || u.username) + '</a>'; if (u.mail) out += '<a class="btn" href="mailto:' + esc(u.mail) + '?subject=' + encodeURIComponent('نظام ISO عصر الدهب') + '&body=' + encodeURIComponent(text) + '">إيميل ' + esc(u.name || u.username) + '</a>'; });
    return out;
  }
  function vNotes() {
    var l = myNotes(), lr = lastRead(), j = myJob();
    var h = head('الإشعارات', j ? 'الإشعارات الموجهة إلى: ' + esc(j) + (canAdmin() ? ' (وكمسؤول ترى الكل)' : '') : 'حدّد وظيفتك من صفحة «شغلي» لتصلك إشعاراتها.', '<button class="btn" data-x="ntread">تعليم الكل كمقروء</button>');
    if (!l.length) return h + '<p class="empty">لا توجد إشعارات.</p>';
    return h + '<div class="tblw"><table><thead><tr><th>الوقت</th><th>إلى</th><th>الإشعار</th><th>من</th><th></th></tr></thead><tbody>' + l.slice(0, 300).map(function (n) { var t = new Date(n.at), c = contacts(n.to, n.text); return '<tr' + (n.to === j && n.at > lr ? ' style="font-weight:700"' : '') + '><td class="num">' + esc(fmtDate(n.at)) + ' ' + ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) + '</td><td>' + esc(n.to) + '</td><td>' + (n.link ? '<a href="#' + esc(n.link) + '">' + esc(n.text) + '</a>' : esc(n.text)) + '</td><td>' + esc(n.by || '') + '</td><td><div class="acts">' + c + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---- my work ---- */
  function vMine() {
    var j = myJob(), fixed = !!(FBG().me && FBG().me.job);
    var h = head('شغلي', 'كل ما هو عندك الآن حسب وظيفتك.', fixed ? '<span class="pill form">' + esc(j) + '</span>' : jobSel('mj', j, 'data-chg="myjob" aria-label="وظيفتي"'));
    if (!j) return h + '<p class="empty">اختر وظيفتك من القائمة أعلى الصفحة.</p>';
    var os = S.ord.filter(function (o) { var c = ordCur(o); return c && c.o === j; }), nc = S.ncr.filter(function (n) { return n.st !== 'مغلقة' && n.owner === j; }), nt = S.notes.filter(function (n) { return n.to === j; }).slice(0, 8), pv = canAdmin() ? (S.vers || []).filter(function (v) { return v.st === 'pending'; }) : [];
    h += '<div class="tiles"><div class="tile"><b class="num">' + os.length + '</b><span>أمر إنتاج عندي</span></div><div class="tile"><b class="num">' + nc.length + '</b><span>عدم مطابقة مسؤول عنها</span></div><div class="tile"><b class="num">' + unread() + '</b><span>إشعار جديد</span></div>' + (canAdmin() ? '<div class="tile"><b class="num">' + pv.length + '</b><span>إصدار ينتظر اعتمادي</span></div>' : '') + '</div>';
    h += '<details class="sec" open><summary><span class="t">أوامر الإنتاج عندي</span><small class="num">' + os.length + '</small></summary><div class="rows">' + (os.map(function (o) { var c = ordCur(o); return '<div class="row"><div><div class="ttl"><span class="code">' + esc(o.no) + '</span> ' + esc(o.cust) + ' · ' + esc(o.prod) + '</div><div class="sub"><span>' + c.n + ' ' + esc(c.t) + '</span><span class="num">التسليم ' + esc(fmtDate(o.due) || '—') + '</span>' + (ordLate(o) ? '<span class="pill bad">متأخر</span>' : '') + '</div></div><div class="acts"><a class="btn pri" href="#order-' + esc(o.id) + '">فتح</a></div></div>'; }).join('') || '<div class="row">لا يوجد أمر عندك الآن.</div>') + '</div></details>';
    h += '<details class="sec" open><summary><span class="t">عدم المطابقة المسؤول عنها</span><small class="num">' + nc.length + '</small></summary><div class="rows">' + (nc.map(function (n) { return '<div class="row"><div><div class="ttl"><span class="code">' + esc(n.no) + '</span> ' + esc(n.desc) + '</div><div class="sub"><span class="num">الموعد ' + esc(fmtDate(n.due) || '—') + '</span></div></div><div class="acts"><a class="btn" href="#ncr">فتح</a></div></div>'; }).join('') || '<div class="row">لا يوجد.</div>') + '</div></details>';
    h += '<details class="sec" open><summary><span class="t">آخر الإشعارات</span><small class="num">' + nt.length + '</small></summary><div class="rows">' + (nt.map(function (n) { return '<div class="row"><div><div class="ttl">' + (n.link ? '<a href="#' + esc(n.link) + '">' + esc(n.text) + '</a>' : esc(n.text)) + '</div><div class="sub"><span class="num">' + esc(fmtDate(n.at)) + '</span><span>' + esc(n.by || '') + '</span></div></div></div>'; }).join('') || '<div class="row">لا يوجد.</div>') + '</div></details>';
    return h;
  }

  /* ---- electronic signature ---- */
  function askSign(ttl, body, cb) {
    askSign.cb = cb;
    dlg('<h2>' + ttl + '</h2>' + (body || '') + '<label>ملاحظة (اختياري)<input id="sg-n" type="text" maxlength="200"></label><label>كلمة المرور للتوقيع<input id="sg-p" type="password" autocomplete="current-password"></label><p style="margin:0;color:var(--muted);font-size:13px">يُسجَّل التوقيع باسمك: ' + esc(meName()) + '</p><div id="sg-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="sgok">توقيع وتأكيد</button></div>');
  }
  function signGo(b) {
    var note = ($('sg-n').value || '').trim(), pw = $('sg-p').value || '', F = FBG(), done = function () { var cb = askSign.cb; askSign.cb = null; closeDlg(); if (cb) cb(note); };
    if (!F.verify) { done(); return; }
    if (!pw) { $('sg-m').textContent = 'اكتب كلمة المرور.'; return; }
    b.disabled = true; F.verify(pw).then(done).catch(function () { b.disabled = false; $('sg-m').textContent = 'كلمة المرور غير صحيحة.'; });
  }

  /* ---- fill a Word form on screen ---- */
  var fosCur = null;
  function addRun(doc, p, text) { var r = doc.createElementNS(WNS, 'w:r'), rp = doc.createElementNS(WNS, 'w:rPr'), f = doc.createElementNS(WNS, 'w:rFonts'), t = doc.createElementNS(WNS, 'w:t'); ['ascii', 'hAnsi', 'cs'].forEach(function (a) { f.setAttributeNS(WNS, 'w:' + a, 'Alyamama SemiBold'); }); rp.appendChild(f); ['sz', 'szCs'].forEach(function (a) { var e = doc.createElementNS(WNS, 'w:' + a); e.setAttributeNS(WNS, 'w:val', '18'); rp.appendChild(e); }); rp.appendChild(doc.createElementNS(WNS, 'w:rtl')); t.setAttribute('xml:space', 'preserve'); t.textContent = ' ' + text; r.appendChild(rp); r.appendChild(t); p.appendChild(r); }
  function openFos(r) {
    if (r.e !== 'docx') { toast('الملء على الشاشة متاح لنماذج Word.'); return; }
    var pg = $('vpages'); $('vtitle').textContent = 'ملء ' + (r.c ? r.c + ' · ' : '') + title(r); $('vinfo').textContent = ''; pg.style.cssText = ''; pg.innerHTML = '<p class="empty">جارٍ قراءة النموذج…</p>';
    $('vacts').innerHTML = '<button class="btn" data-x="fosdl">تنزيل Word</button><button class="btn pri" data-x="fosar">حفظ في الأرشيف</button><button class="btn" data-x="vx">إغلاق</button>'; $('viewer').classList.add('on');
    tplFields(r).then(function (tpl) {
      fosCur = { r: r, tpl: tpl, rows: tpl.grids.map(function () { return 5; }) }; drawFos();
    }).catch(function () { pg.innerHTML = '<p class="empty">تعذر قراءة النموذج. يرفع المسؤول الأوراق أولًا من «مكتبة الأوراق».</p>'; });
  }
  function drawFos(keep) {
    var c = fosCur, pg = $('vpages'), vals = {}; if (!c) return;
    if (keep) Array.prototype.forEach.call(pg.querySelectorAll('[data-k]'), function (i) { vals[i.dataset.k] = i.value; });
    var seen = {}, h = '<div class="fos"><label>تاريخ السجل<input class="mini" id="fos-d" type="date" data-k="d" value="' + today() + '"></label>';
    if (c.tpl.fields.length) h += '<h3>البيانات</h3><div class="fosg">' + c.tpl.fields.map(function (f, i) { var n = seen[f.label] = (seen[f.label] || 0) + 1; return '<label>' + esc(f.label) + (n > 1 ? ' (' + n + ')' : '') + '<input type="text" data-k="f' + i + '"></label>'; }).join('') + '</div>';
    c.tpl.grids.forEach(function (g, gi) {
      var cols = g.cols || []; h += '<h3>جدول: ' + esc(g.head) + '</h3><div class="tblw"><table><thead><tr>' + cols.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
      for (var k = 0; k < c.rows[gi]; k++) h += '<tr>' + cols.map(function (x, j) { return '<td>' + (j === 0 && /^(م|#|No\.?)$/i.test(x) ? '<span class="num">' + (k + 1) + '</span>' : '<input type="text" data-k="g' + gi + '_' + k + '_' + j + '" style="width:100%;min-width:70px">') + '</td>'; }).join('') + '</tr>';
      h += '</tbody></table></div><div><button class="btn" data-x="fosrow" data-id="' + gi + '">إضافة صف</button></div>';
    });
    if (!c.tpl.fields.length && !c.tpl.grids.length) h += '<p class="empty">لم أجد خانات قابلة للملء في هذا النموذج. استخدم «فتح نسخة للملء في Word».</p>';
    pg.innerHTML = h + '<p style="color:var(--muted);font-size:13px">ما تكتبه يوضع في خاناته داخل نسخة من النموذج الأصلي. راجع الملف الناتج قبل اعتماده.</p></div>';
    Array.prototype.forEach.call(pg.querySelectorAll('[data-k]'), function (i) { if (vals[i.dataset.k] != null) i.value = vals[i.dataset.k]; });
  }
  function fosBuild() {
    var c = fosCur, vals = {}; Array.prototype.forEach.call($('vpages').querySelectorAll('[data-k]'), function (i) { if (i.value.trim()) vals[i.dataset.k] = i.value.trim(); });
    var zip;
    return docBlob(c.r).then(function (b) { return JSZip.loadAsync(b); }).then(function (z) { zip = z; return z.file('word/document.xml').async('string'); }).then(function (xml) {
      var doc = new DOMParser().parseFromString(xml, 'application/xml'), tbls = Array.prototype.slice.call(doc.getElementsByTagNameNS(WNS, 'tbl'));
      var cell = function (ti, ri, ci) { var tr = tbls[ti] && kids(tbls[ti], 'tr')[ri]; return tr && kids(tr, 'tc')[ci]; };
      c.tpl.fields.forEach(function (f, i) { var v = vals['f' + i], tc = v && cell(f.ti, f.ri, f.ci); if (!tc) return; if (f.inl) { var p = kids(tc, 'p').filter(function (x) { return cellText(x).replace(/\s+/g, ' ').trim() === f.inl; })[0]; if (p) addRun(doc, p, v); } else putCell(doc, tc, v); });
      c.tpl.grids.forEach(function (g, gi) {
        var tb = tbls[g.ti]; if (!tb) return;
        for (var k = 0; k < c.rows[gi]; k++) {
          var has = false, j; for (j = 0; j < (g.cols || []).length; j++) if (vals['g' + gi + '_' + k + '_' + j]) has = true; if (!has) continue;
          var trs = kids(tb, 'tr'), tr = trs[g.first + k]; if (!tr) { tr = trs[trs.length - 1].cloneNode(true); Array.prototype.forEach.call(tr.getElementsByTagNameNS(WNS, 't'), function (t) { t.textContent = ''; }); trs[trs.length - 1].parentNode.insertBefore(tr, trs[trs.length - 1].nextSibling); }
          var cs = kids(tr, 'tc'); for (j = 0; j < cs.length; j++) { var v = vals['g' + gi + '_' + k + '_' + j]; if (v && !cellText(cs[j]).trim()) putCell(doc, cs[j], v); else if (j === 0 && !cellText(cs[0]).trim() && /^(م|#)$/.test((g.cols || [])[0] || '')) putCell(doc, cs[0], k + 1); }
        }
      });
      var out = new XMLSerializer().serializeToString(doc); if (out.indexOf('<?xml') !== 0) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out;
      zip.file('word/document.xml', out); return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    }).then(function (b) { var dt = ($('fos-d') && $('fos-d').value) || today(); return { blob: b, dt: dt, name: (c.r.c || c.r.n) + ' ' + title(c.r) + ' - ' + dt + '.docx' }; });
  }

  /* ---- batch file ---- */
  function vBatch() {
    var q = (S.bq || '').trim(), h = head('ملف التشغيلة', 'اكتب كود التشغيلة أو رقم أمر الإنتاج، يجمع النظام كل ما يخصه من أول الخامة حتى التسليم.', '<label class="search"><input id="bq" type="search" dir="ltr" placeholder="GE-201126-999.9A" value="' + esc(q) + '" data-chg="bq" aria-label="كود التشغيلة"></label>');
    if (q.length < 3) return h + '<p class="empty">اكتب 3 حروف على الأقل ثم اضغط Enter.</p>';
    var lq = q.toLowerCase(), has = function (s) { return String(s || '').toLowerCase().indexOf(lq) >= 0; };
    var os = S.ord.filter(function (o) { return has(o.no) || has(o.batch); }), oid = {}; os.forEach(function (o) { oid[o.id] = o; });
    var ar = S.arch.filter(function (a) { return oid[a.order] || has(a.batch) || has(a.no) || has(a.note) || has(a.name); }).sort(function (a, b) { return String(a.rd).localeCompare(String(b.rd)); });
    var cy = S.cyc.filter(function (c) { return has(c.ref); }), nc = S.ncr.filter(function (n) { return has(n.ref) || has(n.desc); }), pu = S.pur.filter(function (p) { return oid[p.order] || has(p.purpose) || has(p.note); });
    h += '<div class="tiles"><div class="tile"><b class="num">' + os.length + '</b><span>أمر إنتاج</span></div><div class="tile"><b class="num">' + ar.length + '</b><span>سجل مؤرشف</span></div><div class="tile"><b class="num">' + pu.length + '</b><span>بند شراء</span></div><div class="tile"><b class="num" style="color:var(--' + (nc.length ? 'bad' : 'good') + ')">' + nc.length + '</b><span>عدم مطابقة</span></div></div>';
    if (!os.length && !ar.length && !cy.length && !nc.length && !pu.length) return h + '<p class="empty">لا يوجد شيء مسجل بهذا الكود.</p>';
    os.forEach(function (o) { var c = ordCur(o); h += '<div class="find l"><div><a href="#order-' + esc(o.id) + '"><span class="code">' + esc(o.no) + '</span></a> ' + esc(o.cust) + ' · ' + esc(o.prod) + (o.batch ? ' · تشغيلة <span class="code">' + esc(o.batch) + '</span>' : '') + '</div><div style="color:var(--muted)">' + (c ? 'عند ' + esc(c.o) + ' · ' + c.n + ' ' + esc(c.t) : 'سُلِّم للعميل ' + esc(fmtDate(o.closedAt))) + ' · ' + ordPct(o) + '%</div></div>'; });
    if (ar.length) h += '<details class="sec" open><summary><span class="t">السجلات بالترتيب الزمني</span><small class="num">' + ar.length + '</small></summary><div class="tblw" style="border:0"><table><thead><tr><th>التاريخ</th><th>الخطوة</th><th>النموذج</th><th>الملف</th><th></th></tr></thead><tbody>' + ar.map(function (a) { var r = S.byId[a.doc]; return '<tr><td class="num">' + esc(fmtDate(a.rd)) + '</td><td>' + esc(a.step || '') + '</td><td>' + (r ? '<a href="#doc-' + r.i + '"><span class="code">' + esc(r.c || '') + '</span> ' + esc(title(r)) + '</a>' : '') + '</td><td>' + esc(a.name) + '</td><td><button class="btn" data-act="aview" data-id="' + esc(a.id) + '">عرض</button></td></tr>'; }).join('') + '</tbody></table></div></details>';
    if (pu.length) h += '<details class="sec" open><summary><span class="t">المشتريات</span><small class="num">' + pu.length + '</small></summary><div class="tblw" style="border:0"><table><tbody>' + pu.map(function (p) { return '<tr><td><span class="code">' + esc(p.pr) + '</span></td><td>' + esc(p.item) + '</td><td>' + esc(supLabel(p)) + '</td><td class="num">' + money(p.value) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    if (nc.length) h += '<details class="sec" open><summary><span class="t">عدم المطابقة</span><small class="num">' + nc.length + '</small></summary><div class="tblw" style="border:0"><table><tbody>' + nc.map(function (n) { return '<tr><td><span class="code">' + esc(n.no) + '</span></td><td>' + esc(n.desc) + '</td><td>' + esc(n.st) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    if (cy.length) h += '<details class="sec"><summary><span class="t">دورات خطوات الإجراءات</span><small class="num">' + cy.length + '</small></summary><div class="rows">' + cy.map(function (c) { return '<div class="row"><div><span class="code">' + esc(c.proc) + '</span> ' + esc(c.ref) + ' · ' + esc(fmtDate(c.date)) + '</div></div>'; }).join('') + '</div></details>';
    return h;
  }

  /* ---- nonconformity and corrective action ---- */
  var NSRC = ['أمر إنتاج', 'مورد', 'تدقيق داخلي', 'شكوى عميل', 'فحص جودة', 'أخرى'], NST = ['مفتوحة', 'جارٍ التنفيذ', 'مغلقة'];
  function vNcr() {
    var w = canWrite(), td = today(), open = S.ncr.filter(function (n) { return n.st !== 'مغلقة'; });
    var h = head('عدم المطابقة والإجراء التصحيحي', 'سجل متابعة: الحالة، السبب، الإجراء، المسؤول، والتحقق من الفعالية. السجل الرسمي يبقى على نماذجكم.', w ? '<button class="btn pri" data-x="ncnew">حالة جديدة</button>' : '');
    h += '<div class="tiles"><div class="tile"><b class="num">' + open.length + '</b><span>حالة لم تُغلق</span></div><div class="tile"><b class="num" style="color:var(--' + (open.filter(function (n) { return n.due && n.due < td; }).length ? 'bad' : 'good') + ')">' + open.filter(function (n) { return n.due && n.due < td; }).length + '</b><span>تجاوزت موعدها</span></div><div class="tile"><b class="num">' + (S.ncr.length - open.length) + '</b><span>أُغلقت بعد التحقق</span></div></div>';
    h += '<div class="note">النماذج الرسمية: ' + ['GEM-QC-F-8.7-01', 'GEM-QC-F-8.7-02', 'GEM-QA-F-10.2-01', 'GEM-QA-F-10.2-02'].map(function (c) { var r = S.byCode[c]; return r ? '<a href="#doc-' + r.i + '"><span class="code">' + c + '</span> ' + esc(title(r)) + '</a>' : ''; }).filter(Boolean).join(' · ') + '</div>';
    if (!S.ncr.length) return h + '<p class="empty">لا توجد حالات مسجلة.</p>';
    return h + '<div class="tblw"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>المصدر</th><th>الوصف</th><th>السبب الجذري</th><th>الإجراء</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th><th></th></tr></thead><tbody>' + S.ncr.map(function (n) { var late = n.st !== 'مغلقة' && n.due && n.due < td; return '<tr><td><span class="code">' + esc(n.no) + '</span></td><td class="num">' + esc(fmtDate(n.date)) + '</td><td>' + esc(n.src) + (n.ref ? '<br><span class="num">' + esc(n.ref) + '</span>' : '') + '</td><td>' + esc(n.desc) + '</td><td>' + esc(n.cause || '') + '</td><td>' + esc(n.action || '') + '</td><td>' + esc(n.owner || '') + '</td><td class="num">' + esc(fmtDate(n.due)) + (late ? ' <span class="pill bad">متأخرة</span>' : '') + '</td><td><span class="pill ' + (n.st === 'مغلقة' ? 'good' : n.st === 'مفتوحة' ? 'bad' : 'warn') + '">' + esc(n.st) + '</span>' + (n.st === 'مغلقة' ? '<br><span style="font-size:12px;color:var(--muted)">' + esc(n.verify || '') + (n.closedBy ? ' · ' + esc(n.closedBy) : '') + '</span>' : '') + '</td><td><div class="acts">' + (w && n.st !== 'مغلقة' ? '<button class="btn" data-x="ncedit" data-id="' + esc(n.id) + '">تعديل</button><button class="btn pri" data-x="ncclose" data-id="' + esc(n.id) + '">إغلاق بعد التحقق</button>' : '') + (canAdmin() && !n.locked ? '<button class="btn danger" data-act="del" data-kind="ncr" data-id="' + esc(n.id) + '" data-label="' + esc(n.no) + '">حذف</button>' : '') + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function ncDialog(id, pre) {
    var n = id ? S.ncr.filter(function (x) { return x.id === id; })[0] : null, mx = 0; S.ncr.forEach(function (x) { var m = /^NCR-(\d{4})-(\d+)$/.exec(x.no || ''); if (m && +m[1] === CY) mx = Math.max(mx, +m[2]); });
    n = n || { no: 'NCR-' + CY + '-' + ('00' + (mx + 1)).slice(-3), date: today(), src: (pre && pre.src) || NSRC[0], ref: (pre && pre.ref) || '', desc: '', cause: '', action: '', owner: '', due: '', st: 'مفتوحة' };
    var f = function (l, i, v, t) { return '<label>' + l + '<input id="' + i + '" type="' + (t || 'text') + '" value="' + esc(v || '') + '"></label>'; };
    dlg('<h2>' + (id ? 'تعديل حالة ' : 'حالة عدم مطابقة ') + '<span class="code">' + esc(n.no) + '</span></h2><div class="two">' + f('التاريخ', 'nc-d', n.date, 'date') + '<label>المصدر<select id="nc-s">' + NSRC.map(function (x) { return '<option' + (n.src === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' + f('المرجع (رقم الأمر، كود التشغيلة، المورد)', 'nc-r', n.ref) + f('وصف عدم المطابقة', 'nc-x', n.desc) + f('السبب الجذري', 'nc-c', n.cause) + f('الإجراء التصحيحي', 'nc-a', n.action) + '<div class="two"><label>المسؤول' + jobSel('nc-o', n.owner) + '</label>' + f('موعد التنفيذ', 'nc-u', n.due, 'date') + '</div><label>الحالة<select id="nc-t">' + NST.slice(0, 2).map(function (x) { return '<option' + (n.st === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label><div id="nc-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="ncsave" data-id="' + esc(id || '') + '" data-no="' + esc(n.no) + '">حفظ</button></div>');
  }

  /* ---- equipment: calibration and maintenance ---- */
  function equipList() { var m = {}; (window.GEM_EQUIP || []).forEach(function (e) { var c = {}; for (var k in e) c[k] = e[k]; m[e.code] = c; }); Object.keys(S.equip).forEach(function (k) { var o = S.equip[k], b = m[k] || { code: k, name: '', src: 'أضيف من النظام' }; for (var f in o) if (f !== 'id' && o[f] !== '' && o[f] != null) b[f] = o[f]; m[k] = b; }); return Object.keys(m).sort().map(function (k) { return m[k]; }); }
  function dueIn(d) { return d ? Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 86400000) : null; }
  function duePill(d) { var n = dueIn(d); return d ? '<span class="num">' + esc(fmtDate(d)) + '</span> ' + (n < 0 ? '<span class="pill bad">فات الموعد</span>' : n <= 30 ? '<span class="pill warn">باقٍ ' + n + ' يوم</span>' : '') : ''; }
  function equipDue() { return equipList().filter(function (e) { var a = dueIn(e.next), b = dueIn(e.pmNext); return (a != null && a <= 30) || (b != null && b <= 30); }); }
  function vEquip() {
    var w = canWrite(), l = equipList(), f = S.ef || '', due = equipDue();
    var h = head('المعدات: المعايرة والصيانة', 'القائمة من سجل المعدات GEM-MT-F-7.1.3-01 وقائمة أجهزة المعمل GEM-LB-F-7.1.5-01، مع المواعيد التي تسجلها هنا.', '<select class="mini" data-chg="ef"><option value="">كل المعدات</option><option value="due"' + (f === 'due' ? ' selected' : '') + '>المستحق خلال 30 يومًا</option><option value="cal"' + (f === 'cal' ? ' selected' : '') + '>تحتاج معايرة</option></select>' + (w ? '<button class="btn pri" data-x="eqnew">إضافة معدة</button>' : ''));
    h += '<div class="tiles"><div class="tile"><b class="num">' + l.length + '</b><span>معدة وجهاز</span></div><div class="tile"><b class="num">' + l.filter(function (e) { return e.next; }).length + '</b><span>لها موعد معايرة مسجل</span></div><div class="tile"><b class="num" style="color:var(--' + (due.length ? 'bad' : 'good') + ')">' + due.length + '</b><span>مستحق خلال 30 يومًا</span></div><div class="tile"><b class="num">' + l.filter(function (e) { return !e.pmNext; }).length + '</b><span>بلا موعد صيانة قادم</span></div></div>';
    if (/^equip-/.test(route())) { var only = decodeURIComponent(route().slice(6)); l = l.filter(function (e) { return e.code === only; }); } else if (f === 'due') l = due; else if (f === 'cal') l = l.filter(function (e) { return e.next || /نعم|معايرة/.test(e.cal || ''); });
    return h + '<div class="tblw"><table><thead><tr><th>الكود</th><th>المعدة</th><th>العملية</th><th>الأهمية</th><th>الحالة</th><th>آخر معايرة</th><th>المعايرة القادمة</th><th>آخر صيانة</th><th>الصيانة القادمة</th><th></th></tr></thead><tbody>' + l.map(function (e) { return '<tr><td><span class="code">' + esc(e.code) + '</span></td><td>' + esc(e.name) + (e.model ? '<br><span style="font-size:12px;color:var(--muted)">' + esc(e.model) + '</span>' : '') + '</td><td>' + esc(e.p || '') + '</td><td>' + esc(e.crit || '') + '</td><td>' + esc(e.st || '') + '</td><td class="num">' + esc(fmtDate(e.last)) + '</td><td>' + duePill(e.next) + '</td><td class="num">' + esc(fmtDate(e.pmLast)) + '</td><td>' + duePill(e.pmNext) + '</td><td>' + '<div class="acts">' + (w ? '<button class="btn" data-x="eqedit" data-id="' + esc(e.code) + '">تحديث</button>' : '') + '<button class="btn" data-x="qr" data-t="' + esc(e.code) + '" data-s="' + esc(e.name) + '" data-h="equip-' + encodeURIComponent(e.code) + '">QR</button></div></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function eqDialog(code) {
    var e = code ? equipList().filter(function (x) { return x.code === code; })[0] : { code: '', name: '' }, f = function (l, i, v, t, ex) { return '<label>' + l + '<input id="' + i + '" type="' + (t || 'text') + '" value="' + esc(v || '') + '"' + (ex || '') + '></label>'; };
    dlg('<h2>' + (code ? 'تحديث معدة' : 'إضافة معدة') + '</h2><div class="two">' + f('الكود', 'eq-c', e.code, 'text', code ? ' readonly dir="ltr"' : ' dir="ltr"') + f('الاسم', 'eq-n', e.name) + '</div>' + f('الحالة', 'eq-s', e.st) + '<div class="two">' + f('آخر معايرة', 'eq-l', e.last, 'date') + f('المعايرة القادمة', 'eq-x', e.next, 'date') + '</div><div class="two">' + f('آخر صيانة وقائية', 'eq-pl', e.pmLast, 'date') + f('الصيانة القادمة', 'eq-pn', e.pmNext, 'date') + '</div>' + f('ملاحظات', 'eq-o', e.note) + '<div id="eq-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="eqsave">حفظ</button></div>');
  }

  /* ---- training matrix ---- */
  function courseList() { return (window.GEM_COURSES || []).map(function (c) { return { id: 'c' + c.n, t: c.t, who: c.who, month: c.month, plan: true }; }).concat(S.courses.map(function (c) { return { id: c.id, t: c.t, who: c.who || '', month: c.month || '' }; })); }
  function vTraining() {
    var w = canWrite(), cs = courseList(), st = S.staff, gaps = 0, done = 0; st.forEach(function (s) { cs.forEach(function (c) { if ((s.tr || {})[c.id]) done++; else gaps++; }); });
    var h = head('مصفوفة التدريب', 'الدورات من خطة التدريب السنوية GEM-TR-PL-7.2-01. اضغط على الخانة لتسجيل تاريخ حضور الموظف.', w ? '<button class="btn pri" data-x="stnew">إضافة موظف</button><button class="btn" data-x="conew">إضافة دورة</button>' : '');
    h += '<div class="tiles"><div class="tile"><b class="num">' + st.length + '</b><span>موظف</span></div><div class="tile"><b class="num">' + cs.length + '</b><span>دورة</span></div><div class="tile"><b class="num">' + done + '</b><span>حضور مسجل</span></div><div class="tile"><b class="num">' + (st.length ? Math.round(done * 100 / Math.max(1, done + gaps)) : 0) + '%</b><span>نسبة التغطية</span></div></div>';
    h += '<details class="sec"><summary><span class="t">الدورات</span><small class="num">' + cs.length + '</small></summary><div class="tblw" style="border:0"><table><tbody>' + cs.map(function (c, i) { return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(c.t) + '</td><td>' + esc(c.who) + '</td><td>' + esc(c.month) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    if (!st.length) return h + '<p class="empty">أضف الموظفين لتظهر المصفوفة.</p>';
    return h + '<div class="tblw"><table class="trm"><thead><tr><th>الموظف</th><th>الوظيفة</th>' + cs.map(function (c, i) { return '<th title="' + esc(c.t) + '" class="num">' + (i + 1) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' + st.map(function (s) { return '<tr><td>' + esc(s.name) + '</td><td>' + esc(s.job || '') + '</td>' + cs.map(function (c) { var d = (s.tr || {})[c.id]; return '<td class="num" title="' + esc(c.t) + '">' + (w ? '<button class="trc ' + (d ? 'on' : '') + '" data-x="trc" data-id="' + esc(s.id) + '" data-c="' + esc(c.id) + '">' + (d ? '✓' : '·') + '</button>' : (d ? '✓' : '')) + '</td>'; }).join('') + '<td>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="staff" data-id="' + esc(s.id) + '" data-label="' + esc(s.name) + '">حذف</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---- KPI board ---- */
  function lastMonths(n) { var out = [], d = new Date(CY, CM - 1, 1); for (var i = 0; i < n; i++) { out.unshift(d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2)); d.setMonth(d.getMonth() - 1); } return out; }
  function bars(ttl, ms, vals, unit, target) { var mx = Math.max.apply(null, vals.concat([target || 0, 1])); return '<div class="kc"><h3>' + esc(ttl) + '</h3><div class="kb">' + ms.map(function (m, i) { var v = vals[i]; return '<div class="kcol"><span class="num">' + (v == null ? '' : (Math.round(v * 100) / 100).toLocaleString('en-US')) + '</span><i style="height:' + (v ? Math.max(3, Math.round(v * 110 / mx)) : 0) + 'px' + (target != null && v != null && v < target ? ';background:var(--warn)' : '') + '"></i><small>' + MONTHS[+m.slice(5) - 1] + '</small></div>'; }).join('') + '</div><small style="color:var(--muted)">' + esc(unit || '') + (target != null ? ' · المستهدف ' + target : '') + '</small></div>'; }
  function vKpi() {
    var ms = lastMonths(6), w = canWrite(), inM = function (d, m) { return String(d || '').slice(0, 7) === m; };
    var h = head('مؤشرات الأداء', 'تُحسب من البيانات المسجلة فعلًا في النظام، مع مؤشرات تدخلها شهريًا.', w ? '<button class="btn pri" data-x="kpnew">إدخال مؤشر شهري</button>' : '');
    var closed = function (m) { return S.ord.filter(function (o) { return o.closed && inM(o.closedAt, m); }); };
    h += '<div class="kgrid">' + bars('التسليم في الموعد', ms, ms.map(function (m) { var c = closed(m), d = c.filter(function (o) { return o.due; }); return d.length ? d.filter(function (o) { return String(o.closedAt).slice(0, 10) <= o.due; }).length * 100 / d.length : null; }), '% من الأوامر المسلَّمة', 100) +
      bars('أوامر إنتاج مسلَّمة', ms, ms.map(function (m) { return closed(m).length; }), 'أمر') +
      bars('حالات عدم المطابقة', ms, ms.map(function (m) { return S.ncr.filter(function (n) { return inM(n.date, m); }).length; }), 'حالة') +
      bars('قيمة المشتريات', ms, ms.map(function (m) { return S.pur.filter(function (p) { return inM(p.date, m); }).reduce(function (a, p) { return a + (+p.value || 0); }, 0); }), 'ج.م') +
      bars('الشراء من موردين معتمدين', ms, ms.map(function (m) { var l = S.pur.filter(function (p) { return inM(p.date, m); }); return l.length ? l.filter(supOk).length * 100 / l.length : null; }), '% من البنود', 100) +
      bars('سجلات مؤرشفة', ms, ms.map(function (m) { return S.arch.filter(function (a) { return a.y + '-' + ('0' + a.m).slice(-2) === m; }).length; }), 'سجل') +
      bars('شكاوى العملاء', ms, ms.map(function (m) { return S.x.complaints.filter(function (c) { return inM(c.date, m); }).length; }), 'شكوى') +
      bars('رضا العملاء', ms, ms.map(function (m) { var l = S.x.csat.filter(function (c) { return inM(c.date, m); }); return l.length ? l.reduce(function (a, c) { return a + (+c.overall || 0); }, 0) / l.length : null; }), 'من 5', 4);
    var names = {}; S.kpi.forEach(function (k) { names[k.kn] = k; });
    Object.keys(names).sort().forEach(function (n) { h += bars(n, ms, ms.map(function (m) { var e = S.kpi.filter(function (k) { return k.kn === n && k.month === m; })[0]; return e ? +e.value : null; }), names[n].unit || '', names[n].target === '' || names[n].target == null ? null : +names[n].target); });
    h += '</div>';
    if (S.kpi.length) h += '<details class="sec"><summary><span class="t">المؤشرات المدخلة يدويًا</span><small class="num">' + S.kpi.length + '</small></summary><div class="tblw" style="border:0"><table><tbody>' + S.kpi.slice().sort(function (a, b) { return String(b.month).localeCompare(String(a.month)); }).map(function (k) { return '<tr><td>' + esc(k.kn) + '</td><td class="num">' + esc(k.month) + '</td><td class="num">' + esc(k.value) + ' ' + esc(k.unit || '') + '</td><td>' + (canAdmin() ? '<button class="btn danger" data-act="del" data-kind="kpi" data-id="' + esc(k.id) + '" data-label="' + esc(k.kn + ' ' + k.month) + '">حذف</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    return h + '<div class="note">الأعمدة الفارغة معناها أنه لا توجد بيانات مسجلة لذلك الشهر. مؤشرات مثل الفاقد ونسبة المرفوضات تُدخل يدويًا من سجلاتكم.</div>';
  }

  /* ---- backup ---- */
  var BK = ['archive', 'na', 'formcfg', 'findings', 'expiry', 'roles', 'versions', 'purchases', 'suppliers', 'supfiles', 'cycles', 'orders', 'names', 'ncr', 'equip', 'staff', 'courses', 'kpi', 'notes', 'log', 'users', 'lib'];
  function backup(withFiles) {
    var st = $('bkp-s'), fsdb = window.firebase && firebase.firestore && firebase.firestore(), out = {}, i = 0;
    if (!fsdb || !fsdb.collection) { st.textContent = 'النسخ الاحتياطي يعمل مع قاعدة البيانات فقط.'; return; }
    (function next() {
      if (i >= BK.length) return files();
      var n = BK[i++]; st.textContent = 'جارٍ قراءة ' + n + '…';
      fsdb.collection(n).get().then(function (s) { out[n] = s.docs.map(function (d) { var o = d.data(); o._id = d.id; return o; }); next(); }).catch(function () { out[n] = []; next(); });
    })();
    function files() {
      var zip = new JSZip(), list = []; zip.file('data.json', JSON.stringify(out, null, 1));
      if (withFiles) ['archive', 'versions', 'supfiles'].forEach(function (c) { (out[c] || []).forEach(function (a) { if (a.asset) list.push({ c: c, a: a }); }); });
      var k = 0;
      (function nf() {
        if (k >= list.length) { st.textContent = 'جارٍ ضغط الملف…'; return zip.generateAsync({ type: 'blob' }).then(function (b) { st.textContent = 'اكتملت النسخة: ' + Object.keys(out).reduce(function (a, n) { return a + out[n].length; }, 0) + ' سجل' + (withFiles ? ' و' + list.length + ' ملف.' : '.'); return save('GEM-backup-' + today() + '.zip', b, 'نزلت النسخة الاحتياطية.'); }); }
        var it = list[k++]; st.textContent = 'جارٍ تنزيل الملف ' + k + ' من ' + list.length + '…';
        S.cap.assets.get(it.a.asset, it.a.ct).then(function (b) { zip.file('files/' + it.c + '/' + it.a._id + ' - ' + String(it.a.name || 'file').replace(/[\\\/:*?"<>|]/g, '_'), b); nf(); }).catch(function () { nf(); });
      })();
    }
  }
  function vLibrary2() { var h = vLibrary(); if (!canAdmin()) return h; return h + '<div class="find l"><h3>نسخة احتياطية</h3><p>تنزّل كل بيانات النظام في ملف واحد على جهازك. احتفظ بنسخة كل أسبوع.</p><div class="acts" style="justify-content:flex-start"><button class="btn pri" data-x="bkp" data-id="0">البيانات فقط</button><button class="btn" data-x="bkp" data-id="1">البيانات وملفات الأرشيف</button></div><div id="bkp-s" class="num" style="color:var(--muted);min-height:1.4em"></div></div>'; }

  /* ---- users: job, contacts, auditor accounts ---- */
  function vAccess2() {
    var h = vAccess0(); if (!canAdmin()) return h;
    var us = (FBG().users || []).filter(function (u) { return !u.replaced; }).sort(function (p, q) { return String(p.username).localeCompare(String(q.username)); });
    h += '<h2 style="font-size:17px">وظيفة كل مستخدم وبيانات التواصل</h2><div class="tblw"><table><thead><tr><th>المستخدم</th><th>الوظيفة (تحدد ما يظهر له في «شغلي» وإشعاراته)</th><th>رقم الواتساب</th><th>الإيميل</th><th>النوع</th><th>الأقسام المسموح بها (بدون اختيار = الكل)</th></tr></thead><tbody>' + (us.map(function (u) { return '<tr><td>' + esc(u.name || u.username) + '</td><td>' + jobSel('', u.job || '', 'data-chg="ujob" data-u="' + esc(u.uid) + '"') + '</td><td><input class="mini" dir="ltr" value="' + esc(u.phone || '') + '" placeholder="01xxxxxxxxx" data-chg="uphone" data-u="' + esc(u.uid) + '"></td><td><input class="mini" dir="ltr" value="' + esc(u.mail || '') + '" data-chg="umail" data-u="' + esc(u.uid) + '"></td><td>' + (u.role === 'auditor' ? '<span class="pill warn">مراجع للقراءة فقط' + (u.until ? ' حتى ' + esc(fmtDate(u.until)) : '') + '</span>' : u.role === 'admin' ? 'مسؤول' : 'مستخدم') + '</td><td>' + DEPTS.map(function (d) { var on = (u.depts || []).indexOf(d.k) >= 0; return '<button class="btn' + (on ? ' pri' : '') + '" style="padding:2px 8px;font-size:12px;margin:1px" data-x="udept" data-u="' + esc(u.uid) + '" data-d="' + esc(d.k) + '">' + esc(d.k) + '</button>'; }).join('') + '</td></tr>'; }).join('') || '<tr><td colspan="6">لا يوجد مستخدمون.</td></tr>') + '</tbody></table></div>';
    h += '<div class="find l"><h3>حساب مراجع مؤقت</h3><p>حساب للقراءة فقط، لا يرفع ولا يعدّل ولا يحذف، ويتوقف تلقائيًا بعد التاريخ المحدد.</p><div class="track"><label>اسم المستخدم<input class="mini" id="au-u" dir="ltr" maxlength="30" placeholder="auditor"></label><label>الاسم<input class="mini" id="au-n" maxlength="60"></label><label>كلمة المرور<input class="mini" id="au-p" dir="ltr" maxlength="40"></label><label>ينتهي في<input class="mini" id="au-d" type="date"></label><button class="btn pri" data-x="auadd" style="align-self:flex-end">إنشاء</button></div></div>';
    return h;
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id, g = function (i) { return $(i) ? ($(i).value || '').trim() : ''; }, db = S.cap.db;
    if (x === 'sgok') signGo(b);
    else if (x === 'gobatch') { S.bq = id; }
    else if (x === 'ntread') { try { localStorage.setItem('gem-read', new Date().toISOString()); } catch (e) { } render(); }
    else if (x === 'ordone2') {
      var o = S.ord.filter(function (y) { return y.id === id; })[0], ps = procs(), p = ps.filter(function (y) { return y.n === b.dataset.p; })[0]; if (!o || !p) return;
      var miss = p.c.filter(function (c) { return S.byCode[c] && !ordRecs(o, p, c).length; }), nx = ps[ps.indexOf(p) + 1];
      askSign('إتمام ' + p.n + ' ' + esc(p.t), (miss.length ? '<div class="note">ناقص ' + miss.length + ' سجل لم يُرفع لهذا الأمر: ' + miss.map(function (c) { return '<span class="code">' + c + '</span>'; }).join(' ') + '<br>إن أكملت تُسجَّل الخطوة «تمت مع نقص».</div>' : '') + '<div>' + (nx ? 'ينتقل الأمر إلى: <b>' + esc(nx.o) + '</b> (' + nx.n + ' ' + esc(nx.t) + ')' : 'آخر خطوة: يُقفل الأمر بعد التسليم للعميل.') + '</div>', function (note) {
        o.steps = o.steps || {}; o.steps[p.n] = { at: new Date().toISOString(), by: meName(), note: note, miss: miss, sig: true }; if (!nx) { o.closed = true; o.locked = true; o.closedAt = new Date().toISOString(); }
        ordSave(o); render();
        if (nx) { var txt = 'أمر إنتاج ' + o.no + ' (' + o.cust + ') وصل عندك: ' + nx.n + ' ' + nx.t; notify(nx.o, txt, 'order-' + o.id); var c = contacts(nx.o, txt + '\n' + location.href.split('#')[0] + '#order-' + o.id); dlg('<h2>انتقل الأمر</h2><p>الأمر الآن عند <b>' + esc(nx.o) + '</b>، ووصله إشعار داخل النظام.</p>' + (c ? '<p>لإبلاغه فورًا:</p><div class="acts" style="justify-content:flex-start">' + c + '</div>' : '<p style="color:var(--muted)">لإرسال واتساب أو إيميل بضغطة، سجّل وظيفة ورقم المستخدم في صفحة «المستخدمون».</p>') + '<div class="acts"><button class="btn pri" data-act="closed">تم</button></div>'); }
        else toast('اكتمل الأمر وسُلِّم للعميل.', 6000);
      });
    }
    else if (x === 'vok2') { var v = (S.vers || []).filter(function (y) { return y.id === id; })[0]; if (!v) return; askSign('اعتماد الإصدار', '<div>' + esc(v.name) + '</div>', function (note) { var c = {}; for (var k in v) if (k !== 'id') c[k] = v[k]; c.st = 'approved'; c.approvedAt = new Date().toISOString(); c.approvedBy = meName(); c.sig = true; c.locked = true; if (note) c.approveNote = note; db.doc('versions/' + id).set(c).then(function () { toast('اعتُمد الإصدار وأصبح الإصدار الحالي.'); }).catch(function () { toast('تعذر الاعتماد.'); }); }); }
    else if (x === 'orbatch') { var ob = S.ord.filter(function (y) { return y.id === id; })[0]; if (!ob) return; var bc = window.prompt('كود التشغيلة لهذا الأمر (مثال: GE-201126-999.9A)', ob.batch || ''); if (bc == null) return; ob.batch = bc.trim(); ordSave(ob, 'حُفظ كود التشغيلة.'); render(); }
    else if (x === 'orncr') { var on = S.ord.filter(function (y) { return y.id === id; })[0]; if (on) ncDialog('', { src: 'أمر إنتاج', ref: on.no + (on.batch ? ' / ' + on.batch : '') }); }
    else if (x === 'fos') { var r = S.byId[id]; if (r) openFos(r); }
    else if (x === 'fosrow' && fosCur) { fosCur.rows[+id] += 5; drawFos(true); }
    else if (x === 'fosdl' && fosCur) { toast('جارٍ تجهيز الملف…', 20000); fosBuild().then(function (o) { return save(o.name, o.blob, 'نزل النموذج المملوء.'); }).catch(function () { toast('تعذر تجهيز الملف.'); }); }
    else if (x === 'fosar' && fosCur) { var rr = fosCur.r; toast('جارٍ الحفظ في الأرشيف…', 20000); fosBuild().then(function (o) { return storeFile(new File([o.blob], o.name, { type: o.blob.type })).then(function (res) { return db.collection('archive').add({ doc: rr.i, code: rr.c || '', d: rr.d, y: +o.dt.slice(0, 4), m: +o.dt.slice(5, 7), rd: o.dt, no: '', asset: res.asset, name: res.name, ct: res.ct, size: res.size, note: 'مُلئ على الشاشة', at: new Date().toISOString(), by: S.cap.uid }); }); }).then(function () { vClose(); fosCur = null; toast('حُفظ النموذج المملوء في أرشيف ' + rr.d + '.', 6000); }).catch(function () { toast('تعذر الحفظ.'); }); }
    else if (x === 'ncnew') ncDialog(''); else if (x === 'ncedit') ncDialog(id);
    else if (x === 'ncsave') { var old = id && S.ncr.filter(function (y) { return y.id === id; })[0], n = { no: b.dataset.no, name: b.dataset.no, date: g('nc-d'), src: g('nc-s'), ref: g('nc-r'), desc: g('nc-x'), cause: g('nc-c'), action: g('nc-a'), owner: g('nc-o'), due: g('nc-u'), st: g('nc-t'), at: new Date().toISOString(), by: meName() }; if (!n.date || !n.desc) { $('nc-m').textContent = 'التاريخ والوصف مطلوبان.'; return; } (id ? db.doc('ncr/' + id).set(n) : db.collection('ncr').add(n)).then(function () { closeDlg(); toast('حُفظت الحالة.'); if (n.owner && (!old || old.owner !== n.owner)) notify(n.owner, 'عدم مطابقة ' + n.no + ' مسؤوليتك: ' + n.desc, 'ncr'); }).catch(function () { $('nc-m').textContent = 'تعذر الحفظ.'; }); }
    else if (x === 'ncclose') { var nn = S.ncr.filter(function (y) { return y.id === id; })[0]; if (!nn) return; if (!nn.cause || !nn.action) { toast('اكتب السبب الجذري والإجراء التصحيحي أولًا من «تعديل».', 6000); return; } askSign('إغلاق ' + esc(nn.no) + ' بعد التحقق من الفعالية', '<div>' + esc(nn.desc) + '</div><p style="margin:0;color:var(--muted);font-size:13px">اكتب في الملاحظة كيف تحققت من أن الإجراء منع تكرار المشكلة.</p>', function (note) { if (!note) { toast('اكتب نتيجة التحقق من الفعالية. لم تُغلق الحالة.', 6000); return; } var c = {}; for (var k in nn) if (k !== 'id') c[k] = nn[k]; c.st = 'مغلقة'; c.locked = true; c.verify = note; c.closedAt = new Date().toISOString(); c.closedBy = meName(); c.sig = true; db.doc('ncr/' + id).set(c).then(function () { toast('أُغلقت الحالة.'); }).catch(function () { toast('تعذر الحفظ.'); }); }); }
    else if (x === 'eqnew') eqDialog(''); else if (x === 'eqedit') eqDialog(id);
    else if (x === 'eqsave') { var code = g('eq-c'); if (!code || !g('eq-n')) { $('eq-m').textContent = 'الكود والاسم مطلوبان.'; return; } db.doc('equip/' + code.replace(/\//g, '-')).set({ name: g('eq-n'), st: g('eq-s'), last: g('eq-l'), next: g('eq-x'), pmLast: g('eq-pl'), pmNext: g('eq-pn'), note: g('eq-o'), at: new Date().toISOString(), by: meName() }).then(function () { closeDlg(); toast('حُفظت بيانات المعدة.'); }).catch(function () { $('eq-m').textContent = 'تعذر الحفظ.'; }); }
    else if (x === 'stnew') dlg('<h2>إضافة موظف</h2><label>الاسم<input id="st-n" type="text" maxlength="80"></label><label>الوظيفة<input id="st-j" type="text" maxlength="80"></label><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="stsave">حفظ</button></div>');
    else if (x === 'stsave') { if (!g('st-n')) return; db.collection('staff').add({ name: g('st-n'), job: g('st-j'), tr: {}, at: new Date().toISOString() }).then(function () { closeDlg(); toast('أُضيف الموظف.'); }); }
    else if (x === 'conew') dlg('<h2>إضافة دورة</h2><label>موضوع التدريب<input id="co-t" type="text" maxlength="160"></label><label>الفئة المستهدفة<input id="co-w" type="text" maxlength="100"></label><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="cosave">حفظ</button></div>');
    else if (x === 'cosave') { if (!g('co-t')) return; db.collection('courses').add({ t: g('co-t'), name: g('co-t'), who: g('co-w'), at: new Date().toISOString() }).then(function () { closeDlg(); toast('أُضيفت الدورة.'); }); }
    else if (x === 'trc') { var s = S.staff.filter(function (y) { return y.id === id; })[0], cid = b.dataset.c; if (!s) return; var cur = (s.tr || {})[cid], d = window.prompt(cur ? 'تاريخ الحضور المسجل. امسحه واضغط موافق لإلغائه.' : 'تاريخ حضور الدورة (سنة-شهر-يوم)', cur || today()); if (d == null) return; d = d.trim(); if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast('اكتب التاريخ بصيغة 2026-11-26.'); return; } var c2 = {}; for (var k2 in s) if (k2 !== 'id') c2[k2] = s[k2]; c2.tr = c2.tr || {}; if (d) c2.tr[cid] = d; else delete c2.tr[cid]; db.doc('staff/' + id).set(c2); }
    else if (x === 'kpnew') { var nm = {}; S.kpi.forEach(function (k) { nm[k.kn] = 1; }); dlg('<h2>إدخال مؤشر شهري</h2><label>اسم المؤشر<input id="kp-n" type="text" list="kp-l" maxlength="80" placeholder="مثال: فاقد الصهر"><datalist id="kp-l">' + Object.keys(nm).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist></label><div class="two"><label>الشهر<input id="kp-m" type="month" value="' + CY + '-' + ('0' + CM).slice(-2) + '"></label><label>القيمة<input id="kp-v" type="number" step="any"></label></div><div class="two"><label>الوحدة<input id="kp-u" type="text" placeholder="جم لكل كجم"></label><label>المستهدف (اختياري)<input id="kp-t" type="number" step="any"></label></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="kpsave">حفظ</button></div>'); }
    else if (x === 'kpsave') { if (!g('kp-n') || !g('kp-m') || g('kp-v') === '') { toast('الاسم والشهر والقيمة مطلوبة.'); return; } db.collection('kpi').add({ kn: g('kp-n'), name: g('kp-n'), month: g('kp-m'), value: +g('kp-v'), unit: g('kp-u'), target: g('kp-t'), at: new Date().toISOString(), by: meName() }).then(function () { closeDlg(); toast('حُفظ المؤشر.'); }); }
    else if (x === 'bkp') backup(id === '1');
    else if (x === 'auadd') { var F = FBG(), u = g('au-u').toLowerCase(), pw = $('au-p').value || '', dt = g('au-d'); if (!/^[a-z0-9._-]{3,30}$/.test(u)) { toast('اسم المستخدم: حروف إنجليزية وأرقام، 3 على الأقل.'); return; } if (pw.length < 6) { toast('كلمة المرور 6 حروف على الأقل.'); return; } if (!dt || dt < today()) { toast('اختر تاريخ انتهاء قادم.'); return; } b.disabled = true; F.addUser(u, g('au-n') || 'مراجع', pw, 'auditor', { until: dt, untilTs: F.ts(dt) }).then(function () { toast('أُنشئ حساب المراجع، ويتوقف بعد ' + fmtDate(dt) + '.', 7000); }).catch(function (e) { b.disabled = false; toast(/in-use/.test((e && e.code) || '') ? 'اسم المستخدم مستخدم من قبل.' : 'تعذر إنشاء الحساب. تأكد من نشر القواعد الجديدة.', 7000); }); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.dataset && t.dataset.chg, F = FBG(); if (!c) return;
    if (c === 'myjob') { try { localStorage.setItem('gem-job', t.value); } catch (e) { } render(); }
    else if (c === 'ef') { S.ef = t.value; render(); }
    else if (c === 'bq') { S.bq = t.value; t.blur(); setTimeout(render, 30); }
    else if (c === 'ujob' && F.setUser) F.setUser(t.dataset.u, { job: t.value }).then(function () { toast('حُفظت الوظيفة.'); });
    else if (c === 'uphone' && F.setUser) F.setUser(t.dataset.u, { phone: t.value.trim() }).then(function () { toast('حُفظ الرقم.'); });
    else if (c === 'umail' && F.setUser) F.setUser(t.dataset.u, { mail: t.value.trim() }).then(function () { toast('حُفظ الإيميل.'); });
  });


  /* ================= permissions, locks, internal audit, management review, risks, customers, supplier performance, stock, QR, search, mobile ================= */
  var XC = ['audits', 'mreviews', 'risks', 'complaints', 'csat', 'supeval', 'moves']; S.x = {}; XC.forEach(function (n) { S.x[n] = []; });
  (function () { var t = setInterval(function () { var db = S.cap.db; if (!db) return; clearInterval(t); XC.forEach(function (n) { db.collection(n).onSnapshot(function (s) { S.x[n] = s.docs.map(function (d) { var o = d.data() || {}, c = {}; for (var k in o) c[k] = o[k]; c.id = d.id; return c; }).sort(function (a, b) { return String(b.date || b.at).localeCompare(String(a.date || a.at)); }); render(); }, function () { }); }); }, 800); })();
  function cp(o) { var c = {}; for (var k in o) if (k !== 'id') c[k] = o[k]; return c; }
  function seq(list, pre) { var mx = 0; list.forEach(function (x) { var m = new RegExp('^' + pre + '-(\\d{4})-(\\d+)$').exec(x.no || ''); if (m && +m[1] === CY) mx = Math.max(mx, +m[2]); }); return pre + '-' + CY + '-' + ('00' + (mx + 1)).slice(-3); }
  function fDlg(ttl, fields, o, saveX, id, extra) {
    dlg('<h2>' + ttl + '</h2>' + fields.map(function (f) {
      var v = o[f.k] == null ? (f.d == null ? '' : f.d) : o[f.k];
      if (f.t === 'select') return '<label>' + f.l + '<select id="fd-' + f.k + '">' + f.o.map(function (x) { return '<option' + (String(v) === String(x) ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>';
      if (f.t === 'job') return '<label>' + f.l + jobSel('fd-' + f.k, v) + '</label>';
      if (f.t === 'dept') return '<label>' + f.l + '<select id="fd-' + f.k + '"><option value=""></option>' + DEPTS.map(function (d) { return '<option' + (v === d.k ? ' selected' : '') + '>' + esc(d.k) + '</option>'; }).join('') + '</select></label>';
      if (f.t === 'area') return '<label>' + f.l + '<textarea id="fd-' + f.k + '" rows="' + (f.r || 3) + '" style="font:inherit;padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:inherit">' + esc(v) + '</textarea></label>';
      return '<label>' + f.l + '<input id="fd-' + f.k + '" type="' + (f.t || 'text') + '" value="' + esc(v) + '"' + (f.t === 'number' ? ' step="any"' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '></label>';
    }).join('') + (extra || '') + '<div id="fd-m" style="color:var(--bad);min-height:1.4em"></div><div class="acts"><button class="btn" data-act="closed">إلغاء</button><button class="btn pri" data-x="' + saveX + '" data-id="' + esc(id || '') + '">حفظ</button></div>');
  }
  function fRead(fields) { var o = {}; fields.forEach(function (f) { var e = $('fd-' + f.k); o[f.k] = e ? (f.t === 'number' ? (e.value === '' ? '' : +e.value) : e.value.trim()) : ''; }); return o; }
  function fSave(coll, id, o, need) { for (var i = 0; i < (need || []).length; i++) if (o[need[i]] === '' || o[need[i]] == null) { $('fd-m').textContent = 'أكمل الخانات المطلوبة.'; return Promise.reject(); } o.at = new Date().toISOString(); o.by = meName(); return (id ? S.cap.db.doc(coll + '/' + id).set(o) : S.cap.db.collection(coll).add(o)).then(function (r) { closeDlg(); toast('تم الحفظ.'); return r; }, function () { $('fd-m').textContent = 'تعذر الحفظ. قد يكون السجل مقفلًا أو خارج صلاحيتك.'; }); }
  function delBtn(coll, x, label) { return canAdmin() && !x.locked ? '<button class="btn danger" data-act="del" data-kind="' + coll + '" data-id="' + esc(x.id) + '" data-label="' + esc(label) + '">حذف</button>' : ''; }
  function formPills(codes) { return codes.map(function (c) { var r = S.byCode[c]; return r ? '<a href="#doc-' + r.i + '"><span class="code">' + c + '</span> ' + esc(title(r)) + '</a>' : ''; }).filter(Boolean).join(' · '); }
  function lockPill(x) { return x.locked ? ' <span class="pill" title="موقّع ومقفل">🔒 مقفل</span>' : ''; }

  /* ---- department permissions ---- */
  function myDeptsX() { var m = FBG().me; return (m && m.depts) || []; }
  function deptAllowed(d) { var l = myDeptsX(); return S.cap.canEdit || !l.length || l.indexOf(d) >= 0; }
  function canWriteDept(d) { return !S.auditor && !!S.cap.db && deptAllowed(d); }
  function canUp(r) { return !S.auditor && !!S.cap.db && !!S.cap.assets && (!r || deptAllowed(r.d)); }

  /* ---- internal audit ---- */
  var ARES = ['لم يُراجع', 'مطابق', 'ملاحظة', 'عدم مطابقة'];
  function vAudits() {
    var w = canWrite(), l = S.x.audits, cur = l.filter(function (a) { return a.id === S.au; })[0];
    if (cur) return vAudit(cur);
    var h = head('التدقيق الداخلي', 'قائمة فحص لكل بند من ISO 9001، وتسجيل النتيجة والدليل، وتحويل عدم المطابقة لإجراء تصحيحي (بند 9.2).', w ? '<button class="btn pri" data-x="aunew">تدقيق جديد</button>' : '');
    h += '<div class="note">النماذج الرسمية: ' + formPills(['GEM-QA-F-9.2-01', 'GEM-QA-F-9.2-02', 'GEM-QA-F-9.2-03']) + '</div>';
    if (!l.length) return h + '<p class="empty">لا يوجد تدقيق مسجل.</p>';
    return h + '<div class="tblw"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>النطاق</th><th>المدقق</th><th>مطابق</th><th>ملاحظة</th><th>عدم مطابقة</th><th>لم يُراجع</th><th></th></tr></thead><tbody>' + l.map(function (a) { var c = function (r) { return (a.items || []).filter(function (i) { return (i.res || ARES[0]) === r; }).length; }; return '<tr><td><span class="code">' + esc(a.no) + '</span>' + lockPill(a) + '</td><td class="num">' + esc(fmtDate(a.date)) + '</td><td>' + esc(a.scope || 'كل الأقسام') + '</td><td>' + esc(a.auditor) + '</td><td class="num">' + c(ARES[1]) + '</td><td class="num">' + c(ARES[2]) + '</td><td class="num">' + c(ARES[3]) + '</td><td class="num">' + c(ARES[0]) + '</td><td><div class="acts"><button class="btn pri" data-x="auopen" data-id="' + esc(a.id) + '">فتح</button>' + delBtn('audits', a, a.no) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function vAudit(a) {
    var w = canWrite() && !a.locked, items = a.items || [];
    var h = head('تدقيق <span class="code">' + esc(a.no) + '</span>' + lockPill(a), esc(fmtDate(a.date)) + ' · ' + esc(a.scope || 'كل الأقسام') + ' · المدقق: ' + esc(a.auditor) + ' · <a href="#audits" data-x="auback">رجوع</a>', '<button class="btn noprint" data-x="print">طباعة</button>' + (w ? '<button class="btn pri noprint" data-x="auclose" data-id="' + esc(a.id) + '">اعتماد وإقفال التدقيق</button>' : ''));
    h += '<div class="tblw"><table><thead><tr><th>البند</th><th>المطلوب التحقق منه</th><th>الإجراء</th><th>النتيجة</th><th>الدليل أو الملاحظة</th><th></th></tr></thead><tbody>' + items.map(function (it, i) { return '<tr><td class="num">' + esc(it.cl) + '</td><td>' + esc(it.q) + '</td><td>' + (it.p || []).map(function (c) { var r = S.byCode[c]; return r ? '<a href="#doc-' + r.i + '"><span class="code">' + esc(c) + '</span></a>' : ''; }).join(' ') + '</td><td>' + (w ? '<select class="mini" data-chg="aures" data-i="' + i + '">' + ARES.map(function (r) { return '<option' + ((it.res || ARES[0]) === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>' : '<span class="pill ' + (it.res === ARES[1] ? 'good' : it.res === ARES[3] ? 'bad' : it.res === ARES[2] ? 'warn' : '') + '">' + esc(it.res || ARES[0]) + '</span>') + '</td><td>' + (w ? '<input class="mini" style="width:100%;min-width:180px" value="' + esc(it.ev || '') + '" data-chg="auev" data-i="' + i + '">' : esc(it.ev || '')) + '</td><td>' + (it.res === ARES[3] ? (it.ncr ? '<span class="code">' + esc(it.ncr) + '</span>' : (canWrite() ? '<button class="btn" data-x="auncr" data-id="' + i + '">حوّلها لعدم مطابقة</button>' : '')) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }
  function auSave(a) { return S.cap.db.doc('audits/' + a.id).set(cp(a)).catch(function () { toast('تعذر الحفظ.'); }); }

  /* ---- management review ---- */
  function mrSnap() {
    var st = DEPTS.map(function (d) { return deptStats(d.k); }), al = alertData(), ms = lastMonths(3), au = S.x.audits[0], cs = S.x.csat, avg = cs.length ? (cs.reduce(function (a, c) { return a + (+c.overall || 0); }, 0) / cs.length).toFixed(1) : '—', cl = S.ord.filter(function (o) { return o.closed && o.due; });
    return [
      ['جاهزية النظام', Math.round(st.reduce(function (a, s) { return a + s.score; }, 0) / st.length) + '% · نماذج بلا سجل خلال الشهر: ' + al.forms.length],
      ['نتائج التدقيق', au ? au.no + ' بتاريخ ' + fmtDate(au.date) + ': عدم مطابقة ' + (au.items || []).filter(function (i) { return i.res === ARES[3]; }).length + '، ملاحظات ' + (au.items || []).filter(function (i) { return i.res === ARES[2]; }).length : 'لا يوجد تدقيق مسجل'],
      ['عدم المطابقة والإجراءات التصحيحية', 'مفتوحة ' + S.ncr.filter(function (n) { return n.st !== 'مغلقة'; }).length + ' · مغلقة ' + S.ncr.filter(function (n) { return n.st === 'مغلقة'; }).length + ' · متأخرة ' + al.nc.length],
      ['رضا العملاء والشكاوى', 'متوسط الرضا ' + avg + ' من 5 (' + cs.length + ' تقييم) · شكاوى مفتوحة ' + S.x.complaints.filter(function (c) { return c.st !== 'مغلقة'; }).length + ' من ' + S.x.complaints.length],
      ['التسليم في الموعد', cl.length ? Math.round(cl.filter(function (o) { return String(o.closedAt).slice(0, 10) <= o.due; }).length * 100 / cl.length) + '% من ' + cl.length + ' أمر مسلَّم · أوامر مفتوحة ' + S.ord.filter(function (o) { return !o.closed; }).length : 'لا توجد أوامر مسلَّمة بعد'],
      ['أداء الموردين', 'بنود شراء آخر 3 شهور: ' + S.pur.filter(function (p) { return ms.indexOf(ym(p.date)) >= 0; }).length + ' · من مورد غير معتمد: ' + S.pur.filter(function (p) { return ms.indexOf(ym(p.date)) >= 0 && !supOk(p); }).length],
      ['المخاطر والفرص', 'مسجل ' + S.x.risks.length + ' · عالية ' + S.x.risks.filter(function (r) { return r.like * r.sev >= 15 && r.st !== 'مغلق'; }).length],
      ['الموارد: المعايرة والصيانة والتدريب', 'مستحق خلال 30 يومًا: ' + al.eq.length + ' معدة · موظفون في مصفوفة التدريب: ' + S.staff.length],
      ['ملاحظات المراجعة الوثائقية', 'لم تُغلق ' + allFindings().filter(function (f) { return fState(f) !== 'done'; }).length + ' من ' + allFindings().length]
    ];
  }
  function vMr() {
    var w = canWrite(), l = S.x.mreviews, cur = l.filter(function (m) { return m.id === S.mr; })[0];
    if (cur) {
      var h2 = head('محضر مراجعة الإدارة <span class="code">' + esc(cur.no) + '</span>' + lockPill(cur), esc(fmtDate(cur.date)) + ' · <a href="#mr" data-x="mrback">رجوع</a>', '<button class="btn noprint" data-x="print">طباعة</button>' + (w && !cur.locked ? '<button class="btn pri noprint" data-x="mrsign" data-id="' + esc(cur.id) + '">اعتماد وإقفال المحضر</button>' : ''));
      h2 += '<div class="find l"><div><b>الحاضرون:</b> ' + esc(cur.att || '') + '</div><div><b>متابعة قرارات المراجعة السابقة:</b> ' + esc(cur.prev || '—') + '</div></div><h2 style="font-size:17px">مدخلات المراجعة (بند 9.3.2) كما كانت يوم الاجتماع</h2><div class="tblw"><table><tbody>' + (cur.snap || []).map(function (s) { return '<tr><td><b>' + esc(s[0]) + '</b></td><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</tbody></table></div><h2 style="font-size:17px">القرارات والإجراءات (بند 9.3.3)</h2><div class="tblw"><table><tbody>' + String(cur.dec || '').split('\n').filter(Boolean).map(function (d, i) { return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(d) + '</td></tr>'; }).join('') + '</tbody></table></div>' + (cur.locked ? '<p style="color:var(--muted)">اعتمده إلكترونيًا: ' + esc(cur.signedBy || '') + ' · ' + esc(fmtDate(cur.signedAt)) + '</p>' : '');
      return h2;
    }
    var h = head('مراجعة الإدارة', 'المحضر يجمع مدخلاته من بيانات النظام وقت الاجتماع، وتضيف الحاضرين والقرارات (بند 9.3).', w ? '<button class="btn pri" data-x="mrnew">محضر جديد</button>' : '');
    h += '<div class="note">النماذج الرسمية: ' + formPills(['GEM-QA-F-9.3-01', 'GEM-QA-F-9.3-02']) + '</div><h2 style="font-size:17px">المدخلات الآن</h2><div class="tblw"><table><tbody>' + mrSnap().map(function (s) { return '<tr><td><b>' + esc(s[0]) + '</b></td><td>' + esc(s[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (l.length) h += '<h2 style="font-size:17px">المحاضر</h2><div class="tblw"><table><tbody>' + l.map(function (m) { return '<tr><td><span class="code">' + esc(m.no) + '</span>' + lockPill(m) + '</td><td class="num">' + esc(fmtDate(m.date)) + '</td><td>' + esc(m.att || '') + '</td><td><div class="acts"><button class="btn pri" data-x="mropen" data-id="' + esc(m.id) + '">فتح</button>' + delBtn('mreviews', m, m.no) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
    return h;
  }
  var MRF = [{ k: 'date', l: 'تاريخ الاجتماع', t: 'date' }, { k: 'att', l: 'الحاضرون' }, { k: 'prev', l: 'متابعة قرارات المراجعة السابقة', t: 'area' }, { k: 'dec', l: 'القرارات والإجراءات (كل قرار في سطر: القرار، المسؤول، الموعد)', t: 'area', r: 5 }];

  /* ---- risks and opportunities ---- */
  var RKF = [{ k: 'type', l: 'النوع', t: 'select', o: ['خطر', 'فرصة'] }, { k: 'd', l: 'القسم', t: 'dept' }, { k: 'desc', l: 'الوصف' }, { k: 'like', l: 'الاحتمال (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 3 }, { k: 'sev', l: 'الأثر (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 3 }, { k: 'action', l: 'الإجراء' }, { k: 'owner', l: 'المسؤول', t: 'job' }, { k: 'due', l: 'الموعد', t: 'date' }, { k: 'st', l: 'الحالة', t: 'select', o: ['مفتوح', 'جارٍ التنفيذ', 'مغلق'] }, { k: 'review', l: 'نتيجة المراجعة بعد الإجراء' }];
  function vRisks() {
    var w = canWrite(), l = S.x.risks.slice().sort(function (a, b) { return b.like * b.sev - a.like * a.sev; });
    var h = head('المخاطر والفرص', 'سجل متابعة بالتقييم والإجراء والمسؤول (بند 6.1). الدرجة = الاحتمال × الأثر.', w ? '<button class="btn pri" data-x="rknew">بند جديد</button>' : '');
    h += '<div class="tiles"><div class="tile"><b class="num" style="color:var(--bad)">' + l.filter(function (r) { return r.like * r.sev >= 15 && r.st !== 'مغلق'; }).length + '</b><span>عالٍ (15 فأكثر) ومفتوح</span></div><div class="tile"><b class="num">' + l.filter(function (r) { return r.type === 'خطر'; }).length + '</b><span>خطر</span></div><div class="tile"><b class="num">' + l.filter(function (r) { return r.type === 'فرصة'; }).length + '</b><span>فرصة</span></div></div><div class="note">النموذج الرسمي: ' + formPills(['GEM-QA-F-6.1-01']) + '</div>';
    if (!l.length) return h + '<p class="empty">لا توجد بنود مسجلة.</p>';
    return h + '<div class="tblw"><table><thead><tr><th>الرقم</th><th>النوع</th><th>القسم</th><th>الوصف</th><th>الدرجة</th><th>الإجراء</th><th>المسؤول</th><th>الموعد</th><th>الحالة</th><th></th></tr></thead><tbody>' + l.map(function (r) { var s = r.like * r.sev; return '<tr><td><span class="code">' + esc(r.no) + '</span></td><td>' + esc(r.type) + '</td><td>' + esc(r.d || '') + '</td><td>' + esc(r.desc) + '</td><td class="num"><span class="pill ' + (s >= 15 ? 'bad' : s >= 8 ? 'warn' : 'good') + '">' + s + '</span> ' + r.like + '×' + r.sev + '</td><td>' + esc(r.action || '') + (r.review ? '<br><span style="font-size:12px;color:var(--muted)">' + esc(r.review) + '</span>' : '') + '</td><td>' + esc(r.owner || '') + '</td><td class="num">' + esc(fmtDate(r.due)) + '</td><td>' + esc(r.st) + '</td><td><div class="acts">' + (w ? '<button class="btn" data-x="rkedit" data-id="' + esc(r.id) + '">تعديل</button>' : '') + delBtn('risks', r, r.no) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---- customers: complaints and satisfaction ---- */
  var CMF = [{ k: 'date', l: 'التاريخ', t: 'date' }, { k: 'cust', l: 'العميل' }, { k: 'ref', l: 'رقم الأمر أو التشغيلة' }, { k: 'desc', l: 'الشكوى' }, { k: 'action', l: 'الإجراء المتخذ' }, { k: 'owner', l: 'المسؤول', t: 'job' }, { k: 'due', l: 'موعد الرد', t: 'date' }, { k: 'st', l: 'الحالة', t: 'select', o: ['مفتوحة', 'جارٍ التنفيذ', 'مغلقة'] }];
  var CSF = [{ k: 'date', l: 'التاريخ', t: 'date' }, { k: 'cust', l: 'العميل' }, { k: 'ref', l: 'رقم الأمر' }, { k: 'q1', l: 'جودة المنتج (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 5 }, { k: 'q2', l: 'الالتزام بالموعد (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 5 }, { k: 'q3', l: 'التعامل والتواصل (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 5 }, { k: 'overall', l: 'الرضا العام (1 إلى 5)', t: 'select', o: [1, 2, 3, 4, 5], d: 5 }, { k: 'note', l: 'ملاحظات العميل' }];
  function vCust() {
    var w = canWrite(), cm = S.x.complaints, cs = S.x.csat, avg = cs.length ? (cs.reduce(function (a, c) { return a + (+c.overall || 0); }, 0) / cs.length).toFixed(1) : '—';
    var h = head('العملاء: الشكاوى والرضا', 'تسجيل الشكاوى ومتابعتها، وتقييم رضا العميل بعد كل تسليم (بندا 8.2.1 و9.1.2).', w ? '<button class="btn pri" data-x="cmnew">شكوى جديدة</button><button class="btn" data-x="csnew">تقييم رضا</button>' : '');
    h += '<div class="tiles"><div class="tile"><b class="num">' + avg + '</b><span>متوسط الرضا من 5</span></div><div class="tile"><b class="num">' + cs.length + '</b><span>تقييم</span></div><div class="tile"><b class="num" style="color:var(--' + (cm.filter(function (c) { return c.st !== 'مغلقة'; }).length ? 'bad' : 'good') + ')">' + cm.filter(function (c) { return c.st !== 'مغلقة'; }).length + '</b><span>شكوى مفتوحة</span></div><div class="tile"><b class="num">' + cm.length + '</b><span>إجمالي الشكاوى</span></div></div><div class="note">النماذج الرسمية: ' + formPills(['GEM-QA-F-8.2-02', 'GEM-QA-F-8.2-04']) + '</div>';
    h += '<details class="sec" open><summary><span class="t">الشكاوى</span><small class="num">' + cm.length + '</small></summary>' + (cm.length ? '<div class="tblw" style="border:0"><table><thead><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>الشكوى</th><th>الإجراء</th><th>المسؤول</th><th>الحالة</th><th></th></tr></thead><tbody>' + cm.map(function (c) { return '<tr><td><span class="code">' + esc(c.no) + '</span></td><td class="num">' + esc(fmtDate(c.date)) + '</td><td>' + esc(c.cust) + (c.ref ? '<br><span class="num">' + esc(c.ref) + '</span>' : '') + '</td><td>' + esc(c.desc) + '</td><td>' + esc(c.action || '') + '</td><td>' + esc(c.owner || '') + '</td><td><span class="pill ' + (c.st === 'مغلقة' ? 'good' : 'warn') + '">' + esc(c.st) + '</span></td><td><div class="acts">' + (w ? '<button class="btn" data-x="cmedit" data-id="' + esc(c.id) + '">تعديل</button><button class="btn" data-x="cmncr" data-id="' + esc(c.id) + '">حوّلها لعدم مطابقة</button>' : '') + delBtn('complaints', c, c.no) + '</div></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="rows"><div class="row">لا توجد شكاوى مسجلة.</div></div>') + '</details>';
    h += '<details class="sec" open><summary><span class="t">تقييمات الرضا</span><small class="num">' + cs.length + '</small></summary>' + (cs.length ? '<div class="tblw" style="border:0"><table><thead><tr><th>التاريخ</th><th>العميل</th><th>الجودة</th><th>الموعد</th><th>التعامل</th><th>العام</th><th>ملاحظات</th><th></th></tr></thead><tbody>' + cs.map(function (c) { return '<tr><td class="num">' + esc(fmtDate(c.date)) + '</td><td>' + esc(c.cust) + (c.ref ? ' · ' + esc(c.ref) : '') + '</td><td class="num">' + esc(c.q1) + '</td><td class="num">' + esc(c.q2) + '</td><td class="num">' + esc(c.q3) + '</td><td class="num"><b>' + esc(c.overall) + '</b></td><td>' + esc(c.note || '') + '</td><td>' + delBtn('csat', c, c.cust) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="rows"><div class="row">لا توجد تقييمات.</div></div>') + '</details>';
    return h;
  }

  /* ---- supplier actual performance ---- */
  function supPerf(code) { var ps = S.pur.filter(function (p) { return p.sup === code; }), d = ps.filter(function (p) { return p.need && p.got; }), s = supBy(code), nc = S.ncr.filter(function (n) { return n.src === 'مورد' && (String(n.ref).indexOf(code) >= 0 || (s && s.name && String(n.ref).indexOf(s.name) >= 0)); }); return { n: ps.length, dated: d.length, ontime: d.length ? Math.round(d.filter(function (p) { return p.got <= p.need; }).length * 100 / d.length) : null, ncr: nc.length, total: ps.reduce(function (a, p) { return a + (+p.value || 0); }, 0) }; }
  var SEF = [{ k: 'date', l: 'تاريخ التقييم', t: 'date' }, { k: 'score', l: 'الدرجة (من 100) حسب نموذج GEM-PU-F-8.4-03', t: 'number' }, { k: 'result', l: 'القرار', t: 'select', o: ['يستمر معتمدًا', 'تحت الملاحظة', 'يوقف'] }, { k: 'note', l: 'ملاحظات' }];
  function supPerfHtml(code) {
    var p = supPerf(code), ev = S.x.supeval.filter(function (e) { return e.sup === code; });
    var h = '<details class="sec" open><summary><span class="t">الأداء الفعلي والتقييم الدوري</span><small class="num">' + ev.length + '</small></summary><div class="tiles" style="padding:10px 14px"><div class="tile"><b class="num">' + (p.ontime == null ? '—' : p.ontime + '%') + '</b><span>توريد في الموعد (' + p.dated + ' بند له موعد وتاريخ توريد)</span></div><div class="tile"><b class="num" style="color:var(--' + (p.ncr ? 'bad' : 'good') + ')">' + p.ncr + '</b><span>عدم مطابقة مسجلة عليه</span></div><div class="tile"><b class="num">' + p.n + '</b><span>بند شراء</span></div></div>';
    h += (canWrite() ? '<div class="acts noprint" style="justify-content:flex-start;padding:0 14px 10px"><button class="btn pri" data-x="senew" data-id="' + esc(code) + '">تسجيل تقييم دوري</button></div>' : '') + (ev.length ? '<div class="tblw" style="border:0"><table><tbody>' + ev.map(function (e) { return '<tr><td class="num">' + esc(fmtDate(e.date)) + '</td><td class="num">' + esc(e.score) + ' / 100</td><td>' + esc(e.result) + '</td><td>' + esc(e.note || '') + '</td><td>' + esc(e.by || '') + '</td><td>' + delBtn('supeval', e, 'تقييم ' + e.date) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="rows"><div class="row">لا يوجد تقييم دوري مسجل لهذا المورد.</div></div>') + '</details>';
    return h;
  }
  function vSupFile2(code) { var h = vSupFile(code); return supBy(code) ? h + supPerfHtml(code) : h; }

  /* ---- treasury and stock movement ---- */
  var MVF = [{ k: 'date', l: 'التاريخ', t: 'date' }, { k: 'type', l: 'الحركة', t: 'select', o: ['إضافة', 'صرف', 'جرد فعلي'] }, { k: 'item', l: 'الصنف (مثال: ذهب 999.9، فضة 999.0، خام)' }, { k: 'wt', l: 'الوزن بالجرام', t: 'number' }, { k: 'qty', l: 'العدد (اختياري)', t: 'number' }, { k: 'ref', l: 'رقم الإذن' }, { k: 'batch', l: 'كود التشغيلة أو رقم الأمر' }, { k: 'party', l: 'من / إلى' }, { k: 'note', l: 'ملاحظات' }];
  function stockBal() { var m = {}; S.x.moves.slice().sort(function (a, b) { return String(a.date + a.at).localeCompare(String(b.date + b.at)); }).forEach(function (x) { var b = m[x.item] = m[x.item] || { item: x.item, wt: 0, count: null, cdate: '', diff: null }; if (x.type === 'إضافة') b.wt += +x.wt || 0; else if (x.type === 'صرف') b.wt -= +x.wt || 0; else { b.count = +x.wt || 0; b.cdate = x.date; b.diff = Math.round((b.count - b.wt) * 1000) / 1000; } }); return Object.keys(m).sort().map(function (k) { m[k].wt = Math.round(m[k].wt * 1000) / 1000; return m[k]; }); }
  function vStock() {
    var w = canWrite() && deptAllowed('المخازن والخزينة'), bal = stockBal(), l = S.x.moves;
    var h = head('الخزينة وحركة المخزون', 'كل إضافة وصرف بإذن، والرصيد الدفتري لحظيًا، ومطابقته بالجرد الفعلي.', w ? '<button class="btn pri" data-x="mvnew">حركة جديدة</button>' : '');
    h += '<div class="note">النماذج الرسمية: ' + formPills(['GEM-WH-F-8.5.4-01', 'GEM-WH-F-8.5.4-02', 'GEM-WH-F-8.5.4-03']) + '</div>';
    if (bal.length) h += '<div class="tblw"><table><thead><tr><th>الصنف</th><th>الرصيد الدفتري (جم)</th><th>آخر جرد فعلي</th><th>تاريخ الجرد</th><th>الفرق وقت الجرد</th></tr></thead><tbody>' + bal.map(function (b) { return '<tr><td>' + esc(b.item) + '</td><td class="num"><b>' + b.wt.toLocaleString('en-US') + '</b></td><td class="num">' + (b.count == null ? '—' : b.count.toLocaleString('en-US')) + '</td><td class="num">' + esc(fmtDate(b.cdate)) + '</td><td class="num">' + (b.diff == null ? '—' : '<span class="pill ' + (b.diff === 0 ? 'good' : 'bad') + '">' + b.diff + '</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (!l.length) return h + '<p class="empty">لا توجد حركات مسجلة.</p>';
    return h + '<h2 style="font-size:17px">الحركات</h2><div class="tblw"><table><thead><tr><th>التاريخ</th><th>الحركة</th><th>الصنف</th><th>الوزن (جم)</th><th>العدد</th><th>رقم الإذن</th><th>التشغيلة</th><th>من / إلى</th><th>بواسطة</th><th></th></tr></thead><tbody>' + l.slice(0, 400).map(function (x) { return '<tr><td class="num">' + esc(fmtDate(x.date)) + '</td><td><span class="pill ' + (x.type === 'إضافة' ? 'good' : x.type === 'صرف' ? 'warn' : '') + '">' + esc(x.type) + '</span></td><td>' + esc(x.item) + '</td><td class="num">' + (+x.wt || 0).toLocaleString('en-US') + '</td><td class="num">' + esc(x.qty === '' ? '' : x.qty) + '</td><td>' + esc(x.ref || '') + '</td><td>' + esc(x.batch || '') + '</td><td>' + esc(x.party || '') + '</td><td>' + esc(x.by || '') + '</td><td>' + delBtn('moves', x, x.type + ' ' + x.item) + '</td></tr>'; }).join('') + '</tbody></table></div><div class="note">الحركة لا تُعدَّل بعد تسجيلها. الخطأ يُصحَّح بحركة عكسية، حتى يبقى الأثر كاملًا.</div>';
  }

  /* ---- QR labels ---- */
  function qrSvg(text, px) { if (!window.qrcode) return ''; var q = window.qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: px || 5, margin: 2, scalable: true }); }
  function qrDlg(ttl, sub, hash) { var url = location.href.split('#')[0] + '#' + hash; dlg('<div class="qrl"><div class="qrbox">' + qrSvg(url) + '</div><b>' + esc(ttl) + '</b><span>' + esc(sub || '') + '</span><small>شركة عصر الدهب لصناعة الدهب</small></div><p class="noprint" style="margin:0;color:var(--muted);font-size:13px">امسح الكود بكاميرا الموبايل ليفتح صفحته في النظام (بعد تسجيل الدخول).</p><div class="acts noprint"><button class="btn" data-act="closed">إغلاق</button><button class="btn pri" data-x="qrprint">طباعة الملصق</button></div>'); }

  /* ---- search everywhere ---- */
  function vSearch() {
    var q = (S.sq || '').trim(), h = head('بحث شامل', 'يبحث في الأوراق والأرشيف والأوامر والمشتريات والموردين والمعدات وكل السجلات.', '<label class="search"><input id="sq" type="search" placeholder="اكتب كلمة أو كودًا ثم Enter" value="' + esc(q) + '" data-chg="sq" aria-label="بحث شامل"></label>');
    if (q.length < 2) return h + '<p class="empty">اكتب حرفين على الأقل.</p>';
    var lq = q.toLowerCase(), has = function () { for (var i = 0; i < arguments.length; i++) if (String(arguments[i] == null ? '' : arguments[i]).toLowerCase().indexOf(lq) >= 0) return true; return false; }, n = 0;
    var sec = function (t, items, f) { if (!items.length) return ''; n += items.length; return '<details class="sec" open><summary><span class="t">' + t + '</span><small class="num">' + items.length + '</small></summary><div class="rows">' + items.slice(0, 40).map(function (x) { var r = f(x); return '<div class="row"><div><div class="ttl"><a href="#' + r[0] + '">' + r[1] + '</a></div><div class="sub">' + (r[2] || '') + '</div></div></div>'; }).join('') + '</div></details>'; };
    var out = sec('الأوراق', S.docs.filter(function (r) { return has(r.c, r.n, r.t, title(r)); }), function (r) { return ['doc-' + r.i, (r.c ? '<span class="code">' + esc(r.c) + '</span> ' : '') + esc(title(r)), esc(r.d)]; }) +
      sec('الأرشيف', S.arch.filter(function (a) { return has(a.name, a.note, a.no, a.batch); }), function (a) { var r = S.byId[a.doc]; return [r ? 'doc-' + r.i : 'trace', esc(a.name), '<span class="num">' + esc(fmtDate(a.rd)) + '</span>' + (r ? '<span>' + esc(r.c || title(r)) + '</span>' : '') + (a.note ? '<span>' + esc(a.note) + '</span>' : '')]; }) +
      sec('أوامر الإنتاج', S.ord.filter(function (o) { return has(o.no, o.cust, o.prod, o.batch, o.note); }), function (o) { return ['order-' + o.id, '<span class="code">' + esc(o.no) + '</span> ' + esc(o.cust), esc(o.prod)]; }) +
      sec('المشتريات', S.pur.filter(function (p) { return has(p.pr, p.item, p.po, p.supName, p.note); }), function (p) { return ['purchases', '<span class="code">' + esc(p.pr) + '</span> ' + esc(p.item), '<span class="num">' + esc(fmtDate(p.date)) + '</span><span>' + esc(supLabel(p)) + '</span>']; }) +
      sec('الموردون', suppliers().filter(function (s) { return has(s.code, s.name, s.scope); }), function (s) { return ['sup-' + s.code, '<span class="code">' + esc(s.code) + '</span> ' + esc(s.name), esc(s.scope || '')]; }) +
      sec('المعدات', equipList().filter(function (e) { return has(e.code, e.name, e.model); }), function (e) { return ['equip-' + encodeURIComponent(e.code), '<span class="code">' + esc(e.code) + '</span> ' + esc(e.name), esc(e.p || '')]; }) +
      sec('عدم المطابقة', S.ncr.filter(function (x) { return has(x.no, x.desc, x.ref, x.cause, x.action); }), function (x) { return ['ncr', '<span class="code">' + esc(x.no) + '</span> ' + esc(x.desc), esc(x.st)]; }) +
      sec('المخاطر والفرص', S.x.risks.filter(function (x) { return has(x.no, x.desc, x.action); }), function (x) { return ['risks', '<span class="code">' + esc(x.no) + '</span> ' + esc(x.desc), esc(x.type)]; }) +
      sec('الشكاوى', S.x.complaints.filter(function (x) { return has(x.no, x.cust, x.desc, x.ref); }), function (x) { return ['cust', '<span class="code">' + esc(x.no) + '</span> ' + esc(x.desc), esc(x.cust)]; }) +
      sec('حركة الخزينة', S.x.moves.filter(function (x) { return has(x.item, x.ref, x.batch, x.party, x.note); }), function (x) { return ['stock', esc(x.type + ' ' + x.item + ' ' + x.wt + ' جم'), '<span class="num">' + esc(fmtDate(x.date)) + '</span><span>' + esc(x.ref || '') + '</span>']; }) +
      sec('الموظفون', S.staff.filter(function (x) { return has(x.name, x.job); }), function (x) { return ['training', esc(x.name), esc(x.job || '')]; });
    return h + (n ? out : '<p class="empty">لا توجد نتائج.</p>');
  }

  /* ---- shop-floor mobile view ---- */
  function vMobile() {
    var j = myJob(), os = S.ord.filter(function (o) { var c = ordCur(o); return c && (!j || c.o === j); });
    var h = '<div class="mob"><h1>شغل الصالة</h1><p style="color:var(--muted);margin:0 0 6px">' + (j ? esc(j) : 'كل الأوامر المفتوحة. حدّد وظيفتك من «شغلي» لترى أوامرك فقط.') + ' · <a href="#home">النظام الكامل</a></p>';
    if (!canWrite()) return h + '<p class="empty">سجّل الدخول بحساب له صلاحية الكتابة.</p></div>';
    if (!os.length) return h + '<p class="empty">لا يوجد أمر عندك الآن.</p></div>';
    os.forEach(function (o) {
      var p = ordCur(o);
      h += '<div class="mcard"><div class="mh"><span class="code">' + esc(o.no) + '</span><b>' + esc(o.cust) + '</b></div><div>' + esc(o.prod) + (o.spec ? ' · ' + esc(o.spec) : '') + (o.qty ? ' · ' + esc(o.qty) : '') + '</div><div class="mstep">' + p.n + ' · ' + esc(p.t) + '</div>';
      p.c.forEach(function (c) { var r = S.byCode[c]; if (!r) return; var n = ordRecs(o, p, c).length; h += '<label class="mup ' + (n ? 'ok' : '') + '"><span>' + (n ? '✓ ' : '') + esc(title(r)) + (n ? ' (' + n + ')' : '') + '</span><b>صوّر السجل</b><input type="file" accept="image/*,application/pdf" capture="environment" data-chg="mcam" data-o="' + esc(o.id) + '" data-p="' + p.n + '" data-c="' + esc(c) + '" hidden></label>'; });
      h += '<button class="btn pri mbig" data-x="ordone2" data-id="' + esc(o.id) + '" data-p="' + p.n + '">تمت الخطوة</button></div>';
    });
    return h + '</div>';
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-x]'); if (!b) return; var x = b.dataset.x, id = b.dataset.id, db = S.cap.db, X = S.x, find = function (n) { return X[n].filter(function (y) { return y.id === id; })[0]; };
    if (x === 'aunew') fDlg('تدقيق داخلي جديد', [{ k: 'date', l: 'تاريخ التدقيق', t: 'date', d: today() }, { k: 'scope', l: 'القسم (اتركه فارغًا لكل الأقسام)', t: 'dept' }, { k: 'auditor', l: 'المدقق', d: meName() }], {}, 'ausave');
    else if (x === 'ausave') { var o = fRead([{ k: 'date' }, { k: 'scope' }, { k: 'auditor' }]); var codes = {}; S.docs.forEach(function (r) { if (r.k === 'procedure' || r.k === 'manual' || r.k === 'policy') codes[r.c] = r.d; }); o.items = (S.extra.iso || []).filter(function (c) { return !o.scope || (c.p || []).some(function (p) { return codes[p] === o.scope; }); }).map(function (c) { return { cl: c.c, q: c.t, p: c.p || [], res: ARES[0], ev: '' }; }); o.no = seq(X.audits, 'IA'); o.name = o.no; if (!o.items.length) { $('fd-m').textContent = 'لا توجد بنود مرتبطة بإجراءات هذا القسم.'; return; } fSave('audits', '', o, ['date', 'auditor']).then(function (r) { if (r && r.id) { S.au = r.id; render(); } }, function () { }); }
    else if (x === 'auopen') { S.au = id; render(); } else if (x === 'auback') { S.au = ''; }
    else if (x === 'auncr') { var a = X.audits.filter(function (y) { return y.id === S.au; })[0], it = a && a.items[+id]; if (!it) return; var no = seq(S.ncr, 'NCR'); db.collection('ncr').add({ no: no, name: no, date: today(), src: 'تدقيق داخلي', ref: a.no + ' بند ' + it.cl, desc: it.q + (it.ev ? ': ' + it.ev : ''), cause: '', action: '', owner: '', due: '', st: 'مفتوحة', at: new Date().toISOString(), by: meName() }).then(function () { it.ncr = no; auSave(a); toast('فُتحت حالة ' + no + '. أكمل بياناتها من «عدم المطابقة».', 7000); }); }
    else if (x === 'auclose') { var a2 = find('audits'); if (!a2) return; var left = (a2.items || []).filter(function (i) { return (i.res || ARES[0]) === ARES[0]; }).length; askSign('اعتماد وإقفال ' + esc(a2.no), left ? '<div class="note">باقٍ ' + left + ' بند «لم يُراجع». بعد الإقفال لا يُعدَّل التدقيق.</div>' : '<div>بعد الإقفال لا يُعدَّل التدقيق.</div>', function (note) { a2.locked = true; a2.sig = true; a2.signedBy = meName(); a2.signedAt = new Date().toISOString(); if (note) a2.closeNote = note; auSave(a2).then(function () { toast('أُقفل التدقيق.'); }); }); }
    else if (x === 'mrnew') fDlg('محضر مراجعة الإدارة', MRF, { date: today() }, 'mrsave', '', '<p style="margin:0;color:var(--muted);font-size:13px">تُحفظ مع المحضر صورة من مدخلات النظام كما هي الآن.</p>');
    else if (x === 'mrsave') { var m = fRead(MRF); m.snap = mrSnap().map(function (s) { return { 0: s[0], 1: s[1] }; }); m.no = seq(X.mreviews, 'MR'); m.name = m.no; fSave('mreviews', '', m, ['date', 'att']).then(function (r) { if (r && r.id) { S.mr = r.id; render(); } }, function () { }); }
    else if (x === 'mropen') { S.mr = id; render(); } else if (x === 'mrback') { S.mr = ''; }
    else if (x === 'mrsign') { var mm = find('mreviews'); if (mm) askSign('اعتماد محضر ' + esc(mm.no), '<div>بعد الاعتماد يُقفل المحضر ولا يُعدَّل.</div>', function () { mm.locked = true; mm.sig = true; mm.signedBy = meName(); mm.signedAt = new Date().toISOString(); db.doc('mreviews/' + mm.id).set(cp(mm)).then(function () { toast('اعتُمد المحضر وأُقفل.'); }); }); }
    else if (x === 'rknew') fDlg('خطر أو فرصة', RKF, {}, 'rksave'); else if (x === 'rkedit') fDlg('تعديل', RKF, find('risks') || {}, 'rksave', id);
    else if (x === 'rksave') { var r = fRead(RKF), old = id && find('risks'); r.like = +r.like; r.sev = +r.sev; r.no = old ? old.no : seq(X.risks, 'RK'); r.name = r.no; fSave('risks', id, r, ['desc']).catch(function () { }); }
    else if (x === 'cmnew') fDlg('شكوى عميل', CMF, { date: today() }, 'cmsave'); else if (x === 'cmedit') fDlg('تعديل شكوى', CMF, find('complaints') || {}, 'cmsave', id);
    else if (x === 'cmsave') { var c = fRead(CMF), oc = id && find('complaints'); c.no = oc ? oc.no : seq(X.complaints, 'CC'); c.name = c.no; if (oc && oc.ncr) c.ncr = oc.ncr; fSave('complaints', id, c, ['date', 'cust', 'desc']).then(function () { if (c.owner && (!oc || oc.owner !== c.owner)) notify(c.owner, 'شكوى عميل ' + c.no + ' (' + c.cust + ') مسؤوليتك', 'cust'); }, function () { }); }
    else if (x === 'cmncr') { var cc = find('complaints'); if (cc) ncDialog('', { src: 'شكوى عميل', ref: cc.no + ' / ' + cc.cust + (cc.ref ? ' / ' + cc.ref : '') }); }
    else if (x === 'csnew') fDlg('تقييم رضا عميل', CSF, { date: today() }, 'cssave');
    else if (x === 'cssave') { var s = fRead(CSF); ['q1', 'q2', 'q3', 'overall'].forEach(function (k) { s[k] = +s[k]; }); s.name = s.cust; fSave('csat', '', s, ['date', 'cust']).catch(function () { }); }
    else if (x === 'senew') { S.seSup = id; fDlg('تقييم دوري للمورد ' + esc(id), SEF, { date: today() }, 'sesave'); }
    else if (x === 'sesave') { var e = fRead(SEF); e.sup = S.seSup; e.name = S.seSup; fSave('supeval', '', e, ['date', 'score']).catch(function () { }); }
    else if (x === 'mvnew') fDlg('حركة خزينة', MVF, { date: today() }, 'mvsave');
    else if (x === 'mvsave') { var mv = fRead(MVF); mv.name = mv.type + ' ' + mv.item; mv.d = 'المخازن والخزينة'; fSave('moves', '', mv, ['date', 'item', 'wt']).catch(function () { }); }
    else if (x === 'qr') qrDlg(b.dataset.t, b.dataset.s, b.dataset.h);
    else if (x === 'qrprint') { document.body.classList.add('pq'); window.print(); setTimeout(function () { document.body.classList.remove('pq'); }, 500); }
    else if (x === 'udept') { var F = FBG(), u = (F.users || []).filter(function (y) { return y.uid === b.dataset.u; })[0]; if (!u || !F.setUser) return; var l = (u.depts || []).slice(), k = l.indexOf(b.dataset.d); if (k >= 0) l.splice(k, 1); else l.push(b.dataset.d); F.setUser(u.uid, { depts: l }); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target, c = t.dataset && t.dataset.chg; if (!c) return;
    if (c === 'sq') { S.sq = t.value; t.blur(); setTimeout(render, 30); }
    else if (c === 'aures' || c === 'auev') { var a = S.x.audits.filter(function (y) { return y.id === S.au; })[0], it = a && a.items[+t.dataset.i]; if (!it || a.locked) return; if (c === 'aures') it.res = t.value; else it.ev = t.value.trim(); auSave(a); }
    else if (c === 'mcam') { var f = (t.files || [])[0], o = S.ord.filter(function (y) { return y.id === t.dataset.o; })[0], r = S.byCode[t.dataset.c], dt = today(); if (!f || !o || !r) return; if (f.size > 10 * 1048576) { toast('الصورة أكبر من 10 ميجابايت.'); return; } toast('جارٍ رفع الصورة…', 30000); storeFile(f).then(function (res) { return S.cap.db.collection('archive').add({ doc: r.i, code: r.c, d: r.d, y: +dt.slice(0, 4), m: +dt.slice(5, 7), rd: dt, no: o.no, order: o.id, batch: o.batch || '', step: t.dataset.p, asset: res.asset, name: res.name || (r.c + ' ' + dt + '.jpg'), ct: res.ct, size: res.size, note: 'أمر إنتاج ' + o.no + ' · ' + t.dataset.p + ' · تصوير من الصالة', at: new Date().toISOString(), by: S.cap.uid }); }).then(function () { toast('رُفعت الصورة وأُرشفت.'); }).catch(function () { toast('تعذر الرفع.'); }); }
  });

  load().then(function () { render(); initCaps(); }).catch(function () { view.innerHTML = '<p class="empty">تعذر تحميل بيانات النظام. أعد فتح الصفحة.</p>'; });
})();
