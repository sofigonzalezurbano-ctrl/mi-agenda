'use strict';

/*
 * Cloud sync between devices.
 *
 * Every record (task, student, movement, class log, rate, settings…) is stored as its own
 * document in Firestore under users/{uid}/records/{collection__id}. This file holds the
 * backend-agnostic part: turning Store.data into documents, merging with what is in the
 * cloud, and the sync UI. js/firebase-backend.js plugs Firebase into it.
 *
 * Merge rule: we remember a hash of each record as it was last synced. Comparing local,
 * remote and that "last synced" version tells us who changed what, so edits and deletions
 * made on another device (even while this one was offline) are not undone.
 */

const SYNC_COLLS = ['tasks', 'students', 'incidents', 'meetings', 'onlineStudents', 'classes', 'needs', 'transactions', 'goals', 'debts', 'schoolSchedule', 'substitutions'];
const DEVICE_ONLY_SETTINGS = ['rateFetchedAt', 'rateError'];

/** JSON with sorted keys, so the same record always produces the same text. */
function stableJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(stableJSON).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ':' + stableJSON(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

/** Short, fast string hash (cyrb53). */
function hashStr(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const hashOrNull = (json) => (json == null ? null : hashStr(json));

/** Store.data -> { docKey: json } */
function flattenData(data) {
  const out = {};
  SYNC_COLLS.forEach((c) => (data[c] || []).forEach((x) => { out[`${c}__${x.id}`] = stableJSON(x); }));
  ['classLogs', 'schoolLogs'].forEach((m) => Object.entries(data[m] || {}).forEach(([k, v]) => { out[`${m}__${k}`] = stableJSON(v); }));
  Object.entries(data.rates || {}).forEach(([d, v]) => { out[`rates__${d}`] = stableJSON(v); });
  const s = { ...data.settings };
  DEVICE_ONLY_SETTINGS.forEach((k) => delete s[k]);
  out.settings__main = stableJSON(s);
  return out;
}

/** Applies one document (or its deletion when json is null) to Store.data. */
function applyDoc(data, key, json) {
  const i = key.indexOf('__');
  const coll = key.slice(0, i), id = key.slice(i + 2);
  const val = json == null ? null : JSON.parse(json);
  if (SYNC_COLLS.includes(coll)) {
    const arr = data[coll];
    const idx = arr.findIndex((x) => x.id === id);
    if (val === null) { if (idx >= 0) arr.splice(idx, 1); }
    else if (idx >= 0) arr[idx] = val;
    else arr.push(val);
  } else if (coll === 'classLogs' || coll === 'schoolLogs' || coll === 'rates') {
    if (val === null) delete data[coll][id]; else data[coll][id] = val;
  } else if (coll === 'settings' && val) {
    Object.assign(data.settings, val);
  }
}

const CloudSync = {
  status: 'off',      // off | signed-out | connecting | unverified | synced | syncing | offline | error
  email: '',
  message: '',
  uid: null,
  ready: false,       // initial merge done
  synced: {},         // docKey -> hash of the version last known to be in the cloud
  backend: null,      // set by firebase-backend.js
  writeFn: null,
  lastSync: null,
  _timer: null,

  stateKey() { return `miAgenda.sync.${this.uid}`; },
  loadState() {
    try { this.synced = JSON.parse(localStorage.getItem(this.stateKey()) || '{}'); } catch (e) { this.synced = {}; }
  },
  saveState() {
    try { localStorage.setItem(this.stateKey(), JSON.stringify(this.synced)); } catch (e) { /* ignore */ }
  },

  /* ---- called by the backend ---- */
  attach(backend) {
    this.backend = backend;
    if (this.status === 'off') this.setStatus('signed-out');
  },
  begin(uid, email, writeFn) {
    this.uid = uid; this.email = email; this.writeFn = writeFn;
    this.ready = false;
    this.loadState();
    this.setStatus('connecting');
  },
  end(status = 'signed-out', email = '') {
    this.uid = null; this.ready = false; this.writeFn = null; this.email = email;
    this.setStatus(status);
  },

  /** snap: { fromCache, hasPendingWrites, all(): {key: json}, changes(): [{key, json}] } */
  onSnapshot(snap) {
    if (!this.ready) {
      if (snap.fromCache) { this.setStatus(navigator.onLine ? 'connecting' : 'offline'); return; }
      this.initialMerge(snap.all());
    } else {
      this.applyRemote(snap.changes());
    }
    if (snap.fromCache) this.setStatus('offline');
    else if (snap.hasPendingWrites) this.setStatus('syncing');
    else { this.lastSync = Date.now(); this.setStatus('synced'); }
  },

  initialMerge(remote) {
    const data = Store.data;
    const L = flattenData(data);
    const S = this.synced;
    const keys = new Set([...Object.keys(L), ...Object.keys(remote), ...Object.keys(S)]);
    const writes = [];
    const next = {};
    let localChanged = false;
    keys.forEach((k) => {
      const l = L[k] ?? null, r = remote[k] ?? null;
      const hl = hashOrNull(l), hr = hashOrNull(r), hs = S[k] ?? null;
      if (hl === hr) { if (hl) next[k] = hl; return; }
      let keepLocal;
      if (r === null) keepLocal = !(hs !== null && hl === hs);       // gone remotely: deleted there unless it is new/edited here
      else if (l === null) keepLocal = hs !== null && hr === hs;       // gone locally: deleted here unless edited there
      else keepLocal = hr === hs;                                      // both exist: whoever changed it since last sync wins
      if (keepLocal) { writes.push({ key: k, json: l }); if (hl) next[k] = hl; }
      else { applyDoc(data, k, r); localChanged = true; if (hr) next[k] = hr; }
    });
    this.synced = next;
    this.saveState();
    this.ready = true;
    if (writes.length) this.write(writes);
    if (localChanged) this.localApplied();
  },

  applyRemote(changes) {
    let changed = false;
    changes.forEach(({ key, json }) => {
      const h = hashOrNull(json);
      if (h === (this.synced[key] ?? null)) return; // already have it (often our own write echoing back)
      applyDoc(Store.data, key, json);
      if (h) this.synced[key] = h; else delete this.synced[key];
      changed = true;
    });
    if (changed) { this.saveState(); this.localApplied(); }
  },

  /** Remote data changed Store.data: persist it locally (without re-uploading) and refresh the screen. */
  localApplied() {
    Store.save({ silent: true });
    if (typeof App !== 'undefined') App.render();
  },

  /* ---- local edits ---- */
  onLocalSave() {
    if (!this.ready || !this.writeFn) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.pushLocal(), 300);
  },
  pushLocal() {
    const L = flattenData(Store.data);
    const writes = [];
    Object.entries(L).forEach(([k, json]) => {
      const h = hashStr(json);
      if (this.synced[k] !== h) { writes.push({ key: k, json }); this.synced[k] = h; }
    });
    Object.keys(this.synced).forEach((k) => {
      if (!(k in L)) { writes.push({ key: k, json: null }); delete this.synced[k]; }
    });
    if (!writes.length) return;
    this.saveState();
    this.write(writes);
  },
  write(writes) {
    this.setStatus(navigator.onLine ? 'syncing' : 'offline');
    this.writeFn(writes).catch((e) => this.fail(e));
  },
  fail(e) {
    console.warn('Sync error', e);
    const code = (e && e.code) || '';
    this.message = code.includes('permission') ? 'This account is not allowed to sync. Check the email you signed in with.' : 'Sync problem — your changes are safe on this device and will retry.';
    this.setStatus('error');
  },

  /* ---- UI ---- */
  setStatus(s) {
    this.status = s;
    $$('[data-sync-badge]').forEach((el) => { el.outerHTML = syncBadge(el.dataset.syncBadge); });
    const sec = $('#sync-section');
    if (sec && !sec.contains(document.activeElement)) sec.innerHTML = syncSectionInner();
  },
};

const SYNC_LABEL = {
  off: 'This device only', 'signed-out': 'Not syncing', connecting: 'Connecting…', unverified: 'Verify your email',
  synced: 'Synced', syncing: 'Syncing…', offline: 'Offline — will sync later', error: 'Sync problem',
};
const SYNC_TONE = { synced: 'ok', syncing: 'busy', connecting: 'busy', offline: 'warn', unverified: 'warn', error: 'bad' };

function syncBadge(variant = 'pill') {
  const s = CloudSync.status;
  return `<button class="sync-badge ${variant} tone-${SYNC_TONE[s] || 'off'}" data-sync-badge="${variant}" data-action="settings" aria-label="Sync: ${SYNC_LABEL[s]}">
    <span class="sync-dot"></span><span class="sync-text">${SYNC_LABEL[s]}</span></button>`;
}

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email yet — tap “Create account”.',
  'auth/email-already-in-use': 'That email already has an account — use “Sign in”.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/invalid-email': 'That email doesn’t look right.',
  'auth/network-request-failed': 'No internet connection.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase yet.',
};
const authMessage = (e) => AUTH_ERRORS[e && e.code] || 'Something went wrong. Try again.';

