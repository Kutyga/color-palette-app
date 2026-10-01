/**
 * Фитильный полив: подходит ли он виду. Фитиль держит грунт равномерно влажным — хорошо для тех,
 * кто не любит пересыхания (калатеи, папоротники, сенполии, спатифиллум), и плохо для тех, кому
 * нужна просушка между поливами (суккуленты, орхидеи, замиокулькас). Правило — по группе вида
 * и его профилю ухода (как часто полив летом, какой грунт), без ручной разметки каждого вида.
 */

import type { CareProfile } from "./species";

export type WickFit = "good" | "careful" | "no";

export interface WickAdvice {
  fit: WickFit;
  title: string;
  text: string;
}

/** Группы, которым фитиль не подходит: корням нужна просушка или особая вода. */
const NO_GROUPS = new Set(["succulents", "orchids", "bromeliads", "carnivorous"]);
/** Группы, которые любят ровную влажность. */
const GOOD_GROUPS = new Set(["marantaceae", "ferns"]);
/** Грунты (slug из soil-mixes) для тех, кому нужна просушка: с ними фитиль заболачивает корни. */
const DRY_SOILS = new Set([
  "cactus_succulent",
  "mesembs_mineral",
  "caudex",
  "orchid_bark",
  "orchid_terrestrial",
  "air_epiphyte",
  "bromeliad_epiphyte",
  "epiphytic_vine",
  "bulbous",
  "carnivorous",
]);
/** Грунты для влаголюбивых: геснериевые (сенполии), тропические, папоротники. */
const MOIST_SOILS = new Set(["gesneriad", "tropical_moist", "fern", "aroid_moist"]);

/** Общие правила фитиля — показываем вместе с вердиктом. */
export const WICK_HOWTO =
  "Фитиль — синтетический шнур (не хлопок, он гниёт) из резервуара в нижнюю треть горшка. Грунт рыхлый, с перлитом. Доливайте воду в резервуар, когда уровень опустится ниже трети, и раз в месяц поливайте сверху — промыть соли.";

export function wickAdvice(group: string, care: CareProfile | null): WickAdvice {
  const interval = care?.waterIntervalSummer ?? 7;
  const soil = care?.soilMixSlug ?? "";

  if (NO_GROUPS.has(group) || DRY_SOILS.has(soil) || interval >= 10) {
    return {
      fit: "no",
      title: "Фитильный полив не подходит",
      text: "Этому растению нужно, чтобы грунт просыхал между поливами. От постоянной влаги загниют корни — поливайте по графику.",
    };
  }
  if (GOOD_GROUPS.has(group) || MOIST_SOILS.has(soil) || interval <= 4) {
    return {
      fit: "good",
      title: "Фитильный полив подходит",
      text: "Любит ровную влажность без пересыхания — фитиль как раз это даёт и выручит в отпуске.",
    };
  }
  return {
    fit: "careful",
    title: "Фитиль — можно, с осторожностью",
    text: "Терпит фитиль, если грунт рыхлый, а фитиль тонкий. Зимой, когда растение пьёт меньше, переходите на обычный полив.",
  };
}
