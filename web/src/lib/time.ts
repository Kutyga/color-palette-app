/** Общие величины времени: чтобы не писать «магические» 86 400 000 по всему коду. */

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Полночь того же дня по местному времени. */
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
