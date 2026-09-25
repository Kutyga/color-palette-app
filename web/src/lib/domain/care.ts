/** Виды ухода. Значения совпадают с enum `care_type` в Postgres. */
export const CARE_TYPES = {
  water: { label: "Полив", action: "Полить" },
  fertilize: { label: "Подкормка", action: "Подкормить" },
  mist: { label: "Опрыскивание", action: "Опрыскать" },
  repot: { label: "Пересадка", action: "Пересадить" },
  prune: { label: "Обрезка", action: "Обрезать" },
  rotate: { label: "Поворот", action: "Повернуть" },
  clean_leaves: { label: "Чистка листьев", action: "Протереть листья" },
  treat_pests: { label: "Обработка", action: "Обработать" },
} as const;

export type CareType = keyof typeof CARE_TYPES;
export const CARE_TYPE_ORDER = Object.keys(CARE_TYPES) as CareType[];

export const LIGHT_LEVELS = {
  low: "Тень",
  medium: "Полутень",
  bright_indirect: "Яркий рассеянный",
  direct: "Прямое солнце",
} as const;
export type LightLevel = keyof typeof LIGHT_LEVELS;

export const POT_MATERIALS = {
  plastic: "Пластик",
  ceramic: "Керамика",
  terracotta: "Терракота",
  glass: "Стекло",
  other: "Другое",
} as const;
export type PotMaterial = keyof typeof POT_MATERIALS;

export type Hemisphere = "N" | "S";

const DAY_MS = 86_400_000;

/**
 * Расчёт интервалов ухода. Повторяет SQL-функции из
 * supabase/migrations/20260924133411_care_logic.sql — менять синхронно.
 * Сервер — источник истины; клиент считает то же самое для демо-режима.
 */
export const MIN_INTERVAL_DAYS = 0.5;

/** Зима — период покоя (поливаем реже), лето — активный рост (чаще). */
export function seasonFactor(month: number, hemisphere: Hemisphere = "N"): number {
  const m = hemisphere === "S" ? ((month + 5) % 12) + 1 : month;
  if (m === 12 || m === 1 || m === 2) return 1.4;
  if (m >= 6 && m <= 8) return 0.85;
  return 1.0;
}

export function potFactor(material?: PotMaterial | null): number {
  if (material === "terracotta") return 0.85;
  if (material === "plastic" || material === "glass") return 1.1;
  return 1.0;
}

export function lightFactor(light?: LightLevel | null): number {
  switch (light) {
    case "low":
      return 1.25;
    case "medium":
      return 1.1;
    case "direct":
      return 0.85;
    default:
      return 1.0;
  }
}

/** Округление как у numeric в Postgres (поправка на двоичное представление: 6.545 → 6.55). */
function round(value: number, digits: 1 | 2): number {
  const p = digits === 1 ? 10 : 100;
  return Math.round(value * p + 1e-9) / p;
}

export function effectiveIntervalDays(opts: {
  type: CareType;
  intervalDays: number;
  userFactor?: number;
  autoAdjust?: boolean;
  month: number;
  hemisphere?: Hemisphere;
  pot?: PotMaterial | null;
  light?: LightLevel | null;
}): number {
  const { type, intervalDays, userFactor = 1, autoAdjust = true, month, hemisphere = "N", pot, light } = opts;
  let adjustment = 1;
  if (autoAdjust) {
    if (type === "water") adjustment = seasonFactor(month, hemisphere) * potFactor(pot) * lightFactor(light);
    else if (type === "mist") adjustment = seasonFactor(month, hemisphere);
  }
  const days = round(intervalDays * userFactor * adjustment, 1);
  return days < MIN_INTERVAL_DAYS ? MIN_INTERVAL_DAYS : days;
}

export function nextDue(lastDone: Date, intervalDays: number): Date {
  return new Date(lastDone.getTime() + Math.round(intervalDays * 86_400) * 1000);
}

/**
 * Подстраивает коэффициент под привычки: если пользователь стабильно поливает раньше
 * или позже графика, интервал плавно смещается. Сильные отклонения не учитываются.
 */
export function adjustUserFactor(current: number, expectedDays: number, actualDays: number): number {
  const ratio = actualDays / expectedDays;
  if (ratio < 0.5 || ratio > 1.5) return current;
  return Math.min(3, Math.max(0.3, round(current * (0.8 + 0.2 * ratio), 2)));
}

/** Базовый интервал полива из базы знаний: летнее значение, приведённое к межсезонью. */
export function baseWaterInterval(summerIntervalDays: number): number {
  return round(summerIntervalDays / 0.85, 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}

export interface CareSchedule {
  id: string;
  plantId: string;
  type: CareType;
  intervalDays: number;
  autoAdjust: boolean;
  userFactor: number;
  lastDoneAt: Date | null;
  nextDueAt: Date | null;
  enabled: boolean;
}

export interface CareEvent {
  id: string;
  plantId: string;
  type: CareType;
  performedAt: Date;
  note: string | null;
}

/** Задача на экране «Сегодня»: что и какому растению нужно сделать. */
export interface CareTask {
  scheduleId: string;
  plantId: string;
  plantName: string;
  type: CareType;
  dueAt: Date;
}

export type TaskBucket = "overdue" | "today" | "soon";

export function taskBucket(task: CareTask, now: Date): TaskBucket {
  const today = startOfDay(now);
  if (task.dueAt < today) return "overdue";
  if (task.dueAt < new Date(today.getTime() + DAY_MS)) return "today";
  return "soon";
}

type Row = Record<string, unknown>;
const date = (v: unknown) => (v == null ? null : new Date(v as string));

export function scheduleFromRow(r: Row): CareSchedule {
  return {
    id: r.id as string,
    plantId: r.plant_id as string,
    type: r.type as CareType,
    intervalDays: Number(r.interval_days),
    autoAdjust: (r.auto_adjust as boolean | undefined) ?? true,
    userFactor: r.user_factor == null ? 1 : Number(r.user_factor),
    lastDoneAt: date(r.last_done_at),
    nextDueAt: date(r.next_due_at),
    enabled: (r.enabled as boolean | undefined) ?? true,
  };
}

export function eventFromRow(r: Row): CareEvent {
  return {
    id: r.id as string,
    plantId: r.plant_id as string,
    type: r.type as CareType,
    performedAt: new Date(r.performed_at as string),
    note: (r.note as string | null) ?? null,
  };
}

export function taskFromRow(r: Row): CareTask {
  return {
    scheduleId: r.schedule_id as string,
    plantId: r.plant_id as string,
    plantName: r.nickname as string,
    type: r.type as CareType,
    dueAt: new Date(r.next_due_at as string),
  };
}
