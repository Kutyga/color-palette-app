/** «Последний полив»: от него считается первый срок полива нового растения. */

import { cx } from "@/components/ui";

const OPTIONS = [
  { label: "Сегодня", days: 0 },
  { label: "Вчера", days: 1 },
  { label: "3 дня назад", days: 3 },
  { label: "Неделю назад", days: 7 },
  { label: "Давно / не помню", days: null },
] as const;

/** Сколько дней назад поливали; null — не помнят (график начнётся с сегодняшнего дня). */
export type DaysAgo = (typeof OPTIONS)[number]["days"];

/** Дата полива: 10 утра того дня — время не спрашиваем, а середина дня не уводит срок на соседние сутки. */
export function wateredAt(daysAgo: DaysAgo, now = new Date()): Date | null {
  return daysAgo == null ? null : new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 10);
}

export function LastWateredPicker({ value, onChange }: { value: DaysAgo; onChange: (v: DaysAgo) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.days)}
          aria-pressed={value === o.days}
          className={cx("rounded-full px-4 py-2 text-[15px]", value === o.days ? "bg-label text-bg" : "bg-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
