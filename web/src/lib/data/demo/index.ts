/**
 * Демо-режим: те же репозитории, что и у боевого бэкенда, но данные живут в браузере.
 * Используется без регистрации и в тестах; повторяет правила серверных триггеров.
 */
import type { Backend } from "../repositories";
import { DemoChat } from "./chat";
import { DemoContests } from "./contests";
import { DEFAULT_PROFILE } from "./fixtures";
import { DemoGarden } from "./garden";
import { DemoMarket } from "./market";
import { DemoPeople } from "./people";
import { seedContests, seedDemo, seedListings, seedShops } from "./seed";
import { DemoShops } from "./shops";
import { DemoSocial } from "./social";
import { type DemoStorage, emptyState } from "./state";
import { DemoWishlist } from "./wishlist";

/**
 * Демо-бэкенд: все репозитории работают в браузере поверх одного состояния.
 * clock подменяется в тестах, чтобы сроки ухода не зависели от текущей даты.
 */
export async function demoBackend(storage: DemoStorage, clock: () => Date = () => new Date()): Promise<Backend> {
  let state = storage.load();
  if (!state || state.version !== 1) {
    state = emptyState();
    await seedDemo(state, clock);
    storage.save(state);
  }
  const s = state;
  const persist = () => storage.save(s);
  if (!s.listings || !s.shops || !s.contests) {
    seedListings(s, clock());
    seedShops(s, clock());
    await seedContests(s, clock());
    persist();
  }
  return {
    mode: "demo",
    garden: new DemoGarden(s, persist, clock),
    social: new DemoSocial(s, persist, clock),
    people: new DemoPeople(s, persist),
    market: new DemoMarket(s, persist, clock),
    chat: new DemoChat(s, persist, clock),
    contests: new DemoContests(s, persist, clock),
    shops: new DemoShops(s, persist, clock),
    wishlist: new DemoWishlist(s, persist),
    notifications: null,
    identifier: null,
    profile: async () => ({ ...DEFAULT_PROFILE, ...s.profile }),
  };
}
export { localDemoStorage, memoryDemoStorage, type DemoState, type DemoStorage } from "./state";
