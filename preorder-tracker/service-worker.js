const SW_VERSION = "2026-03-26-09";
const SHELL_CACHE = `preorder-shell-${SW_VERSION}`;
const RUNTIME_CACHE = `preorder-runtime-${SW_VERSION}`;

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./firebase-config.js",
  "./firebase-client.js",
  "./firebase-sw-config.js",
  "./db/indexeddb.js",
  "./components/productCard.js",
  "./components/dashboardCard.js",
  "./components/timeline.js",
  "./components/gallery.js",
  "./components/uiKit.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

bootFirebaseBackgroundMessaging();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event.request));
    return;
  }

  if (isStaticAsset(event.request)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(networkThenCache(event.request));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const itemId = event.notification?.data?.itemId || "";
  const targetUrl = itemId ? `./index.html?itemId=${encodeURIComponent(itemId)}&from=notification` : "./index.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if (typeof client.navigate === "function") {
            client.navigate(targetUrl).catch(() => undefined);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});

function isStaticAsset(request) {
  const destination = request.destination;
  return ["style", "script", "image", "font", "manifest"].includes(destination);
}

async function handleNavigation(request) {
  try {
    const fresh = await fetch(request);
    const runtime = await caches.open(RUNTIME_CACHE);
    runtime.put(request, fresh.clone());
    return fresh;
  } catch {
    const runtime = await caches.open(RUNTIME_CACHE);
    const cachedPage = await runtime.match(request, { ignoreSearch: true });
    if (cachedPage) return cachedPage;

    const shell = await caches.open(SHELL_CACHE);
    const shellIndex = await shell.match("./index.html", { ignoreSearch: true });
    if (shellIndex) return shellIndex;

    return shell.match("./offline.html", { ignoreSearch: true });
  }
}

async function staleWhileRevalidate(request) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        shell.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || networkPromise || fetch(request);
}

async function networkThenCache(request) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      runtime.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await runtime.match(request);
    if (cached) return cached;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

function hasFirebaseSwConfig(config) {
  if (!config) return false;
  const required = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
  return required.every((key) => Boolean(String(config[key] || "").trim()));
}

function bootFirebaseBackgroundMessaging() {
  try {
    importScripts("./firebase-sw-config.js");
    const config = self.FIREBASE_SW_CONFIG || null;
    if (!hasFirebaseSwConfig(config)) return;

    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
    importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

    if (!self.firebase?.apps?.length) {
      self.firebase.initializeApp(config);
    }

    const messaging = self.firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload?.data?.title || payload?.notification?.title || "付款提醒";
      const body = payload?.data?.body || payload?.notification?.body || "你有一筆付款提醒。";
      const itemId = payload?.data?.itemId || "";
      const eventType = payload?.data?.eventType || "";

      self.registration.showNotification(title, {
        body,
        icon: "./icons/icon-192.png",
        badge: "./icons/icon-192.png",
        data: { itemId, eventType },
      });
    });
  } catch (error) {
    console.info("Firebase Messaging 背景初始化略過", error);
  }
}
