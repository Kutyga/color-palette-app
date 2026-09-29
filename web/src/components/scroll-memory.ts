"use client";

/**
 * Прокрутка области контента. Сайт прокручивает не окно, а свой блок (см. AppShell), поэтому
 * браузер сам не восстанавливает место при «Назад». Здесь: переход на новый экран — наверх,
 * «Назад»/«Вперёд» браузера — туда, где человек был (позиции живут в sessionStorage вкладки).
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const STORAGE_KEY = "scroll-positions";

function loadPositions(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function useScrollMemory(ref: RefObject<HTMLElement | null>, pathname: string) {
  const positions = useRef<Record<string, number>>({});
  const page = useRef("");
  const historyNav = useRef(false);

  useEffect(() => {
    positions.current = loadPositions();
    const el = ref.current;
    let timer: number | undefined;
    const onPopState = () => {
      historyNav.current = true;
    };
    const onScroll = () => {
      if (!el || !page.current) return;
      positions.current[page.current] = el.scrollTop;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions.current));
        } catch {
          // Приватный режим без хранилища — помним только до перезагрузки.
        }
      }, 200);
    };
    window.addEventListener("popstate", onPopState);
    el?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("popstate", onPopState);
      el?.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [ref]);

  // Синхронно при смене экрана: браузер обрезает прокрутку под новую, более короткую страницу,
  // и это событие не должно записаться как место на прежней странице.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const key = pathname + window.location.search;
    page.current = key;
    const target = historyNav.current ? (positions.current[key] ?? 0) : 0;
    historyNav.current = false;
    el.scrollTo(0, 0);
    if (!target) return;

    // Список может дорисоваться не сразу (данные из кэша, картинки) — пробуем, пока хватит высоты,
    // но не дольше пары секунд и не вопреки человеку, который уже сам начал листать.
    let frame = 0;
    const started = performance.now();
    const stop = () => cancelAnimationFrame(frame);
    const restore = () => {
      el.scrollTop = target;
      if (Math.abs(el.scrollTop - target) > 2 && performance.now() - started < 2000) frame = requestAnimationFrame(restore);
    };
    restore();
    el.addEventListener("wheel", stop, { once: true, passive: true });
    el.addEventListener("touchstart", stop, { once: true, passive: true });
    return () => {
      stop();
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchstart", stop);
    };
  }, [ref, pathname]);
}