function syncSectionInner() {
  const s = CloudSync.status;
  if (s === 'off') {
    return `<p class="small muted">Sync works in the online version of the app:
      <a href="https://sofigonzalezurbano-ctrl.github.io/mi-agenda/">sofigonzalezurbano-ctrl.github.io/mi-agenda</a>. Here your data stays on this device.</p>`;
  }
  if (s === 'signed-out') {
    return `<p class="small muted" style="margin:0 0 12px">Sign in to keep your phone and laptop in sync automatically. Use the same email and password on both.</p>
      <form class="form" id="sync-form" autocomplete="on">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="username" value="${esc(CloudSync.email || 'sofigonzalezurbano@gmail.com')}" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" minlength="6" required></label>
        ${CloudSync.message ? `<p class="small sync-msg" style="grid-column:1/-1;margin:0">${esc(CloudSync.message)}</p>` : ''}
        <div class="form-actions" style="flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" data-sync="reset">Forgot password</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-light btn-sm" data-sync="signup">Create account</button>
          <button type="submit" class="btn btn-dark btn-sm">Sign in</button>
        </div>
      </form>`;
  }
  if (s === 'unverified') {
    return `<p class="small" style="margin:0 0 12px">We sent a verification email to <b>${esc(CloudSync.email)}</b>. Open it, tap the link, then come back and press the button below. (Check spam too.)</p>
      ${CloudSync.message ? `<p class="small sync-msg">${esc(CloudSync.message)}</p>` : ''}
      <div class="chips">
        <button class="btn btn-dark btn-sm" data-sync="verified">I verified my email</button>
        <button class="btn btn-light btn-sm" data-sync="resend">Resend email</button>
        <button class="btn btn-ghost btn-sm" data-sync="signout">Sign out</button>
      </div>`;
  }
  const when = CloudSync.lastSync ? ' · last ' + fmtTime(new Date(CloudSync.lastSync).toTimeString().slice(0, 5)) : '';
  return `<p class="small" style="margin:0 0 12px">${syncBadge('inline')} Signed in as <b>${esc(CloudSync.email)}</b>${s === 'synced' ? when : ''}</p>
    ${s === 'error' && CloudSync.message ? `<p class="small sync-msg">${esc(CloudSync.message)}</p>` : ''}
    <p class="small muted" style="margin:0 0 12px">Everything you add here appears on your other devices within seconds. Without internet, changes are saved and sent when you’re back online.</p>
    <button class="btn btn-ghost btn-sm" data-sync="signout">Sign out of sync</button>`;
}

