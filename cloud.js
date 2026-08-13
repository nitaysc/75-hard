/* ============================================================
   75 HARD — cloud sync (Firebase Auth + Cloud Firestore)
   Loaded after app.js. Uses globals from app.js:
   state, save, t, toast, renderAll, applyLanguage,
   dateKey, effectiveToday, showModal, closeModal.
   ============================================================ */
'use strict';

const FB_VERSION = '10.12.0';
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
const FB_CFG_KEY = 'fbConfig';

let fb = null;          // Firebase namespaces + helpers
let cloudUser = null;   // current authenticated user
let syncTimer = null;
let syncState = 'off';  // off | on | syncing | offline

/* ---------------- Config helpers ---------------- */
function getFbConfig() {
  try { return JSON.parse(localStorage.getItem(FB_CFG_KEY)); } catch (e) { return null; }
}
function setFbConfig(cfg) {
  try { localStorage.setItem(FB_CFG_KEY, JSON.stringify(cfg)); } catch (e) {}
}

/** Accepts a JSON string or a JS object literal (the firebaseConfig snippet). */
function parseFirebaseConfig(text) {
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text.trim()); } catch (e) {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return Function('"use strict"; return (' + m[0] + ');')(); } catch (e) {}
  }
  return null;
}

/* ---------------- Firebase bootstrap ---------------- */
async function loadFirebase() {
  if (fb) return fb;
  const cfg = getFbConfig();
  if (!cfg) return null;
  try {
    const appMod = await import(FB_BASE + 'firebase-app.js');
    const authMod = await import(FB_BASE + 'firebase-auth.js');
    const dbMod = await import(FB_BASE + 'firebase-firestore.js');
    const app = appMod.initializeApp(cfg);
    fb = {
      auth: authMod.getAuth(app),
      db: dbMod.getFirestore(app),
      createUser: (e, p) => authMod.createUserWithEmailAndPassword(fb.auth, e, p),
      signIn: (e, p) => authMod.signInWithEmailAndPassword(fb.auth, e, p),
      signOut: () => authMod.signOut(fb.auth),
      doc: dbMod.doc,
      setDoc: dbMod.setDoc,
      getDoc: dbMod.getDoc,
      collection: dbMod.collection,
      getDocs: dbMod.getDocs,
    };
    authMod.onAuthStateChanged(fb.auth, onAuthChanged);
    return fb;
  } catch (e) {
    toast('Firebase: ' + (e && e.message ? e.message : e), true);
    return null;
  }
}

/* ---------------- Auth lifecycle ---------------- */
function onAuthChanged(user) {
  cloudUser = user;
  if (user) {
    setSyncState('syncing');
    pullAndMerge();
  } else {
    setSyncState('off');
    renderAccount();
  }
}

function setSyncState(s) { syncState = s; renderAccount(); }

/* ---------------- Pull + merge cloud data ---------------- */
async function pullAndMerge() {
  if (!fb || !cloudUser) return;
  try {
    const metaSnap = await fb.getDoc(fb.doc(fb.db, 'users', cloudUser.uid, 'meta', 'main'));
    const meta = metaSnap.exists() ? metaSnap.data() : null;

    const daysSnap = await fb.getDocs(fb.collection(fb.db, 'users', cloudUser.uid, 'days'));
    const cloudDays = {};
    daysSnap.forEach(d => { cloudDays[d.id] = d.data(); });

    // Meta: the newer one wins (by updatedAt).
    if (meta) {
      const localT = state.updatedAt || 0;
      const cloudT = meta.updatedAt || 0;
      if (cloudT >= localT) {
        if (meta.startDate) state.startDate = meta.startDate;
        if (typeof meta.dayEndsHour === 'number') state.dayEndsHour = meta.dayEndsHour;
        if (Array.isArray(meta.reminders)) state.reminders = meta.reminders;
        if (typeof meta.motivation === 'boolean') state.motivation = meta.motivation;
        if (meta.lang) state.lang = meta.lang;
      }
    }

    // Days: per-day, the newer one wins.
    const keys = new Set([...Object.keys(state.days || {}), ...Object.keys(cloudDays)]);
    keys.forEach(k => {
      const local = state.days[k];
      const cloud = cloudDays[k];
      if (!cloud) return;
      if (!local || (cloud.updatedAt || 0) > (local.updatedAt || 0)) {
        state.days[k] = cloud;
      }
    });

    save();        // persists the merged state locally + pushes it back to the cloud
    applyLanguage();
    renderAll();
    setSyncState('on');
    toast(t('toastSynced'));
  } catch (e) {
    setSyncState('offline');
  }
}

/* ---------------- Push local changes (debounced) ---------------- */
window.__cloudOnSave = function () {
  if (!fb || !cloudUser) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(doPush, 500);
};

