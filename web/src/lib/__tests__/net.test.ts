/** Запасной путь через свой домен: включается надолго, только если Supabase напрямую правда недоступен. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SB = "https://abc.supabase.co";

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SB);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  const store = new Map<string, string>();
  vi.stubGlobal("window", { location: { origin: "https://site.ru" } });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
  });
  return import("../net");
}

describe("resilientFetch", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("разовый обрыв: запрос уходит через прокси, но прямой путь работает — прокси не включается", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url === `${SB}/rest/v1/plants`) throw new TypeError("Load failed");
      return new Response("ok");
    });
    const net = await load();
    const res = await net.resilientFetch(`${SB}/rest/v1/plants`);
    expect(await res.text()).toBe("ok");
    expect(calls).toContain("https://site.ru/sb/rest/v1/plants");
    await vi.waitFor(() => expect(calls).toContain(`${SB}/auth/v1/health`));
    await new Promise((r) => setTimeout(r, 0));
    expect(net.proxyMode()).toBe(false);
  });

  it("Supabase недоступен напрямую — включается прокси для следующих запросов", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(url);
      if (url.startsWith(SB)) throw new TypeError("Failed to fetch");
      return new Response("ok");
    });
    const net = await load();
    await net.resilientFetch(`${SB}/rest/v1/plants`);
    await vi.waitFor(() => expect(net.proxyMode()).toBe(true));
    calls.length = 0;
    await net.resilientFetch(`${SB}/rest/v1/posts`);
    expect(calls).toEqual(["https://site.ru/sb/rest/v1/posts"]);
  });
});
