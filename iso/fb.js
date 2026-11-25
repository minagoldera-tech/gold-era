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
    addUser: function (username, name, pass, role) {
      var sec = firebase.apps.filter(function (a) { return a.name === 'sec'; })[0] || firebase.initializeApp(cfg, 'sec');
      return sec.auth().createUserWithEmailAndPassword(toEmail(username), pass).then(function (c) {
        var uid = c.user.uid;
        return fs.doc('users/' + uid).set({ username: String(username).trim().toLowerCase(), name: name, role: role, active: true, at: new Date().toISOString() }).then(function () { return sec.auth().signOut(); });
      });
    },
    setUser: function (uid, patch) { return fs.doc('users/' + uid).update(patch); },
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
    who(label);
    var ref = fs.doc('settings/admins');
    ref.get().then(function (d) { if (!d.exists) return ref.set({ emails: [String(u.email).toLowerCase()] }); }).catch(function () { }).then(function () { return Promise.all([ref.get(), fs.doc('users/' + u.uid).get().catch(function () { return null; })]); }).then(function (r) {
      var boot = r[0].exists && (r[0].data().emails || []).indexOf(String(u.email).toLowerCase()) >= 0, me = r[1] && r[1].exists ? r[1].data() : null;
      if (!boot && !(me && me.active === true)) { first = true; $('lg-s').textContent = 'هذا الحساب غير مفعّل. راجع مسؤول النظام.'; auth.signOut(); return; }
      FB.admins = r[0].data().emails || []; FB.me = me; if (me && me.name) who(me.name);
      ref.onSnapshot(function (d) { FB.admins = (d.exists && d.data().emails) || []; window.dispatchEvent(new Event('gem-admins')); }, function () { });
      fs.doc('users/' + u.uid).onSnapshot(function (d) { FB.me = d.exists ? d.data() : null; if (FB.me && FB.me.active === false && !boot) auth.signOut(); window.dispatchEvent(new Event('gem-admins')); }, function () { });
      fs.collection('users').onSnapshot(function (s) { FB.users = s.docs.map(function (d) { var o = d.data(); o.uid = d.id; return o; }); window.dispatchEvent(new Event('gem-admins')); }, function () { });
      gotUser(u);
    }).catch(function () { $('lg-s').textContent = 'تعذر الاتصال بقاعدة البيانات.'; $('login').classList.add('on'); });
  });
  $('login-f').addEventListener('submit', function (ev) {
    ev.preventDefault(); $('lg-s').textContent = '';
    auth.signInWithEmailAndPassword(toEmail($('lg-e').value), $('lg-p').value).catch(function (e) {
      $('lg-s').textContent = /network/.test(e.code || '') ? 'لا يوجد اتصال بالإنترنت.' : 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    });
  });
  function isAdmin() { var u = auth.currentUser; return !!u && (FB.admins.indexOf(String(u.email).toLowerCase()) >= 0 || !!(FB.me && FB.me.active === true && FB.me.role === 'admin')); }
  function wrap(s) { return { docs: s.docs.map(function (d) { return { id: d.id, data: function () { return d.data(); } }; }), metadata: { fromCache: s.metadata.fromCache } }; }
  var db = {
    collection: function (n) {
      var c = fs.collection(n);
      return {
        onSnapshot: function (next, err) { return c.onSnapshot(function (s) { next(wrap(s)); }, err || function () { }); },
        add: function (o) { return c.add(o); },
        doc: function (id) { var d = c.doc(id); return { set: function (o) { return d.set(o); }, delete: function () { return d.delete(); } }; }
      };
    },
    doc: function (p) { var d = fs.doc(p); return { set: function (o) { return d.set(o); }, delete: function () { return d.delete(); } }; }
  };
  function b64(u8) { var o = '', i; for (i = 0; i < u8.length; i += 0x8000) o += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(o); }
  var assets = {
    upload: function (file) {
      return file.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf), n = Math.max(1, Math.ceil(u8.length / CH)), ref = fs.collection('files').doc(), i = 0;
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