function syncSectionHTML() {
  return `<div class="group-title" style="margin-top:22px">Sync between devices</div><div id="sync-section">${syncSectionInner()}</div>`;
}

/* Sync section events (inside the settings sheet) */
async function runSync(fn) {
  CloudSync.message = '';
  try { await fn(); } catch (e) { CloudSync.message = authMessage(e); }
  const sec = $('#sync-section');
  if (sec) sec.innerHTML = syncSectionInner();
}
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'sync-form') return;
  e.preventDefault();
  const f = e.target;
  runSync(() => CloudSync.backend.signIn(f.elements.email.value.trim(), f.elements.password.value));
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-sync]');
  if (!b || !CloudSync.backend) return;
  const f = $('#sync-form');
  const email = f ? f.elements.email.value.trim() : CloudSync.email;
  const pass = f ? f.elements.password.value : '';
  const be = CloudSync.backend;
  switch (b.dataset.sync) {
    case 'signup':
      if (!f.reportValidity()) return;
      runSync(() => be.signUp(email, pass));
      break;
    case 'reset':
      if (!email) { CloudSync.message = 'Write your email first.'; $('#sync-section').innerHTML = syncSectionInner(); return; }
      runSync(async () => { await be.resetPassword(email); CloudSync.message = `Password reset email sent to ${email}.`; });
      break;
    case 'verified':
      runSync(async () => { if (!(await be.recheckVerification())) CloudSync.message = 'Not verified yet — tap the link in the email first.'; });
      break;
    case 'resend':
      runSync(async () => { await be.resendVerification(); CloudSync.message = 'Email sent again.'; });
      break;
    case 'signout':
      if (confirm('Stop syncing on this device? Your data stays here; you can sign in again anytime.')) runSync(() => be.signOut());
      break;
  }
});
window.addEventListener('online', () => { if (CloudSync.status === 'offline') CloudSync.setStatus('syncing'); });
window.addEventListener('offline', () => { if (CloudSync.uid) CloudSync.setStatus('offline'); });
