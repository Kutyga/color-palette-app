"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import {
  SOIL_MATERIALS,
  SOIL_ROLES,
  componentVolumes,
  phLabel,
  soilParticles,
  type SoilMix,
} from "@/lib/domain/soil";
import { cx } from "./ui";

const fmt = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });

/** Полоса пропорций: каждый компонент — отрезок своей ширины и цвета. */
export function SoilBar({ mix, className }: { mix: SoilMix; className?: string }) {
  return (
    <div className={cx("flex h-4 overflow-hidden rounded-full ring-1 ring-separator", className)} role="img" aria-label={mix.components.map((c) => `${SOIL_MATERIALS[c.material].label} ${c.pct}%`).join(", ")}>
      {mix.components.map((c) => (
        <span key={c.material} style={{ width: `${c.pct}%`, background: SOIL_MATERIALS[c.material].color }} title={`${SOIL_MATERIALS[c.material].label} — ${c.pct}%`} />
      ))}
    </div>
  );
}

/** Разрез горшка: дренаж на дне, смесь из частиц в нужной пропорции, мульча сверху. */
function PotDiagram({ mix }: { mix: SoilMix }) {
  const id = useId().replace(/:/g, "");
  // Горшок-трапеция: верх 30..190, низ 55..165.
  const top = 78;
  const bottom = 232;
  const xAt = (y: number, side: "l" | "r") => {
    const t = (y - top) / (bottom - top);
    return side === "l" ? 30 + 25 * t : 190 - 25 * t;
  };
  const drainH = mix.drainage ? Math.min(44, Math.max(14, mix.drainage.cm * 7)) : 0;
  const topH = mix.topLayer ? 10 : 0;
  const soilTop = top + 6;
  const drainTop = bottom - drainH;
  const particles = soilParticles(mix, 150, mix.slug.length);
  const dominant = SOIL_MATERIALS[mix.components[0]?.material ?? "peat"].color;
  const labelX = 214;
  const layers: { y: number; text: string; sub?: string }[] = [];
  if (mix.topLayer) layers.push({ y: soilTop + topH / 2, text: "Мульча", sub: SOIL_MATERIALS[mix.topLayer.material].label.toLowerCase() });
  layers.push({ y: (soilTop + topH + drainTop) / 2, text: "Смесь" });
  if (mix.drainage) layers.push({ y: drainTop + drainH / 2, text: `Дренаж ${mix.drainage.cm} см`, sub: SOIL_MATERIALS[mix.drainage.material].label.toLowerCase() });

  const pebbles: { x: number; y: number; r: number }[] = [];
  if (mix.drainage) {
    for (let row = 0; row * 9 < drainH - 4; row++) {
      const y = bottom - 6 - row * 9;
      for (let x = xAt(y, "l") + 6 + (row % 2) * 5; x < xAt(y, "r") - 5; x += 10) pebbles.push({ x, y, r: 4.2 });
    }
  }

  return (
    <svg viewBox="0 0 320 250" className="w-full" role="img" aria-label={`Разрез горшка: ${layers.map((l) => (l.sub ? `${l.text} (${l.sub})` : l.text).toLowerCase()).join(", ")}`}>
      <defs>
        <clipPath id={`pot-${id}`}>
          <polygon points={`${xAt(top, "l")},${top} ${xAt(top, "r")},${top} ${xAt(bottom, "r")},${bottom} ${xAt(bottom, "l")},${bottom}`} />
        </clipPath>
        <linearGradient id={`pot-shade-${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </linearGradient>
      </defs>

      {/* Растение */}
      <g stroke="var(--leaf)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M110 86 C110 60 108 44 110 26" />
        <path d="M110 58 C94 50 80 52 70 40" />
        <path d="M110 46 C126 36 140 38 150 26" />
      </g>
      <g fill="var(--leaf)">
        <ellipse cx="66" cy="36" rx="16" ry="8" transform="rotate(-25 66 36)" />
        <ellipse cx="154" cy="22" rx="16" ry="8" transform="rotate(-20 154 22)" />
        <ellipse cx="110" cy="18" rx="8" ry="14" />
      </g>

      <g clipPath={`url(#pot-${id})`}>
        <rect x="0" y={soilTop} width="320" height={bottom - soilTop} fill={dominant} opacity="0.85" />
        {particles.map((p, i) => {
          const y = soilTop + topH + p.y * (drainTop - soilTop - topH);
          const x = xAt(y, "l") + p.x * (xAt(y, "r") - xAt(y, "l"));
          const m = SOIL_MATERIALS[p.material];
          return m.grain >= 2 ? (
            <rect key={i} x={x - p.r} y={y - p.r * 0.7} width={p.r * 2} height={p.r * 1.4} rx={p.r * 0.4} fill={m.color} transform={`rotate(${(i * 37) % 90} ${x} ${y})`} />
          ) : (
            <circle key={i} cx={x} cy={y} r={p.r} fill={m.color} />
          );
        })}
        {/* Корни */}
        <g stroke="#e8d9bf" strokeWidth="1.4" fill="none" opacity="0.9">
          <path d="M110 86 C104 110 96 126 84 150" />
          <path d="M110 86 C114 112 124 128 136 146" />
          <path d="M110 90 C110 120 108 140 112 166" />
        </g>
        {mix.topLayer && (
          <g>
            <rect x="0" y={soilTop} width="320" height={topH} fill={SOIL_MATERIALS[mix.topLayer.material].color} opacity="0.55" />
            {Array.from({ length: 22 }, (_, i) => (
              <circle key={i} cx={34 + i * 7.4} cy={soilTop + 3 + (i % 3) * 2.4} r={2.6} fill={SOIL_MATERIALS[mix.topLayer!.material].color} stroke="#0002" strokeWidth="0.5" />
            ))}
          </g>
        )}
        {mix.drainage && (
          <g>
            <rect x="0" y={drainTop} width="320" height={drainH} fill="#00000022" />
            {pebbles.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={SOIL_MATERIALS[mix.drainage!.material].color} stroke="#0003" strokeWidth="0.6" />
            ))}
          </g>
        )}
        <rect x="0" y={top} width="320" height={bottom - top} fill={`url(#pot-shade-${id})`} />
      </g>

      {/* Стенки, бортик и дренажное отверстие */}
      <polygon
        points={`${xAt(top, "l")},${top} ${xAt(top, "r")},${top} ${xAt(bottom, "r")},${bottom} ${xAt(bottom, "l")},${bottom}`}
        fill="none"
        stroke="var(--soil)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="22" y={top - 10} width="176" height="14" rx="4" fill="var(--soil)" />
      <rect x="100" y={bottom - 2} width="20" height="6" fill="var(--surface)" />
      <g fill="var(--water)">
        <path d="M106 240 q4 6 0 8 q-4 -2 0 -8z" />
        <path d="M114 244 q3 4 0 6 q-3 -2 0 -6z" />
      </g>

      {/* Подписи слоёв */}
      <g fontSize="11" fill="var(--secondary)">
        {layers.map((l) => (
          <g key={l.text}>
            <line x1={xAt(l.y, "r") + 2} y1={l.y} x2={labelX - 4} y2={l.y} stroke="var(--separator)" strokeWidth="1" />
            <circle cx={xAt(l.y, "r") + 2} cy={l.y} r="2" fill="var(--secondary)" />
            <text x={labelX} y={l.sub ? l.y : l.y + 4}>
              {l.text}
              {l.sub && (
                <tspan x={labelX} dy="13" fontSize="10" opacity="0.8">
                  {l.sub}
                </tspan>
              )}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

function Meter({ label, value, color, low, high }: { label: string; value: number; color: string; low: string; high: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-secondary">{value <= 2 ? low : value >= 4 ? high : "средне"}</span>
      </div>
      <div className="mt-1.5 flex gap-1" role="meter" aria-label={label} aria-valuemin={1} aria-valuemax={5} aria-valuenow={value}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i <= value ? color : "var(--surface-muted)" }} />
        ))}
      </div>
    </div>
  );
}

