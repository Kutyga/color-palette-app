// Сервис-воркер «Подоконника»: push-уведомления и хранилище фото. Страницы не кэширует.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Фото из Supabase Storage (…/storage/v1/object/sign/{бакет}/{путь}?token=…). Путь у каждого фото
// свой и не меняется, а ссылка меняется при каждой подписи — поэтому храним по пути, без токена:
// одно фото скачивается из Supabase один раз на устройство (так экономится трафик Supabase).
// Файлы не меняются — берём из хранилища без перепроверки, копию не сжимаем.
const PHOTOS = "photos-v1";
const MAX_PHOTOS = 400;
const PHOTO_RE = /\/storage\/v1\/object\/sign\/([^?]+)/;

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_PHOTOS))) await cache.delete(k);
}

async function photo(request, path) {
  const key = self.registration.scope + "__photo/" + path;
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(key);
  if (hit) return hit;
  let res;
  try {
    // CORS-запрос, чтобы ответ был «прозрачным» и его можно было проверить и сохранить.
    res = await fetch(request.url, { mode: "cors", credentials: "omit" });
  } catch {
    return fetch(request); // как раньше, без хранения
  }
  if (res.ok) {
    await cache.put(key, res.clone());
    trim(cache);
  }
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const m = PHOTO_RE.exec(request.url);
  if (m) event.respondWith(photo(request, m[1]));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const scope = self.registration.scope;
  const url = new URL(String(data.url || "/today/").replace(/^\//, ""), scope).href;
  event.waitUntil(
    self.registration.showNotification(data.title || "Подоконник", {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: scope + "icon.svg",
      badge: scope + "icon.svg",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
