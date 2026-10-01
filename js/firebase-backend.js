/* Firebase backend for CloudSync (see js/sync.js). Loaded as an ES module from the Firebase CDN. */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, onSnapshot, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Public project identifiers (not secrets). Access is controlled by the Firestore security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyDAX1BHoO7FK_TJ8-dWIOpGpPYluMJKYDA',
  authDomain: 'mi-agenda-e3913.firebaseapp.com',
  projectId: 'mi-agenda-e3913',
  storageBucket: 'mi-agenda-e3913.firebasestorage.app',
  messagingSenderId: '375179447095',
  appId: '1:375179447095:web:1f48acc0ce6180fe8968b2',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  // Offline cache: edits made without internet are queued and sent later.
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
}

let unsubscribe = null;

function stopListening() {
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
}

function writer(uid) {
  return async (changes) => {
    for (let i = 0; i < changes.length; i += 400) {
      const batch = writeBatch(db);
      changes.slice(i, i + 400).forEach(({ key, json }) => {
        const ref = doc(db, 'users', uid, 'records', key);
        if (json === null) batch.delete(ref); else batch.set(ref, { v: json, u: serverTimestamp() });
      });
      await batch.commit();
    }
  };
}

let retriedWithFreshToken = false;

async function startSync(user) {
  stopListening();
  CloudSync.begin(user.uid, user.email, writer(user.uid));
  // A token issued before the email was verified still says "not verified" for up to an hour,
  // and the security rules would reject it. Ask for a fresh one in that case.
  try {
    const token = await user.getIdTokenResult();
    if (!token.claims.email_verified) await user.getIdToken(true);
  } catch (e) { /* offline: the cached token is used */ }
  unsubscribe = onSnapshot(
    collection(db, 'users', user.uid, 'records'),
    { includeMetadataChanges: true },
    (snap) => CloudSync.onSnapshot({
      fromCache: snap.metadata.fromCache,
      hasPendingWrites: snap.metadata.hasPendingWrites,
      all: () => Object.fromEntries(snap.docs.map((d) => [d.id, d.data().v])),
      changes: () => snap.docChanges()
        .filter((c) => !c.doc.metadata.hasPendingWrites)
        .map((c) => ({ key: c.doc.id, json: c.type === 'removed' ? null : c.doc.data().v })),
    }),
    async (err) => {
      if (err.code === 'permission-denied' && !retriedWithFreshToken) {
        retriedWithFreshToken = true;
        try { await user.getIdToken(true); startSync(user); return; } catch (e) { /* fall through */ }
      }
      CloudSync.fail(err);
    },
  );
}

onAuthStateChanged(auth, (user) => {
  stopListening();
  if (!user) CloudSync.end('signed-out', CloudSync.email);
  else if (!user.emailVerified) CloudSync.end('unverified', user.email);
  else startSync(user);
});

CloudSync.attach({
  signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
  async signUp(email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);
    CloudSync.end('unverified', email);
  },
  resetPassword: (email) => sendPasswordResetEmail(auth, email),
  resendVerification: () => sendEmailVerification(auth.currentUser),
  async recheckVerification() {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    if (!user.emailVerified) return false;
    await user.getIdToken(true); // refresh the token so the security rules see the verified email
    startSync(user);
    return true;
  },
  signOut: () => signOut(auth),
});
