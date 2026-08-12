/**
 * Firebase config for Geo-Land.
 *
 * 1. Create a project at https://console.firebase.google.com
 * 2. Enable Firestore (production mode, then paste rules from SETUP.md)
 * 3. Project settings → Your apps → Web app → copy config below
 * 4. Set enabled: true
 *
 * Until then, the app uses localStorage (single-device only).
 */
window.FIREBASE_CONFIG = {
  enabled: false,
  // Paste your Firebase web config:
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
