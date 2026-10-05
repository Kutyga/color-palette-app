"use client";

/**
 * Просмотр фото на весь экран: приближение двумя пальцами, колёсиком или двойным касанием,
 * перетаскивание приближенного снимка, листание (если фото несколько), закрытие — крестик,
 * Esc или смахивание вниз.
 */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { cx } from "./cx";

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
/** Насколько нужно провести пальцем, чтобы перелистнуть или закрыть (при обычном масштабе). */
const SWIPE_PX = 60;

interface View {
  scale: number;
  x: number;
  y: number;
}
const RESET: View = { scale: 1, x: 0, y: 0 };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Приближенный снимок не уводим за край: сдвиг — не больше «лишней» ширины и высоты. */
function bounded(v: View): View {
  const maxX = ((v.scale - 1) * window.innerWidth) / 2;
  const maxY = ((v.scale - 1) * window.innerHeight) / 2;
  return { scale: v.scale, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
}

export function PhotoViewer({ urls, start = 0, alt, onClose }: { urls: string[]; start?: number; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const [view, setView] = useState<View>(RESET);
  // Пальцы на экране и состояние жеста: с чего начали, чтобы считать сдвиг и масштаб.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number }; start: { x: number; y: number } } | null>(null);
  const lastTap = useRef(0);
  const [dragY, setDragY] = useState(0);
  // Пока палец на экране, снимок следует за ним без анимации.
  const [touching, setTouching] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);

  const go = (delta: number) => {
    setIndex((i) => clamp(i + delta, 0, urls.length - 1));
    setView(RESET);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // go меняет только состояние — перевешивать обработчик не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function snapshot(v: View) {
    const pts = [...pointers.current.values()];
    const [a, b] = pts;
    const mid = b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    gesture.current = { view: v, dist: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0, mid, start: mid };
  }

  function onDown(e: ReactPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouching(true);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    snapshot(view);
  }

  function onMove(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = clamp((g.view.scale * dist) / (g.dist || dist), 1, MAX_SCALE);
      setView(bounded({ scale, x: g.view.x + mid.x - g.mid.x, y: g.view.y + mid.y - g.mid.y }));
    } else if (g.view.scale > 1) {
      setView(bounded({ ...g.view, x: g.view.x + pts[0].x - g.mid.x, y: g.view.y + pts[0].y - g.mid.y }));
    } else {
      // Без приближения: вертикально — смахнуть, чтобы закрыть.
      const dy = pts[0].y - g.start.y;
      const dx = pts[0].x - g.start.x;
      setDragY(Math.abs(dy) > Math.abs(dx) ? dy : 0);
    }
  }

  function onUp(e: ReactPointerEvent) {
    const g = gesture.current;
    const p = pointers.current.get(e.pointerId);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // Один палец отпустили — продолжаем жест вторым.
      snapshot(view);
      return;
    }
    gesture.current = null;
    setTouching(false);
    setDragY(0);
    if (!g || !p) return;
    const dx = p.x - g.start.x;
    const dy = p.y - g.start.y;
    if (view.scale <= 1.01) {
      setView(RESET);
      if (Math.abs(dy) > SWIPE_PX * 1.5 && Math.abs(dy) > Math.abs(dx)) return onClose();
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
    }
    // Двойное касание: приблизить к точке касания или вернуть как было.
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        if (view.scale > 1) setView(RESET);
        else {
          const cx = p.x - window.innerWidth / 2;
          const cy = p.y - window.innerHeight / 2;
          setView(bounded({ scale: DOUBLE_TAP_SCALE, x: -cx * (DOUBLE_TAP_SCALE - 1), y: -cy * (DOUBLE_TAP_SCALE - 1) }));
        }
      } else lastTap.current = now;
    }
  }

  function onWheel(e: ReactWheelEvent) {
    const scale = clamp(view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, MAX_SCALE);
    setView(scale === 1 ? RESET : bounded({ ...view, scale }));
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label={`Фото: ${alt}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      <div
        className="relative size-full touch-none overflow-hidden select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
        style={{ opacity: 1 - Math.min(Math.abs(dragY) / 400, 0.6) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- подписанные ссылки Storage и data URL */}
        <img
          src={urls[index]}
          alt={urls.length > 1 ? `${alt}, фото ${index + 1}` : alt}
          draggable={false}
          className={cx("size-full object-contain", !touching && "transition-transform duration-200")}
          style={{ transform: `translate(${view.x}px, ${view.y + dragY}px) scale(${view.scale})` }}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть фото"
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-10 place-items-center rounded-full bg-white/15 backdrop-blur"
      >
        <X className="size-5" />
      </button>
      {urls.length > 1 && (
        <>
          <span className="absolute top-[max(1.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 text-[14px] font-semibold tabular-nums">
            {index + 1} / {urls.length}
          </span>
          {index > 0 && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Предыдущее фото"
              className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 sm:grid"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          {index < urls.length - 1 && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Следующее фото"
              className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 sm:grid"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </>
      )}
    </dialog>
  );
}
