/** Программа подкормки на странице вида: ориентир N:P:K, доза, признаки недокорма и перекорма. */

import { Ban, FlaskConical } from "lucide-react";
import { npkShares, type Fertilizer } from "@/lib/domain/fertilizer";

const NUTRIENTS = [
  { key: "N", label: "Азот", role: "листья и рост", color: "var(--leaf)" },
  { key: "P", label: "Фосфор", role: "корни и цветение", color: "var(--soil)" },
  { key: "K", label: "Калий", role: "прочность и плоды", color: "var(--water)" },
] as const;

function Signs({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="bg-muted rounded-2xl p-4">
      <p className="text-[13px] font-semibold" style={{ color: tone }}>
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-[14px] leading-snug">
        {items.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: tone }} aria-hidden />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FertilizerCard({ program }: { program: Fertilizer }) {
  const shares = program.npk ? npkShares(program.npk) : null;
  return (
    <section className="bg-surface rounded-[20px] p-5" aria-labelledby="fertilizer-title">
      <h3 id="fertilizer-title" className="flex items-center gap-2 text-[17px] font-semibold">
        {program.npk ? <FlaskConical className="text-soil size-5" aria-hidden /> : <Ban className="text-alert size-5" aria-hidden />}
        Подкормка: {program.nameRu.toLowerCase()}
      </h3>
      <p className="text-secondary mt-2 text-[15px] leading-relaxed">{program.summaryRu}</p>

      {program.npk && shares && (
        <div className="mt-4">
          <p className="text-[13px] font-medium">Ориентир на этикетке — N:P:K ≈ {program.npk.join(":")}</p>
          <div
            className="mt-2 flex h-3 overflow-hidden rounded-full"
            role="img"
            aria-label={`Азот ${shares[0]}%, фосфор ${shares[1]}%, калий ${shares[2]}%`}
          >
            {NUTRIENTS.map((n, i) => (
              <span key={n.key} style={{ width: `${shares[i]}%`, background: n.color }} />
            ))}
          </div>
          <ul className="text-secondary mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
            {NUTRIENTS.map((n) => (
              <li key={n.key} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: n.color }} aria-hidden />
                <b className="text-label font-semibold">{n.key}</b> {n.label.toLowerCase()} — {n.role}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-2">
        <div>
          <dt className="text-secondary text-[13px]">Что взять</dt>
          <dd className="mt-0.5 leading-snug">{program.formRu}</dd>
        </div>
        <div>
          <dt className="text-secondary text-[13px]">Сколько</dt>
          <dd className="mt-0.5 leading-snug">{program.doseRu}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Signs title="Не хватает питания" items={program.signsUnderRu} tone="var(--soil)" />
        <Signs title="Перекорм" items={program.signsOverRu} tone="var(--alert)" />
      </div>

      {program.tipsRu.length > 0 && (
        <ul className="mt-4 space-y-2">
          {program.tipsRu.map((t) => (
            <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="bg-soil mt-2 size-1.5 shrink-0 rounded-full" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
