import { baseWaterInterval, type CareType } from "../domain/care";
import type { CareProfile } from "../domain/species";

export interface ScheduleSeed {
  type: CareType;
  intervalDays: number;
  lastDoneAt: Date | null;
}

/** Графики ухода для нового растения по данным базы знаний. Общая логика для Supabase и демо. */
export function initialSchedules(
  care: CareProfile | null,
  opts: { waterIntervalDays?: number | null; lastWateredAt?: Date | null },
): ScheduleSeed[] {
  const water = opts.waterIntervalDays ?? (care ? baseWaterInterval(care.waterIntervalSummer) : 7);
  const seeds: ScheduleSeed[] = [{ type: "water", intervalDays: water, lastDoneAt: opts.lastWateredAt ?? null }];
  if (care?.fertilizeIntervalDays) seeds.push({ type: "fertilize", intervalDays: care.fertilizeIntervalDays, lastDoneAt: null });
  if (care?.repotEveryYears) seeds.push({ type: "repot", intervalDays: care.repotEveryYears * 365, lastDoneAt: null });
  return seeds;
}