/** Шкала pH 3–9 с отмеченным диапазоном. */
function PhScale({ min, max }: { min: number; max: number }) {
  const pos = (v: number) => `${((Math.min(9, Math.max(3, v)) - 3) / 6) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="font-medium">Кислотность</span>
        <span className="text-secondary">
          pH {fmt(min)}–{fmt(max)} · {phLabel(min, max)}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full" style={{ background: "linear-gradient(90deg,#e5484d,#f5a524 30%,#8bc34a 55%,#2f80ed 85%,#6e56cf)" }}>
        <span
          className="absolute -top-1 h-4 rounded-full border-2 border-label bg-white/40"
          style={{ left: pos(min), width: `max(8px, calc(${pos(max)} - ${pos(min)}))` }}
          aria-hidden
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-secondary" aria-hidden>
        <span>3 кислый</span>
        <span>7 нейтр.</span>
        <span>9</span>
      </div>
    </div>
  );
}

const POT_SIZES = [0.5, 1, 2, 3, 5, 10];

/** Полная карточка: схема горшка, пропорции, свойства, калькулятор и советы. */
export function SoilSchematic({ mix, noteRu }: { mix: SoilMix; noteRu?: string | null }) {
  const [liters, setLiters] = useState(2);
  const volumes = componentVolumes(mix, liters);
  return (
    <section className="rounded-[20px] bg-surface p-5" aria-labelledby={`soil-${mix.slug}`}>
      <p className="text-[13px] font-medium text-soil">Состав грунта</p>
      <h3 id={`soil-${mix.slug}`} className="text-[22px] font-bold tracking-tight">
        {mix.nameRu}
      </h3>
      {mix.summaryRu && <p className="mt-1 text-[15px] text-secondary">{mix.summaryRu}</p>}
      {noteRu && <p className="mt-3 rounded-2xl bg-soil/10 px-4 py-3 text-[15px]">Для этого растения: {noteRu}</p>}

      <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
        <div className="rounded-2xl bg-muted/60 p-2">
          <PotDiagram mix={mix} />
        </div>
        <div>
          <SoilBar mix={mix} />
          <ul className="mt-4 space-y-2.5">
            {mix.components.map((c) => {
              const m = SOIL_MATERIALS[c.material];
              return (
                <li key={c.material} className="flex items-center gap-3">
                  <span className="size-4 shrink-0 rounded-md ring-1 ring-separator" style={{ background: m.color }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{m.label}</span>
                    <span className="block truncate text-[13px] text-secondary">
                      {SOIL_ROLES[c.role]} · {m.hint}
                    </span>
                  </span>
                  <span className="text-[17px] font-semibold tabular-nums">{c.pct}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 space-y-4">
            <Meter label="Влагоёмкость" value={mix.waterRetention} color="var(--water)" low="быстро сохнет" high="долго влажный" />
            <Meter label="Воздух для корней" value={mix.aeration} color="var(--mist)" low="плотный" high="очень рыхлый" />
            <PhScale min={mix.phMin} max={mix.phMax} />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-muted p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Сколько смешать</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Объём горшка">
            {POT_SIZES.map((l) => (
              <button
                key={l}
                onClick={() => setLiters(l)}
                aria-pressed={liters === l}
                className={cx("rounded-full px-3 py-1 text-[13px] font-medium", liters === l ? "bg-soil text-white" : "bg-surface")}
              >
                {fmt(l)} л
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">
          {volumes.map((v, i) => (
            <span key={v.material}>
              {i > 0 && " + "}
              <b className="tabular-nums">{fmt(v.liters)} л</b> {SOIL_MATERIALS[v.material].label.toLowerCase()}
            </span>
          ))}
          {mix.drainage && (
            <>
              {" "}
              и {mix.drainage.cm} см {SOIL_MATERIALS[mix.drainage.material].label.toLowerCase()} на дно
            </>
          )}
          .
        </p>
      </div>

      {mix.potRu && (
        <p className="mt-4 text-[15px] leading-relaxed">
          <b>Горшок.</b> {mix.potRu}
        </p>
      )}
      {mix.tipsRu.length > 0 && (
        <ul className="mt-3 space-y-2">
          {mix.tipsRu.map((t) => (
            <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-soil" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
      <Link href={`/plants/soil/#${mix.slug}`} className="mt-4 inline-block text-[15px] font-semibold text-soil">
        Все составы грунта →
      </Link>
    </section>
  );
}

/** Короткая версия для карточки растения в коллекции. */
export function SoilSummary({ mix, href }: { mix: SoilMix; href: string }) {
  return (
    <Link href={href} className="block rounded-[20px] bg-surface p-5 transition hover:brightness-[0.98]">
      <p className="flex items-center gap-2 text-[13px] font-medium text-soil">
        <Layers className="size-4" aria-hidden /> Грунт
      </p>
      <p className="mt-1 text-[17px] font-semibold">{mix.nameRu}</p>
      <SoilBar mix={mix} className="mt-3 h-3" />
      <p className="mt-2 text-[13px] text-secondary">
        {mix.components
          .slice(0, 4)
          .map((c) => `${SOIL_MATERIALS[c.material].label.toLowerCase()} ${c.pct}%`)
          .join(" · ")}
        {mix.components.length > 4 && " …"}
      </p>
    </Link>
  );
}
