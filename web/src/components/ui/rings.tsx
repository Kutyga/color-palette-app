"use client";

/**
 * Кольца прогресса в стиле Apple Fitness.
 */

import type { ReactNode } from "react";

/** Кольцо прогресса как в Apple Fitness. */
export function ProgressRing({
  progress,
  color = "var(--leaf)",
  size = 64,
  stroke = 8,
  children,
  label,
}: {
  progress: number;
  color?: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/**
 * Несколько колец одно в другом (как «Активность» в iOS). Все рисуются в одном SVG от одного
 * центра, поэтому всегда строго концентричны и одной толщины.
 */
export function ActivityRings({
  rings,
  size = 88,
  stroke = 10,
  gap = 3,
}: {
  rings: { progress: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  gap?: number;
}) {
  const center = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block shrink-0"
      role="img"
      aria-label={rings.map((r) => `${r.label}: ${Math.round(Math.max(0, Math.min(1, r.progress)) * 100)}%`).join(", ")}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        {rings.map((ring, i) => {
          const r = center - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(1, ring.progress));
          return (
            <g key={ring.label}>
              <circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeOpacity={0.18} strokeWidth={stroke} />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - p)}
                style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
