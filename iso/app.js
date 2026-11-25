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
      return '<a class="dcard" href="#' + d.h + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>' + esc(d.k) + '</h3><b class="num" style="font-family:var(--display);font-size:20px;color:var(--' + (s.score >= 80 ? 'good' : s.score >= 40 ? 'warn' : 'bad') + ')">' + s.score + '%</b></div><div class="bar"><i style="width:' + s.score + '%"></i></div><div class="meta"><span class="num">' + s.ready + ' من ' + s.forms + ' نموذج له دليل</span>' + (s.fs && !S.auditor ? '<span>·</span><span class="num">' + s.done + ' من ' + s.fs + ' ملاحظة أُغلقت</span>' : '') + '</div><div class="meta"><span class="num">' + s.all + ' ورقة</span><span>·</span><span class="num">' + s.arch + ' في الأرشيف</span>' + (s.late ? '<span class="pill bad num">' + s.late + ' متأخر</span>' : '') + '</div></a>';
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
    var h = head(esc(d.k), '<span class="num">' + s.all + ' ورقة · ' + s.forms + ' نموذج · ' + s.arch + ' ملف في الأرشيف · الجاهزية ' + s.score + '%</span>', (tab === 'docs' ? '<label class="search"><input id="dq" type="search" placeholder="ابحث في أوراق القسم" value="' + esc(q) + '" aria-label="بحث في أوراق القسم"></label>' : ''));
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
      return '<tr><td><a href="#' + d.h + '">' + esc(d.k) + '</a></td><td class="num">' + s.forms + '</td><td class="num">' + s.ready + '</td><td class="num">' + (s.none - s.late) + '</td><td class="num">' + (s.late ? '<span class="pill bad">' + s.late + '</span>' : '0') + '</td><td style="min-width:130px"><div class="bar"><i style="width:' + s.pf + '%"></i></div></td><td class="num">' + s.pf + '%</td></tr>';
    }).join('');
    h += '<div class="tblw"><table><thead><tr><th>القسم</th><th>النماذج</th><th>لها دليل</th><th>لا يوجد لها سجل مؤرشف</th><th>دوري متأخر</th><th colspan="2">نسبة الأدلة</th></tr></thead><tbody>' + rows + '<tr><td><b>الإجمالي</b></td><td class="num"><b>' + tot.f + '</b></td><td class="num"><b>' + tot.r + '</b></td><td class="num"><b>' + tot.n + '</b></td><td class="num"><b>' + tot.l + '</b></td><td></td><td class="num"><b>' + (tot.f ? Math.round(100 * tot.r / tot.f) : 0) + '%</b></td></tr></tbody></table></div>';
    DEPTS.forEach(function (d) {
      var docs = S.docs.filter(function (r) { return r.d === d.k; });
      h += '<details class="sec"><summary><span class="t">' + esc(d.k) + '</span><small class="num">' + docs.filter(isArchivable).length + ' نموذج</small></summary><div style="padding:10px">' + evTable(docs) + '</div></details>';
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
    var h = head((r.c ? '<span class="code" style="font-size:15px">' + esc(r.c) + '</span> ' : '') + esc(title(r)), esc(r.d) + (r.s ? ' / ' + esc(r.s) : '') + ' · ' + KIND[r.k] + ' · <a href="#' + (DEPTS.filter(function (d) { return d.k === r.d; })[0] || {}).h + '">رجوع للقسم</a>');
    h += '<div class="acts" style="justify-content:flex-start"><button class="btn" data-act="view" data-id="' + r.i + '">عرض</button>' + '<button class="btn" data-act="orig" data-id="' + r.i + '">تعديل الملف</button>' + (w && r.e !== 'jpeg' ? '<button class="btn pri" data-act="fill" data-id="' + r.i + '">فتح نسخة للملء في Word</button>' : '') + (w ? '<button class="btn" data-act="up" data-id="' + r.i + '">رفع ملف للأرشيف</button><button class="btn" data-act="ver" data-id="' + r.i + '">تحديث الملف (إصدار جديد)</button>' : '') + '</div>';
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
      .then(function () { closeDlg(); toast(canAdmin() ? 'حُفظ الإصدار واعتُمد.' : 'حُفظ الإصدار وينتظر اعتماد المسؤول.'); }).catch(function () { $('vr-go').disabled = false; st.textContent = 'تعذر الرفع. حاول مرة أخرى.'; });
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
    h += '<div class="tblw"><table><thead><tr><th>الشخص</th>' + DEPTS.map(function (d) { return '<th>' + esc(d.k) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' + ids.map(function (id) {
      return '<tr><td>' + esc(S.names[id] || 'مستخدم') + '</td>' + DEPTS.map(function (d) { return '<td><input type="checkbox" data-chg="role" data-id="' + esc(id) + '" data-dept="' + esc(d.k) + '"' + (S.roles[id].indexOf(d.k) >= 0 ? ' checked' : '') + ' aria-label="' + esc(d.k) + '"></td>'; }).join('') + '<td><button class="btn danger" data-act="del" data-kind="roles" data-id="' + esc(id) + '" data-label="صلاحيات ' + esc(S.names[id] || 'المستخدم') + '">إزالة</button></td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }

  function route() { var h = (location.hash || '').replace('#', ''); return h || 'home'; }
  function renderNav() {
    var r = route(), a = function (h, t, n) { return '<a href="#' + h + '"' + (r === h ? ' aria-current="page"' : '') + '><span>' + esc(t) + '</span>' + (n != null ? '<small class="num">' + n + '</small>' : '') + '</a>'; };
    var ex = expItems().filter(function (x) { return x.days <= 30; }).length;
    $('nav').innerHTML = a('home', 'الرئيسية') + '<h4>الأقسام</h4>' + DEPTS.map(function (d) { return a(d.h, d.k, S.docs.filter(function (x) { return x.d === d.k; }).length); }).join('') +
      '<h4>للعرض على المراجع</h4>' + a('evidence', 'قائمة الأدلة') + a('trace', 'بحث الأرشيف') + a('iso', 'بنود ISO 9001') + a('expiry', 'تواريخ الانتهاء', ex || null) +
      '<h4>التشغيل</h4>' + a('purchases', 'المشتريات') + a('suppliers', 'سجل الموردين') + (S.auditor ? '' : a('bulk', 'رفع مجمّع للأرشيف')) + (S.auditor ? '' : '<h4>إدارة داخلية</h4>' + a('audit', 'ملاحظات التدقيق', allFindings().filter(function (f) { return fState(f) !== 'done'; }).length) + a('report', 'التقرير الشهري') + a('log', 'سجل النشاط') + (S.cap.canEdit ? a('access', 'المستخدمون') + a('library', 'مكتبة الأوراق') : '')) +
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
    view.innerHTML = dr ? vDoc(dr) : d ? vDept(d) : r === 'evidence' ? vEvidence() : r === 'iso' ? vIso() : r === 'audit' ? vAudit() : r === 'trace' ? vTrace() : r === 'expiry' ? vExpiry() : r === 'access' ? vAccess() : r === 'purchases' ? vPurchases() : r === 'suppliers' ? vSuppliers() : r === 'library' ? vLibrary() : r === 'bulk' ? vBulk() : r === 'log' ? vLog() : r === 'report' ? vReport() : vHome();
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
  function vAccess() {
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
  function verActs(v) { return v.st === 'pending' && canAdmin() ? '<button class="btn pri" data-x="vok" data-id="' + esc(v.id) + '">اعتماد</button>' : ''; }

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
      return '<tr><td><span class="code">' + esc(s.code) + '</span></td><td>' + esc(s.name) + '</td><td>' + esc(s.scope || '') + '</td><td>' + esc(s.cls || '') + '</td><td><span class="pill ' + (s.status === 'معتمد' ? 'good' : s.status === 'موقوف' ? 'bad' : 'warn') + '">' + esc(s.status) + '</span></td><td class="num">' + esc(fmtDate(s.valid) || '') + '</td><td class="num">' + (ps.length || '—') + '</td><td class="num">' + (ps.length ? money(ps.reduce(function (a, p) { return a + (+p.value || 0); }, 0)) : '—') + '</td><td>' + (w ? '<button class="btn" data-x="supedit" data-id="' + esc(s.code) + '">تعديل</button>' : '') + '</td></tr>';
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
    if (!o.pr || !o.date || !o.item) { $('pu-m').textContent = 'رقم الطلب والتاريخ والبيان مطلوبة.'; return; }
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
  var LOGN = { archive: 'الأرشيف', versions: 'إصدار ملف', na: 'لا ينطبق', formcfg: 'دورية نموذج', findings: 'ملاحظة تدقيق', expiry: 'تاريخ انتهاء', purchases: 'بند شراء', suppliers: 'مورد', users: 'مستخدم', lib: 'مكتبة الأوراق', logins: 'كلمة مرور' }, LOGO = { add: 'إضافة', set: 'تعديل', del: 'حذف' };
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
    h += '<h2 style="font-size:17px">جاهزية الأقسام</h2><div class="tblw"><table><thead><tr><th>القسم</th><th>الجاهزية</th><th>نماذج لها دليل</th><th>دوري متأخر</th><th>ملاحظات أُغلقت</th><th>أُرشف في الشهر</th></tr></thead><tbody>' + DEPTS.map(function (d, i) { var s = st[i]; return '<tr><td>' + esc(d.k) + '</td><td class="num">' + s.score + '%</td><td class="num">' + s.ready + ' من ' + s.forms + '</td><td class="num">' + s.late + '</td><td class="num">' + (s.fs ? s.done + ' من ' + s.fs : '—') + '</td><td class="num">' + ar.filter(function (a) { return a.d === d.k; }).length + '</td></tr>'; }).join('') + '</tbody></table></div>';
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

  load().then(function () { render(); initCaps(); }).catch(function () { view.innerHTML = '<p class="empty">تعذر تحميل بيانات النظام. أعد فتح الصفحة.</p>'; });
})();
