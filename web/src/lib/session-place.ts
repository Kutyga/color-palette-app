/**
 * Своя сессия у Safari и у приложения с экрана «Домой» на iPhone.
 *
 * При установке iPhone копирует данные сайта в приложение — и вход тоже. Дальше у Safari и у приложения
 * разные хранилища, но сессия одна: каждый по очереди обновляет её токен. Тот, кто отстал, приходит
 * со старым токеном — Supabase считает его украденным и завершает сессию везде («приходится входить заново»).
 *
 * Поэтому запоминаем, где сессия создана. Если приложение нашло у себя вход, скопированный из Safari
 * (или созданный до этой проверки), — просто забывает его, без запроса к серверу: в Safari вход остаётся,
 * а в приложении нужно один раз войти, и дальше у каждого своя сессия.
 * На Android у браузера и приложения одно хранилище и одна сессия — там ничего делать не нужно.
 */

import { isIos, isStandalone } from "./device";

const KEY = "podokonnik-session-place";

const place = () => (isStandalone() ? "app" : "browser");

/** До создания клиента Supabase: убрать чужую (скопированную) сессию. */
export function forgetCopiedSession(storageKey: string) {
  try {
    if (!isIos() || !localStorage.getItem(storageKey)) return;
    const owner = localStorage.getItem(KEY);
    if (owner === place()) return;
    if (owner === null && place() === "browser") {
      localStorage.setItem(KEY, "browser"); // вход в Safari, сделанный до этой проверки, — его и оставляем
      return;
    }
    localStorage.removeItem(storageKey);
  } catch {
    // хранилище недоступно — сессии в нём тоже нет
  }
}

/** После входа: сессия принадлежит этому месту. */
export function rememberSessionPlace() {
  try {
    if (isIos()) localStorage.setItem(KEY, place());
  } catch {
    // без хранилища вход всё равно не сохранится
  }
}
