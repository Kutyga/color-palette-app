/** График ухода: фактический интервал с поправками на сезон, горшок, свет и привычки хозяина. */

import { CARE_COLORS, CARE_ICONS } from "@/components/ui";
import { CARE_TYPES, POT_MATERIALS, effectiveIntervalDays, type CareSchedule } from "@/lib/domain/care";
import type { Plant } from "@/lib/domain/plant";
import { everyDays, relativeDay } from "@/lib/format";

export function CareScheduleList({ plant, schedules, now }: { plant: Plant; schedules: CareSchedule[]; now: Date }) {
  return (
    <>
      <ul className="divide-separator bg-surface divide-y rounded-[20px]">
        {schedules.map((s) => {
          const Icon = CARE_ICONS[s.type];
          const days = effectiveIntervalDays({
            type: s.type,
            intervalDays: s.intervalDays,
            userFactor: s.userFactor,
            autoAdjust: s.autoAdjust,
            month: now.getMonth() + 1,
            pot: plant.potMaterial,
            light: plant.lightLevel,
          });
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-5" style={{ color: CARE_COLORS[s.type] }} aria-hidden />
              <div className="flex-1">
                <p className="font-medium">{CARE_TYPES[s.type].label}</p>
                <p className="text-secondary text-[13px]">{everyDays(days)}</p>
              </div>
              <p className="text-secondary text-[15px]">{s.nextDueAt ? relativeDay(s.nextDueAt, now) : "—"}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-secondary mt-2 text-[13px]">
        Интервал учитывает сезон, горшок{plant.potMaterial ? ` (${POT_MATERIALS[plant.potMaterial].toLowerCase()})` : ""}, свет и то, как вы
        поливаете на самом деле.
      </p>
    </>
  );
}
