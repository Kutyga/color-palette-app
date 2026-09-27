/**
 * Список «Хочу купить» в браузере.
 */
import type { WishlistRepository } from "../repositories";

import type { DemoState } from "./state";

export class DemoWishlist implements WishlistRepository {
  constructor(
    private state: DemoState,
    private persist: () => void,
  ) {}

  async list() {
    return [...(this.state.wishlist ?? [])];
  }

  async set(speciesId: string, wanted: boolean) {
    const cur = (this.state.wishlist ?? []).filter((x) => x !== speciesId);
    this.state.wishlist = wanted ? [speciesId, ...cur] : cur;
    this.persist();
  }
}
