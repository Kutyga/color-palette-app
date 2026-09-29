/**
 * Программы подкормки из справочника public.fertilizers: какое удобрение (ориентир N:P:K),
 * в какой дозе, как понять недокорм и перекорм. Как часто и в какие месяцы — в профиле ухода вида.
 */

export interface Fertilizer {
  slug: string;
  nameRu: string;
  summaryRu: string;
  /** Соотношение N:P:K на этикетке; null — удобрять не нужно (хищные растения). */
  npk: [number, number, number] | null;
  formRu: string;
  doseRu: string;
  signsUnderRu: string[];
  signsOverRu: string[];
  tipsRu: string[];
}

type Row = Record<string, unknown>;
const ru = <T>(v: unknown, fallback: T): T => (v as { ru?: T } | null)?.ru ?? fallback;

export function fertilizerFromRow(r: Row): Fertilizer {
  const npk = r.npk as number[] | null;
  return {
    slug: r.slug as string,
    nameRu: ru(r.name, r.slug as string),
    summaryRu: ru(r.summary, ""),
    npk: npk && npk.length === 3 ? [Number(npk[0]), Number(npk[1]), Number(npk[2])] : null,
    formRu: ru(r.form, ""),
    doseRu: ru(r.dose, ""),
    signsUnderRu: ru(r.signs_under, [] as string[]),
    signsOverRu: ru(r.signs_over, [] as string[]),
    tipsRu: ru(r.tips, [] as string[]),
  };
}

/** Доли N, P и K в процентах от суммы — для полосок на карточке. */
export function npkShares(npk: [number, number, number]): [number, number, number] {
  const sum = npk[0] + npk[1] + npk[2] || 1;
  return npk.map((v) => Math.round((v / sum) * 100)) as [number, number, number];
}