async function doPush() {
  if (!fb || !cloudUser) return;
  try {
    setSyncState('syncing');
    const meta = {
      startDate: state.startDate,
      dayEndsHour: state.dayEndsHour,
      reminders: state.reminders,
      motivation: state.motivation,
      lang: state.lang,
      updatedAt: state.updatedAt || Date.now(),
    };
    await fb.setDoc(fb.doc(fb.db, 'users', cloudUser.uid, 'meta', 'main'), meta);
    const todayKey = dateKey(effectiveToday());
    if (state.days[todayKey]) {
      await fb.setDoc(fb.doc(fb.db, 'users', cloudUser.uid, 'days', todayKey), state.days[todayKey]);
    }
    setSyncState('on');
  } catch (e) {
    setSyncState('offline');
  }
}

/* ---------------- Account UI ---------------- */
function syncLabelKey(s) {
  if (s === 'on') return 'syncOn';
  if (s === 'syncing') return 'syncSyncing';
  if (s === 'offline') return 'syncOffline';
  return 'syncOff';
}

function renderAccount() {
  ['account-body', 'welcome-account'].forEach(id => {
    const body = document.getElementById(id);
    if (body) body.innerHTML = buildAccountHTML();
  });
  wireAccount();
}

function buildAccountHTML() {
  const cfg = getFbConfig();
  if (!cfg) {
    return `<p class="set-hint">${t('cloudSetupHint')}</p>
      <button class="btn btn-ghost" data-fb-open>${t('setupCloud')}</button>`;
  }
  if (!cloudUser) {
    return `<label class="field-label">${t('email')}</label>
      <input class="set-select auth-input" id="auth-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />
      <label class="field-label">${t('password')}</label>
      <input class="set-select auth-input" id="auth-pass" type="password" autocomplete="current-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" />
      <div class="auth-actions">
        <button class="btn btn-ghost" id="btn-auth-signup">${t('signUp')}</button>
        <button class="btn btn-primary" id="btn-auth-signin">${t('signIn')}</button>
      </div>
      <button class="btn btn-ghost btn-block" data-fb-open>${t('setupCloud')}</button>`;
  }
  return `<p class="account-email">${t('signedInAs', { email: cloudUser.email || cloudUser.uid })}</p>
    <p class="set-hint">${t('syncStatus', { status: t(syncLabelKey(syncState)) })}</p>
    <button class="btn btn-danger btn-block" id="btn-auth-signout">${t('signOut')}</button>`;
}

function wireAccount() {
  document.querySelectorAll('[data-fb-open]').forEach(b => {
    b.addEventListener('click', () => {
      const cfg = getFbConfig();
      document.getElementById('fb-config-input').value = cfg ? JSON.stringify(cfg, null, 2) : '';
      showModal('modal-firebase');
    });
  });

  const signInBtn = document.getElementById('btn-auth-signin');
  const signUpBtn = document.getElementById('btn-auth-signup');
  if (signInBtn) signInBtn.addEventListener('click', () => doEmailAuth('signin'));
  if (signUpBtn) signUpBtn.addEventListener('click', () => doEmailAuth('signup'));

  const signOutBtn = document.getElementById('btn-auth-signout');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      try { await fb.signOut(); } catch (e) {}
      toast(t('toastSignedOut'));
    });
  }
}

async function doEmailAuth(mode) {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!email || !pass) { toast(t('errGeneric'), true); return; }
  try {
    await loadFirebase();
    if (mode === 'signin') {
      await fb.signIn(email, pass);
    } else {
      await fb.createUser(email, pass);
    }
    toast(t('toastSignedIn'));
  } catch (e) {
    toast(authErrorMessage(e), true);
  }
}

function authErrorMessage(e) {
  const c = e && e.code ? e.code : '';
  if (c.includes('invalid-email')) return t('errInvalidEmail');
  if (c.includes('wrong-password') || c.includes('user-not-found')) return t('errWrongPassword');
  if (c.includes('email-already-in-use')) return t('errEmailInUse');
  if (c.includes('weak-password')) return t('errWeakPassword');
  if (c.includes('network')) return t('errNetwork');
  return t('errGeneric');
}

/* ---------------- Firebase setup modal ---------------- */
function wireFirebaseSetup() {
  document.getElementById('btn-fb-connect').addEventListener('click', async () => {
    const cfg = parseFirebaseConfig(document.getElementById('fb-config-input').value);
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      toast(t('invalidConfig'), true);
      return;
    }
    setFbConfig(cfg);
    const result = await loadFirebase();
    if (result) {
      closeModal('modal-firebase');
      toast(t('toastConfigSaved'));
      renderAccount();
    }
  });
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  wireFirebaseSetup();
  renderAccount();
  if (getFbConfig()) loadFirebase();   // auto-restore the session in the background
});
