import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js";

const DEVICE_ID_KEY = "preorderTrackerDeviceId";

function hasFirebaseValues(config) {
  if (!config) return false;
  const firebase = config.firebase || {};
  const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
  return required.every((key) => Boolean(String(firebase[key] || "").trim()));
}

export function createDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function getNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export async function setupFirebaseMessaging(config, serviceWorkerRegistration) {
  if (!serviceWorkerRegistration || !("serviceWorker" in navigator)) {
    return { supported: false, fetchToken: async () => "" };
  }
  if (!hasFirebaseValues(config) || !config.vapidKey) {
    return { supported: false, fetchToken: async () => "" };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { supported: false, fetchToken: async () => "" };
  }

  const app = getApps()[0] || initializeApp(config.firebase);
  const messaging = getMessaging(app);

  return {
    supported: true,
    fetchToken: async () =>
      getToken(messaging, {
        vapidKey: config.vapidKey,
        serviceWorkerRegistration,
      }),
  };
}

export async function postJson(url, payload, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") && text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.error || text || `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return data;
}
