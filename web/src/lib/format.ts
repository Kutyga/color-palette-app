/** Форматирование для интерфейса: склонение чисел, относительные даты, интервалы. */

import { DAY_MS, startOfDay } from "./time";

/** Русское склонение: plural(3, "растение", "растения", "растений") → «растения». */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** «сегодня», «вчера», «3 дня назад», «завтра», «через 5 дней». */
export function relativeDay(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (diff === 0) return "сегодня";
  if (diff === -1) return "вчера";
  if (diff === 1) return "завтра";
  const n = Math.abs(diff);
  let span = `${n} ${plural(n, "день", "дня", "дней")}`;
  if (n >= 330) {
    const y = Math.round(n / 365);
    span = `${y} ${plural(y, "год", "года", "лет")}`;
  } else if (n >= 45) {
    const m = Math.round(n / 30);
    span = `${m} ${plural(m, "месяц", "месяца", "месяцев")}`;
  }
  return diff < 0 ? `${span} назад` : `через ${span}`;
}

/** Для ленты: «5 мин», «3 ч», «2 дн», затем дата. */
export function timeAgo(date: Date, now = new Date()): string {
  const min = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн`;
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

/** «понедельник, 27 сентября» */
export const formatDate = (d: Date) => d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

/** «27 сент.» */
export const formatShortDate = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

/** «каждые 7 дн.» / «каждые 6,5 дн.» */
export function everyDays(days: number): string {
  const v = Number.isInteger(days) ? String(days) : days.toFixed(1).replace(".", ",");
  return `каждые ${v} дн.`;
}

export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Сколько осталось до даты: «2 дн. 5 ч», «3 ч 20 мин», «10 мин». */
export function timeLeft(to: Date, now = new Date()): string {
  const min = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / 60_000));
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  if (days > 0) return hours ? `${days} дн. ${hours} ч` : `${days} дн.`;
  if (hours > 0) return min % 60 ? `${hours} ч ${min % 60} мин` : `${hours} ч`;
  return `${min} мин`;
}
