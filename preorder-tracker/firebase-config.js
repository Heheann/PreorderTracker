export const FIREBASE_WEB_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAUAuvOXvng3owvIPX-emIzRH63sSDSvi8",
    authDomain: "heheprodect.firebaseapp.com",
    projectId: "heheprodect",
    storageBucket: "heheprodect.firebasestorage.app",
    messagingSenderId: "587752093224",
    appId: "1:587752093224:web:ecc78056cd9c1d8238271d",
  },
  vapidKey: "BEdlx5UMSJ-Az4QKQ_chniLLT8ZxYbkVIjntItmnn0-6Ts1k9h1MCpG44ZGIeHOcfaX68GkPyEnbC8UhDHafzQ",
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
