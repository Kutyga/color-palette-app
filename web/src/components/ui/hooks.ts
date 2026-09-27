"use client";

/**
 * Общие хуки интерфейса.
 */

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** true только в браузере: даты и «сейчас» не должны попадать в заранее собранный HTML. */
export function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
