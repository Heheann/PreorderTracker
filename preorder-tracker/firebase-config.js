// Stage A key rotation: replace this single value after creating `web-pwa-prod` browser key.
const FIREBASE_BROWSER_API_KEY = "AIzaSyDqbrsBTIwyqeULakIfyDbGnzKYBZydnAQ";

export const FIREBASE_WEB_CONFIG = {
  firebase: {
    apiKey: FIREBASE_BROWSER_API_KEY,
    authDomain: "heheprodect.firebaseapp.com",
    projectId: "heheprodect",
    storageBucket: "heheprodect.firebasestorage.app",
    messagingSenderId: "587752093224",
    appId: "1:587752093224:web:ecc78056cd9c1d8238271d",
  },
  vapidKey: "BDhT-N6MXq2PzTcmo_Gmq3W_dAO_KL6rzOv8SXIRWwUs4YyPjdAULOI07Z-eJUhEt69xCwqrXK1vpwfO4HqFSWw",
  apiBaseUrl: "https://asia-east1-heheprodect.cloudfunctions.net",
  apiSecret: "",
};

export function hasFirebaseWebConfig(config) {
  if (!config) return false;
  const firebase = config.firebase || {};
  const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
  const hasFirebase = required.every((key) => Boolean(String(firebase[key] || "").trim()));
  const hasVapid = Boolean(String(config.vapidKey || "").trim());
  const hasApiBaseUrl = Boolean(String(config.apiBaseUrl || "").trim());
  return hasFirebase && hasVapid && hasApiBaseUrl;
}
