/*
 * GOLD ERA ERP — platform layer.
 *
 * The app talks to one small API: platform.use("db" | "user" | "downloads"), plus
 * username/password sign-in and user creation for the owner.
 * Two backends implement it:
 *   - "firebase": Cloud Firestore + Firebase Authentication (email/password under the hood,
 *                 shown to people as a username). Shared by every employee; access is
 *                 enforced by firestore.rules.
 *   - "local":    the browser's localStorage, one device. Same sign-in and the same
 *                 per-user access checks, so permissions can be tried before going live.
 */
"use strict";
(function () {
  const CFG = window.GOLD_ERA_CONFIG || {};
  const hasFirebase = !!(CFG.firebase && CFG.firebase.apiKey && window.firebase);
  const DOMAIN = (CFG.userDomain || "users.gold-era.local").toLowerCase();
  const owners = (CFG.ownerUsernames || []).map(u => String(u).trim().toLowerCase()).filter(Boolean);
  const LEDGER = ["bars", "strips", "casting", "moves", "sales", "payments", "counts", "labels", "sessions", "evals"];
  const GUARDED = LEDGER.concat(["orders", "customers", "months", "staff"]);
  const clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const cleanUser = u => String(u || "").trim().toLowerCase();
  const validUser = u => /^[a-z0-9._-]{3,32}$/.test(u);
  const emailOf = u => cleanUser(u) + "@" + DOMAIN;
  const userOfEmail = e => String(e || "").split("@")[0];
  const avatar = name => {
    const ch = (String(name || "؟").trim()[0] || "؟").replace(/[<&>"]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#2a2620"/><text x="32" y="41" font-size="28" text-anchor="middle" fill="#ddb546" font-family="Tahoma,sans-serif">${ch}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  };
  const denied = () => ({ code: "invalid_argument", message: "permission denied" });
  const dbError = e => {
    const c = e && (e.code || "");
    if (c === "permission-denied") return denied();
    if (c === "resource-exhausted") return { code: "resource_exhausted", message: e.message };
    if (c === "unavailable") return { code: "unavailable", message: e.message };
    return e && e.code ? e : { code: "unavailable", message: String(e) };
  };
  const authError = e => {
    const c = (e && e.code) || "";
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return "اسم المستخدم أو كلمة المرور غير صحيحة.";
    if (/too-many-requests/.test(c)) return "محاولات كثيرة. انتظر دقائق ثم حاول مرة أخرى.";
    if (/email-already-in-use/.test(c)) return "اسم المستخدم مستخدم من قبل.";
    if (/weak-password/.test(c)) return "كلمة المرور ضعيفة: 6 أحرف على الأقل.";
    if (/network/.test(c)) return "لا يوجد اتصال بالإنترنت.";
    if (/requires-recent-login/.test(c)) return "سجّل الخروج وادخل مرة أخرى ثم أعد المحاولة.";
    return (e && e.message) || "تعذرت العملية.";
  };
  const snapOf = (id, exists, data) => ({ id, exists, data: () => (exists ? data : undefined), metadata: { fromCache: false, hasPendingWrites: false } });

  /* the same checks firestore.rules makes, for the backends without server rules */
  const checkAccess = (current, access, path, write) => {
    if (!current) return false;
    if (current.isOwner) return true;
    const a = access; const seg = path.split("/");
    if (seg[0] === "access") return !write && seg[1] === current.id;
    if (seg[0] === "auth") return !write;
    if (!a || a.active !== true) return false;
    if (seg[0] === "settings") return write ? a.settings === true : true;
    if (seg[0] === "months") return write ? a.settings === true : ((a.read || []).includes("months") || a.settings === true);
    if (GUARDED.includes(seg[0])) return (write ? a.write : a.read || []).includes(seg[0]);
    return false;
  };
  const sha = async s => { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); };
  const salt = () => [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, "0")).join("");

  /* ---------------- local backend ---------------- */
  function localBackend() {
    const KEY = "gold-era-erp:v2", AUTH = "gold-era-erp:auth", SESSION = "gold-era-erp:session";
    const load = k => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } };
    let store = load(KEY), auth = load(AUTH);
    auth.users = auth.users || {};
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); localStorage.setItem(AUTH, JSON.stringify(auth)); } catch (e) { console.warn("localStorage write failed", e); } };
    const listeners = new Set();
    const notify = () => setTimeout(() => listeners.forEach(f => f()), 0);
    addEventListener("storage", ev => { if (ev.key === KEY) { store = load(KEY); notify(); } if (ev.key === AUTH) auth = load(AUTH); });
    const sha = async s => { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); };
    const salt = () => [...crypto.getRandomValues(new Uint8Array(12))].map(x => x.toString(16).padStart(2, "0")).join("");
    let current = null;
    const accessOf = uid => store["access/" + uid] || null;
    /* the same checks firestore.rules makes */
    const can = (path, write) => {
      if (!current) return false;
      if (current.isOwner) return true;
      const a = accessOf(current.id); const seg = path.split("/");
      if (seg[0] === "access") return !write && seg[1] === current.id;
      if (!a || a.active !== true) return false;
      if (seg[0] === "settings") return write ? a.settings === true : true;
      if (seg[0] === "months") return write ? a.settings === true : (a.read || []).includes("months");
      if (GUARDED.includes(seg[0])) return (write ? a.write : a.read || []).includes(seg[0]);
      return false;
    };
    const merge = (t, s) => { for (const k in s) { const v = s[k]; if (v && typeof v === "object" && !Array.isArray(v) && t[k] && typeof t[k] === "object" && !Array.isArray(t[k])) merge(t[k], v); else t[k] = clone(v); } };
    const snap = p => snapOf(p.split("/").pop(), p in store, clone(store[p]));
    const children = p => Object.keys(store).filter(k => k.startsWith(p + "/") && k.split("/").length === p.split("/").length + 1).sort().map(snap);
    const doc = path => ({
      id: path.split("/").pop(), path,
      get: async () => { if (!can(path)) return snapOf(path.split("/").pop(), false); return snap(path); },
      set: async d => { if (!can(path, true)) throw denied(); store[path] = clone(d); save(); notify(); },
      update: async d => { if (!can(path, true)) throw denied(); if (!(path in store)) store[path] = {}; merge(store[path], d); save(); notify(); },
      delete: async () => { if (!current || !current.isOwner) throw denied(); delete store[path]; save(); notify(); },
      acquire: async () => ({ acquired: true }),
      onSnapshot: (next, err) => { if (!can(path)) { setTimeout(() => err && err(denied()), 0); return () => {}; } const f = () => next(snap(path)); listeners.add(f); setTimeout(f, 0); return () => listeners.delete(f); },
      collection: p => coll(path + "/" + p)
    });
    const coll = path => ({
      path,
      doc: id => doc(path + "/" + (id || Math.random().toString(36).slice(2, 12))),
      add: async d => { const r = doc(path + "/" + Math.random().toString(36).slice(2, 12)); await r.set(d); return r; },
      get: async () => { if (!can(path + "/x")) throw denied(); const d = children(path); return { docs: d, size: d.length, empty: !d.length }; },
      onSnapshot: (next, err) => { if (!can(path + "/x")) { setTimeout(() => err && err(denied()), 0); return () => {}; } const f = () => { const d = children(path); next({ docs: d, size: d.length, empty: !d.length, docChanges: () => [] }); }; listeners.add(f); setTimeout(f, 0); return () => listeners.delete(f); }
    });
    const meOf = (username, rec) => ({ id: rec.uid, username, name: (store["access/" + rec.uid] || {}).name || rec.name || username, email: null, avatarUrl: avatar(rec.name || username), color: "#ddb546", isOwner: !!rec.owner, canEdit: !!rec.owner });
    const people = () => (store["settings/people"] || {}).map || {};
    return {
      mode: "local",
      db: { doc, collection: coll },
      needsSetup: async () => Object.keys(auth.users).length === 0,
      setupOwner: async (username, password, name) => {
        const u = cleanUser(username); if (!validUser(u)) throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        if (Object.keys(auth.users).length) throw "حساب المالك موجود بالفعل.";
        const s = salt(); auth.users[u] = { uid: "owner-" + Math.random().toString(36).slice(2, 10), salt: s, hash: await sha(s + password), owner: true, name: name || u }; save();
      },
      auth: async () => {
        let sid = null; try { sid = sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION); } catch (e) {}
        const hit = Object.entries(auth.users).find(([, r]) => r.uid === sid);
        if (!hit) return null;
        current = meOf(hit[0], hit[1]); return current;
      },
      signIn: async (username, password, remember) => {
        const u = cleanUser(username), r = auth.users[u];
        if (!r || r.hash !== await sha(r.salt + password)) throw "اسم المستخدم أو كلمة المرور غير صحيحة.";
        try { (remember ? localStorage : sessionStorage).setItem(SESSION, r.uid); } catch (e) {}
        location.reload();
      },
      signOut: async () => { try { sessionStorage.removeItem(SESSION); localStorage.removeItem(SESSION); } catch (e) {} location.reload(); },
      createUser: async (username, password) => {
        if (!current || !current.isOwner) throw "إنشاء المستخدمين للمالك فقط.";
        const u = cleanUser(username); if (!validUser(u)) throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً أو . _ -";
        if (auth.users[u]) throw "اسم المستخدم مستخدم من قبل.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        const s = salt(), uid = "u-" + Math.random().toString(36).slice(2, 12);
        auth.users[u] = { uid, salt: s, hash: await sha(s + password) }; save(); return uid;
      },
      resetPassword: async (username, password) => {
        if (!current || !current.isOwner) throw "للمالك فقط.";
        const r = auth.users[cleanUser(username)]; if (!r) throw "المستخدم غير موجود.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        r.salt = salt(); r.hash = await sha(r.salt + password); save();
      },
      changePassword: async (oldPass, newPass) => {
        const hit = Object.entries(auth.users).find(([, r]) => current && r.uid === current.id); if (!hit) throw "غير مسجل الدخول.";
        if (hit[1].hash !== await sha(hit[1].salt + oldPass)) throw "كلمة المرور الحالية غير صحيحة.";
        if (String(newPass).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        hit[1].salt = salt(); hit[1].hash = await sha(hit[1].salt + newPass); save();
      },
      canResetPasswords: true,
      user: {
        me: async () => current,
        id: async () => current && current.id,
        profiles: async ids => { const p = people(); return Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: (p[i] || {}).name || (current && i === current.id ? current.name : ""), avatarUrl: avatar((p[i] || {}).name || "؟"), color: "#888", email: null, isMe: !!current && i === current.id }])); }
      }
    };
  }

  /* ---------------- firebase backend ---------------- */
  function firebaseBackend() {
    const app = firebase.initializeApp(CFG.firebase);
    const fs = firebase.firestore(app);
    const auth = firebase.auth(app);
    let current = null, peopleCache = {};
    const wrapDoc = d => snapOf(d.id, d.exists, d.exists ? d.data() : undefined);
    const doc = path => {
      const ref = fs.doc(path);
      return {
        id: ref.id, path,
        get: async () => { try { return wrapDoc(await ref.get()); } catch (e) { if (e && e.code === "permission-denied") return snapOf(ref.id, false); throw dbError(e); } },
        set: async d => { try { await ref.set(d); } catch (e) { throw dbError(e); } },
        update: async d => { try { await ref.set(d, { merge: true }); } catch (e) { throw dbError(e); } },
        delete: async () => { try { await ref.delete(); } catch (e) { throw dbError(e); } },
        acquire: async () => ({ acquired: true }),
        onSnapshot: (next, err) => ref.onSnapshot(s => next(wrapDoc(s)), e => err && err(dbError(e))),
        collection: p => coll(path + "/" + p)
      };
    };
    const coll = path => {
      const ref = fs.collection(path);
      return {
        path,
        doc: id => doc(path + "/" + (id || ref.doc().id)),
        add: async d => { try { const r = await ref.add(d); return doc(path + "/" + r.id); } catch (e) { throw dbError(e); } },
        get: async () => { try { const q = await ref.get(); const docs = q.docs.map(wrapDoc); return { docs, size: docs.length, empty: !docs.length }; } catch (e) { throw dbError(e); } },
        onSnapshot: (next, err) => ref.onSnapshot(q => { const docs = q.docs.map(wrapDoc); next({ docs, size: docs.length, empty: !docs.length, docChanges: () => [] }); }, e => err && err(dbError(e)))
      };
    };
    fs.doc("settings/people").onSnapshot(s => { peopleCache = (s.exists && s.data().map) || {}; }, () => {});
    const toMe = u => { const username = userOfEmail(u.email); return { id: u.uid, username, name: (peopleCache[u.uid] || {}).name || username, email: null, avatarUrl: avatar((peopleCache[u.uid] || {}).name || username), color: "#ddb546", isOwner: owners.includes(username), canEdit: owners.includes(username) }; };
    return {
      mode: "firebase",
      db: { doc, collection: coll },
      needsSetup: async () => false,
      setupOwner: async (username, password) => {
        const u = cleanUser(username); if (!owners.includes(u)) throw "هذا الاسم ليس اسم المالك في config.js.";
        try { await auth.createUserWithEmailAndPassword(emailOf(u), password); location.reload(); } catch (e) { throw authError(e); }
      },
      auth: () => new Promise(res => { const off = auth.onAuthStateChanged(async u => { off(); if (!u) return res(null); try { const s = await fs.doc("settings/people").get(); peopleCache = (s.exists && s.data().map) || {}; } catch (e) {} current = toMe(u); res(current); }); }),
      signIn: async (username, password, remember) => {
        try { await auth.setPersistence(remember ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION); await auth.signInWithEmailAndPassword(emailOf(username), password); location.reload(); }
        catch (e) { throw authError(e); }
      },
      signOut: async () => { await auth.signOut(); location.reload(); },
      /* a second Firebase app creates the account, so the owner stays signed in */
      createUser: async (username, password) => {
        const u = cleanUser(username); if (!validUser(u)) throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً أو . _ -";
        const sec = firebase.apps.find(a => a.name === "creator") || firebase.initializeApp(CFG.firebase, "creator");
        try { const r = await sec.auth().createUserWithEmailAndPassword(emailOf(u), password); const uid = r.user.uid; await sec.auth().signOut(); return uid; }
        catch (e) { throw authError(e); }
      },
      canResetPasswords: false,
      changePassword: async (oldPass, newPass) => {
        const u = auth.currentUser; if (!u) throw "غير مسجل الدخول.";
        try { await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, oldPass)); await u.updatePassword(newPass); }
        catch (e) { throw /invalid-credential|wrong-password/.test((e && e.code) || "") ? "كلمة المرور الحالية غير صحيحة." : authError(e); }
      },
      user: {
        me: async () => current,
        id: async () => current && current.id,
        profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: (peopleCache[i] || {}).name || "", avatarUrl: avatar((peopleCache[i] || {}).name || "؟"), color: "#888", email: null, isMe: !!current && i === current.id }]))
      }
    };
  }


  /* ---------------- claude.ai shared store (synced preview) ----------------
   * When the app runs as a claude.ai artifact with a shared database, every device that opens it
   * sees the same data live. Sign-in and per-user access work as in local mode; accounts are kept
   * in the shared store as salted hashes. For the real deployment use Firebase. */
  function claudeBackend(cdb) {
    const SESSION = "gold-era-erp:session";
    let current = null, access = null, people = {};
    const authRef = cdb.doc("auth/users");
    const readAuth = async () => { const s = await authRef.get(); return (s.exists && s.data().users) || {}; };
    const can = (path, write) => checkAccess(current, access, path, write);
    const doc = path => {
      const r = cdb.doc(path);
      return {
        id: path.split("/").pop(), path,
        get: async () => { if (!can(path)) return snapOf(path.split("/").pop(), false); return r.get(); },
        set: async d => { if (!can(path, true)) throw denied(); return r.set(d); },
        update: async d => { if (!can(path, true)) throw denied(); try { return await r.update(d); } catch (e) { if (e && e.code === "invalid_argument") { const s = await r.get(); if (!s.exists) return r.set(d); } throw e; } },
        delete: async () => { if (!current || !current.isOwner) throw denied(); return r.delete(); },
        acquire: o => r.acquire(o),
        onSnapshot: (next, err) => { if (!can(path)) { setTimeout(() => err && err(denied()), 0); return () => {}; } return r.onSnapshot(next, err); },
        collection: p => coll(path + "/" + p)
      };
    };
    const coll = path => {
      const c = cdb.collection(path);
      return {
        path,
        doc: id => doc(path + "/" + (id || Math.random().toString(36).slice(2, 12))),
        add: async d => { if (!can(path + "/x", true)) throw denied(); const r = await c.add(d); return doc(path + "/" + r.id); },
        get: async () => { if (!can(path + "/x")) throw denied(); return c.get(); },
        onSnapshot: (next, err) => { if (!can(path + "/x")) { setTimeout(() => err && err(denied()), 0); return () => {}; } return c.onSnapshot(next, err); }
      };
    };
    const meOf = (username, rec) => ({ id: rec.uid, username, name: (people[rec.uid] || {}).name || rec.name || username, email: null, avatarUrl: avatar((people[rec.uid] || {}).name || rec.name || username), color: "#ddb546", isOwner: !!rec.owner, canEdit: !!rec.owner });
    const sid = () => { try { return sessionStorage.getItem(SESSION) || localStorage.getItem(SESSION); } catch (e) { return null; } };
    const mine = async () => { const users = await readAuth(); return Object.entries(users).find(([, r]) => current && r.uid === current.id); };
    return {
      mode: "claude",
      db: { doc, collection: coll },
      needsSetup: async () => Object.keys(await readAuth()).length === 0,
      setupOwner: async (username, password, name) => {
        const u = cleanUser(username); if (!validUser(u)) throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        if (Object.keys(await readAuth()).length) throw "حساب المالك موجود بالفعل.";
        const s = salt(); await authRef.set({ users: { [u]: { uid: "owner-" + Math.random().toString(36).slice(2, 10), salt: s, hash: await sha(s + password), owner: true, name: name || u } } });
      },
      auth: async () => {
        const id = sid(); if (!id) return null;
        const users = await readAuth(); const hit = Object.entries(users).find(([, r]) => r.uid === id); if (!hit) return null;
        try { const p = await cdb.doc("settings/people").get(); people = (p.exists && p.data().map) || {}; } catch (e) {}
        current = meOf(hit[0], hit[1]);
        if (!current.isOwner) { const a = await cdb.doc("access/" + current.id).get(); access = a.exists ? a.data() : null; cdb.doc("access/" + current.id).onSnapshot(s => { access = s.exists ? s.data() : null; }, () => {}); }
        return current;
      },
      signIn: async (username, password, remember) => {
        const users = await readAuth(); const r = users[cleanUser(username)];
        if (!r || r.hash !== await sha(r.salt + password)) throw "اسم المستخدم أو كلمة المرور غير صحيحة.";
        try { (remember ? localStorage : sessionStorage).setItem(SESSION, r.uid); } catch (e) {}
        location.reload();
      },
      signOut: async () => { try { sessionStorage.removeItem(SESSION); localStorage.removeItem(SESSION); } catch (e) {} location.reload(); },
      createUser: async (username, password) => {
        if (!current || !current.isOwner) throw "إنشاء المستخدمين للمالك فقط.";
        const u = cleanUser(username); if (!validUser(u)) throw "اسم المستخدم: 3 إلى 32 حرفاً إنجليزياً أو أرقاماً أو . _ -";
        if ((await readAuth())[u]) throw "اسم المستخدم مستخدم من قبل.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        const s = salt(), uid = "u-" + Math.random().toString(36).slice(2, 12);
        await authRef.update({ users: { [u]: { uid, salt: s, hash: await sha(s + password) } } }); return uid;
      },
      resetPassword: async (username, password) => {
        if (!current || !current.isOwner) throw "للمالك فقط.";
        const u = cleanUser(username); if (!(await readAuth())[u]) throw "المستخدم غير موجود.";
        if (String(password).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        const s = salt(); await authRef.update({ users: { [u]: { salt: s, hash: await sha(s + password) } } });
      },
      changePassword: async (oldPass, newPass) => {
        const hit = await mine(); if (!hit) throw "غير مسجل الدخول.";
        if (hit[1].hash !== await sha(hit[1].salt + oldPass)) throw "كلمة المرور الحالية غير صحيحة.";
        if (String(newPass).length < 6) throw "كلمة المرور: 6 أحرف على الأقل.";
        const s = salt(); await authRef.update({ users: { [hit[0]]: { salt: s, hash: await sha(s + newPass) } } });
      },
      canResetPasswords: true,
      user: {
        me: async () => current,
        id: async () => current && current.id,
        profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: (people[i] || {}).name || "", avatarUrl: avatar((people[i] || {}).name || "؟"), color: "#888", email: null, isMe: !!current && i === current.id }]))
      }
    };
  }

  let backend = null;
  const ready = (async () => {
    if (!hasFirebase && window.claude && typeof window.claude.use === "function") {
      try { const cdb = await window.claude.use("db"); if (cdb) { backend = claudeBackend(cdb); return backend; } } catch (e) {}
    }
    backend = hasFirebase ? firebaseBackend() : localBackend(); return backend;
  })();
  const fwd = name => async (...a) => (await ready)[name](...a);
  const downloads = {
    save: async ({ filename, data }) => {
      if (window.claude && typeof window.claude.use === "function") { const d = await window.claude.use("downloads"); if (d) return d.save({ filename, data }); }
      const blob = data instanceof Blob ? data : new Blob([data], { type: /\.csv$/i.test(filename) ? "text/csv;charset=utf-8" : /\.json$/i.test(filename) ? "application/json" : "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000); return "saved";
    }
  };
  window.platform = {
    LEDGER, owners, ready,
    get mode() { return backend ? backend.mode : (hasFirebase ? "firebase" : "local"); },
    get canResetPasswords() { return !!(backend && backend.canResetPasswords); },
    auth: fwd("auth"), signIn: fwd("signIn"), signOut: fwd("signOut"),
    needsSetup: fwd("needsSetup"), setupOwner: fwd("setupOwner"),
    createUser: fwd("createUser"), resetPassword: fwd("resetPassword"), changePassword: fwd("changePassword"),
    use: async name => { const b = await ready; return name === "db" ? b.db : name === "user" ? b.user : name === "downloads" ? downloads : null; }
  };
})();
