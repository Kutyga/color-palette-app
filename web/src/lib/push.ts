/**
 * Web Push в браузере: регистрация сервис-воркера и подписка. На сервере — таблица
 * push_subscriptions и Edge Function push (supabase/functions/push).
 * На iPhone уведомления работают только у сайта, добавленного на экран «Домой» (iOS 16.4+).
 */
import { BASE_PATH } from "./config";
import type { NotificationsRepository } from "./data/types";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install";

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ok) return "supported";
  return isIos() && !isStandalone() ? "ios-needs-install" : "unsupported";
}

const SW_URL = `${BASE_PATH}/sw.js`;
const SW_SCOPE = `${BASE_PATH}/`;

async function registration() {
  return (await navigator.serviceWorker.getRegistration(SW_SCOPE)) ?? navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function keyBytes(base64url: string) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Спросить разрешение, подписать браузер и сохранить подписку на сервере. */
export async function enablePush(repo: NotificationsRepository): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Уведомления запрещены в настройках браузера. Разрешите их для этого сайта и попробуйте снова."
        : "Разрешение не получено",
    );
  }
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const publicKey = await repo.publicKey();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await repo.subscribe({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, navigator.userAgent);
  await repo.updateSettings({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
}

/** Отписать этот браузер. */
export async function disablePush(repo: NotificationsRepository): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await repo.unsubscribe(sub.endpoint);
  await sub.unsubscribe();
}
