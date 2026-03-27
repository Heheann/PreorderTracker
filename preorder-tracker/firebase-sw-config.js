// Keep this key in sync with `firebase-config.js`.
// Stage A key rotation: replace this single value after creating `web-pwa-prod` browser key.
const FIREBASE_BROWSER_API_KEY = "AIzaSyDqbrsBTIwyqeULakIfyDbGnzKYBZydnAQ";

self.FIREBASE_SW_CONFIG = {
  apiKey: FIREBASE_BROWSER_API_KEY,
  authDomain: "heheprodect.firebaseapp.com",
  projectId: "heheprodect",
  storageBucket: "heheprodect.firebasestorage.app",
  messagingSenderId: "587752093224",
  appId: "1:587752093224:web:ecc78056cd9c1d8238271d",
};
