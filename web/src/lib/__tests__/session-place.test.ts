/** iPhone: у Safari и у приложения с экрана «Домой» — свои сессии, скопированная при установке забывается. */

import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = "sb-abc-auth-token";

function device(ua: string, standalone: boolean, store: Map<string, string>) {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: ua, platform: "iPhone", maxTouchPoints: 5, standalone });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: standalone }) });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  return import("../session-place");
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)";
const ANDROID = "Mozilla/5.0 (Linux; Android 16; SM-S931B)";

describe("сессия Safari и приложения на iPhone", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("вход в Safari, затем установка: приложение забывает скопированную сессию, Safari — нет", async () => {
    const safari = new Map([[TOKEN, "s"]]);
    let m = await device(IPHONE, false, safari);
    m.rememberSessionPlace();
    m.forgetCopiedSession(TOKEN);
    expect(safari.get(TOKEN)).toBe("s");

    const app = new Map(safari); // iPhone копирует данные сайта при установке
    m = await device(IPHONE, true, app);
    m.forgetCopiedSession(TOKEN);
    expect(app.has(TOKEN)).toBe(false);
    // Вошли в приложении — теперь это его сессия, при следующем запуске она остаётся.
    app.set(TOKEN, "a");
    m.rememberSessionPlace();
    m.forgetCopiedSession(TOKEN);
    expect(app.get(TOKEN)).toBe("a");
  });

  it("старый вход без отметки: в Safari остаётся, в приложении — один раз войти заново", async () => {
    const safari = new Map([[TOKEN, "s"]]);
    (await device(IPHONE, false, safari)).forgetCopiedSession(TOKEN);
    expect(safari.get(TOKEN)).toBe("s");
    const app = new Map([[TOKEN, "s"]]);
    (await device(IPHONE, true, app)).forgetCopiedSession(TOKEN);
    expect(app.has(TOKEN)).toBe(false);
  });

  it("Android: у браузера и приложения одно хранилище — сессию не трогаем", async () => {
    const store = new Map([[TOKEN, "s"]]);
    const m = await device(ANDROID, false, store);
    m.rememberSessionPlace();
    (await device(ANDROID, true, store)).forgetCopiedSession(TOKEN);
    expect(store.get(TOKEN)).toBe("s");
  });
});
