/* Firebase layer: sign-in, Firestore data, and files stored as Firestore chunks (no Cloud Storage needed). */
(function () {
  'use strict';
  var cfg = window.GEM_FIREBASE || {}, $ = function (i) { return document.getElementById(i); };
  if (!cfg.apiKey || !cfg.projectId || !window.firebase) {
    window.GEM_NOFB = true;
    window.claude = { use: function () { return Promise.resolve(null); } };
    return;
  }
  firebase.initializeApp(cfg);
  var auth = firebase.auth(), fs = firebase.firestore(), CH = 700000;
  var DOM = '@gem-ims.local';
  function toEmail(v) { v = String(v || '').trim().toLowerCase(); return v.indexOf('@') >= 0 ? v : v + DOM; }
  var FB = window.GEM_FB = {
    admins: [], users: [], me: null,
    verify: function (pass) { var u = auth.currentUser; return u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pass)); },
    ts: function (d) { return firebase.firestore.Timestamp.fromDate(new Date(d + 'T23:59:59')); },
    addUser: function (username, name, pass, role, extra) {
      var sec = firebase.apps.filter(function (a) { return a.name === 'sec'; })[0] || firebase.initializeApp(cfg, 'sec');
      return sec.auth().createUserWithEmailAndPassword(toEmail(username), pass).then(function (c) {
        var uid = c.user.uid;
        logw('users', 'add', uid, { name: username }); var ud = { username: String(username).trim().toLowerCase(), name: name, role: role, active: true, at: new Date().toISOString() }; for (var k in (extra || {})) ud[k] = extra[k]; return fs.doc('users/' + uid).set(ud).then(function () { return sec.auth().signOut(); });
      });
    },
    setUser: function (uid, patch) { logw('users', 'set', uid, patch); return fs.doc('users/' + uid).update(patch); },
    resetPassword: function (u, pass) {
      var sec = firebase.apps.filter(function (a) { return a.name === 'sec'; })[0] || firebase.initializeApp(cfg, 'sec'), gen = (u.gen || 1) + 1, email = u.username + '~' + gen + DOM;
      return sec.auth().createUserWithEmailAndPassword(email, pass).then(function (c) {
        return fs.doc('users/' + c.user.uid).set({ username: u.username, name: u.name || '', role: u.role || 'user', active: true, gen: gen, at: new Date().toISOString() })
          .then(function () { return fs.doc('logins/' + u.username).set({ email: email }); })
          .then(function () { return fs.doc('users/' + u.uid).update({ active: false, replaced: true }); })
          .then(function () { logw('logins', 'set', u.username, { name: u.username }); return sec.auth().signOut(); });
      });
    },
    changePassword: function (p) { return auth.currentUser.updatePassword(p); }
  };
  var gotUser, signedIn = new Promise(function (res) { gotUser = res; }), first = true;
  auth.onAuthStateChanged(function (u) {
    if (!u) { if (!first) { location.reload(); return; } $('login').classList.add('on'); return; }
    if (!first) return;
    first = false; $('login').classList.remove('on');
    var w = $('who'), label = String(u.email).replace(DOM, '');
    function who(txt) {
      w.textContent = txt + ' · ';
      var p = document.createElement('a'); p.href = '#'; p.textContent = 'تغيير كلمة المرور'; p.onclick = function (e) { e.preventDefault(); var np = window.prompt('اكتب كلمة المرور الجديدة (6 حروف على الأقل)'); if (np == null) return; if (np.length < 6) { window.alert('كلمة المرور قصيرة.'); return; } FB.changePassword(np).then(function () { window.alert('تم تغيير كلمة المرور.'); }).catch(function () { window.alert('تعذر التغيير. سجّل الخروج ثم ادخل من جديد وحاول مرة أخرى.'); }); };
      var o = document.createElement('a'); o.href = '#'; o.textContent = 'خروج'; o.onclick = function (e) { e.preventDefault(); auth.signOut(); };
      w.appendChild(p); w.appendChild(document.createTextNode(' · ')); w.appendChild(o);
    }
    who(label); FB.label = label;
    var ref = fs.doc('settings/admins');
    ref.get().then(function (d) { if (!d.exists) return ref.set({ emails: [String(u.email).toLowerCase()] }); }).catch(function () { }).then(function () { return Promise.all([ref.get(), fs.doc('users/' + u.uid).get().catch(function () { return null; })]); }).then(function (r) {
      var boot = r[0].exists && (r[0].data().emails || []).indexOf(String(u.email).toLowerCase()) >= 0, me = r[1] && r[1].exists ? r[1].data() : null;
      if (!boot && !(me && me.active === true)) { first = true; $('lg-s').textContent = 'هذا الحساب غير مفعّل. راجع مسؤول النظام.'; auth.signOut(); return; }
      if (!boot && me.untilTs && me.untilTs.toMillis && me.untilTs.toMillis() < Date.now()) { first = true; $('lg-s').textContent = 'انتهت صلاحية هذا الحساب.'; auth.signOut(); return; }
      FB.admins = r[0].data().emails || []; FB.me = me; if (me && me.name) { who(me.name); FB.label = me.name; }
      ref.onSnapshot(function (d) { FB.admins = (d.exists && d.data().emails) || []; window.dispatchEvent(new Event('gem-admins')); }, function () { });
      fs.doc('users/' + u.uid).onSnapshot(function (d) { FB.me = d.exists ? d.data() : null; if (FB.me && FB.me.active === false && !boot) auth.signOut(); window.dispatchEvent(new Event('gem-admins')); }, function () { });
      fs.collection('users').onSnapshot(function (s) { FB.users = s.docs.map(function (d) { var o = d.data(); o.uid = d.id; return o; }); window.dispatchEvent(new Event('gem-admins')); }, function () { });
      gotUser(u);
    }).catch(function () { $('lg-s').textContent = 'تعذر الاتصال بقاعدة البيانات.'; $('login').classList.add('on'); });
  });
  $('login-f').addEventListener('submit', function (ev) {
    ev.preventDefault(); $('lg-s').textContent = '';
    var un = $('lg-e').value.trim().toLowerCase(), pw = $('lg-p').value;
    (un.indexOf('@') >= 0 ? Promise.resolve(un) : fs.doc('logins/' + un).get().then(function (d) { return d.exists && d.data().email ? d.data().email : toEmail(un); }).catch(function () { return toEmail(un); })).then(function (em) { return auth.signInWithEmailAndPassword(em, pw); }).catch(function (e) {
      $('lg-s').textContent = /network/.test(e.code || '') ? 'لا يوجد اتصال بالإنترنت.' : 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    });
  });
  function logw(coll, op, id, o) {
    if (coll === 'log' || coll === 'lib' || coll === 'files' || coll === 'notes') return; o = o || {};
    try { fs.collection('log').add({ at: new Date().toISOString(), by: FB.label || '', coll: coll, op: op, id: id || '', doc: o.doc || (coll === 'formcfg' ? id : ''), s: String(o.name || o.item || o.pr || o.note || o.freq || o.st || '').slice(0, 160) }).catch(function () { }); } catch (e) { }
  }
  function isAdmin() { var u = auth.currentUser; return !!u && (FB.admins.indexOf(String(u.email).toLowerCase()) >= 0 || !!(FB.me && FB.me.active === true && FB.me.role === 'admin')); }
  function wrap(s) { return { docs: s.docs.map(function (d) { return { id: d.id, data: function () { return d.data(); } }; }), metadata: { fromCache: s.metadata.fromCache } }; }
  var db = {
    collection: function (n) {
      var c = fs.collection(n);
      return {
        onSnapshot: function (next, err) { return c.onSnapshot(function (s) { next(wrap(s)); }, err || function () { }); },
        add: function (o) { logw(n, 'add', '', o); return c.add(o); },
        doc: function (id) { var d = c.doc(id); return { set: function (o) { logw(n, 'set', id, o); return d.set(o); }, delete: function () { logw(n, 'del', id, {}); return d.delete(); } }; }
      };
    },
    doc: function (p) { var d = fs.doc(p), pp = p.split('/'); return { set: function (o) { logw(pp[0], 'set', pp[1], o); return d.set(o); }, delete: function () { logw(pp[0], 'del', pp[1], {}); return d.delete(); } }; }
  };
  function b64(u8) { var o = '', i; for (i = 0; i < u8.length; i += 0x8000) o += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(o); }
  var assets = {
    upload: function (file, opt) {
      return file.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf), n = Math.max(1, Math.ceil(u8.length / CH)), ref = opt && opt.id ? fs.collection('files').doc(opt.id) : fs.collection('files').doc(), i = 0;
        return ref.set({ name: file.name || '', size: u8.length, type: file.type || '', chunks: n, at: new Date().toISOString(), by: auth.currentUser.uid }).then(function next() {
          if (i >= n) return { id: ref.id, contentType: file.type || '', sizeBytes: u8.length };
          var part = b64(u8.subarray(i * CH, (i + 1) * CH)), k = i++;
          return ref.collection('chunks').doc(('000' + k).slice(-4)).set({ d: part }).then(next);
        });
      });
    },
    get: function (id, type) {
      return fs.collection('files').doc(id).collection('chunks').get().then(function (s) {
        if (s.empty) throw new Error('missing');
        var parts = s.docs.sort(function (a, b) { return a.id < b.id ? -1 : 1; }).map(function (d) { var bin = atob(d.data().d), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; });
        return new Blob(parts, { type: /\//.test(type || '') ? type : 'application/octet-stream' });
      });
    },
    delete: function (id) {
      var ref = fs.collection('files').doc(id);
      return ref.collection('chunks').get().then(function (s) { return Promise.all(s.docs.map(function (d) { return d.ref.delete(); })); }).then(function () { return ref.delete(); });
    }
  };
  var downloads = { save: function (o) { var b = o.data instanceof Blob ? o.data : new Blob([o.data]), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = o.filename; document.body.appendChild(a); a.click(); a.remove(); return Promise.resolve({ status: 'saved' }); } };
  var user = { canEdit: function () { return Promise.resolve(isAdmin()); }, id: function () { return Promise.resolve(auth.currentUser ? auth.currentUser.uid : ''); }, profiles: function () { return Promise.resolve({}); }, search: function () { return Promise.resolve([]); } };
  var caps = { db: db, assets: assets, downloads: downloads, user: user };
  window.claude = { use: function (n) { return signedIn.then(function () { return caps[n] || null; }); } };
})();
