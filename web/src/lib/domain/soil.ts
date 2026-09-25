/**
 * Составы грунта. Справочник — таблица soil_mixes
 * (supabase/migrations/20260925130000_soil_mixes.sql), виду он назначается через
 * care_profiles.soil_mix_slug. Здесь — модель и палитра компонентов для схемы.
 */

export type SoilRole = "base" | "loosener" | "moisture" | "drainage" | "additive";

export interface SoilMaterial {
  label: string;
  /** Чем полезен компонент — подсказка в легенде. */
  hint: string;
  color: string;
  /** Крупность частиц на схеме горшка: 0 — пыль, 3 — крупные куски. */
  grain: 0 | 1 | 2 | 3;
}

/** Только эти id допускаются в soil_mixes.components (проверяет smoke_test.sql). */
export const SOIL_MATERIALS = {
  sod_soil: { label: "Дерновая земля", hint: "плотная и питательная основа", color: "#6b4a2f", grain: 0 },
  leaf_soil: { label: "Листовая земля", hint: "лёгкая, питательная", color: "#7c5a3a", grain: 0 },
  peat: { label: "Торф (нейтральный)", hint: "держит влагу, делает смесь лёгкой", color: "#4e3626", grain: 0 },
  sphagnum_peat: { label: "Верховой торф", hint: "кислый, почти без питания", color: "#8a5a3c", grain: 0 },
  coir: { label: "Кокосовый субстрат", hint: "влагоёмкий, не слёживается", color: "#a0673f", grain: 1 },
  conifer_soil: { label: "Хвойная земля", hint: "подкисляет грунт", color: "#5d4632", grain: 1 },
  humus: { label: "Биогумус", hint: "мягкое органическое питание", color: "#3b2a1e", grain: 0 },
  sand: { label: "Крупный песок", hint: "дренаж и вес", color: "#d9c08c", grain: 1 },
  perlite: { label: "Перлит", hint: "воздух для корней", color: "#f2f2ec", grain: 1 },
  vermiculite: { label: "Вермикулит", hint: "держит воду и удобрения", color: "#c9a45c", grain: 1 },
  pumice: { label: "Пемза", hint: "пористый минеральный разрыхлитель", color: "#cfc8bb", grain: 2 },
  zeolite: { label: "Цеолит", hint: "впитывает лишнюю влагу и соли", color: "#9fb4a6", grain: 2 },
  akadama: { label: "Акадама", hint: "японская глина для бонсай и суккулентов", color: "#b8743e", grain: 2 },
  lava: { label: "Лавовая крошка", hint: "тяжёлый пористый дренаж", color: "#7a3b30", grain: 2 },
  bark_fine: { label: "Кора мелкая", hint: "рыхлость и воздух", color: "#9a5b34", grain: 2 },
  bark: { label: "Кора 1–2 см", hint: "субстрат для эпифитов", color: "#7f4527", grain: 3 },
  sphagnum: { label: "Мох сфагнум", hint: "держит влагу, антисептик", color: "#9cbf6e", grain: 2 },
  charcoal: { label: "Древесный уголь", hint: "против закисания и гнили", color: "#2b2b2b", grain: 2 },
  clay_pebbles: { label: "Керамзит", hint: "дренаж на дне горшка", color: "#b5653d", grain: 3 },
  gravel: { label: "Мелкий гравий", hint: "дренаж и мульча", color: "#9a978f", grain: 2 },
} satisfies Record<string, SoilMaterial>;
export type SoilMaterialId = keyof typeof SOIL_MATERIALS;

export const SOIL_ROLES: Record<SoilRole, string> = {
  base: "основа",
  loosener: "разрыхлитель",
  moisture: "держит влагу",
  drainage: "дренаж",
  additive: "добавка",
};

export interface SoilComponent {
  material: SoilMaterialId;
  pct: number;
  role: SoilRole;
}

export interface SoilMix {
  slug: string;
  nameRu: string;
  summaryRu: string;
  components: SoilComponent[];
  phMin: number;
  phMax: number;
  drainage: { material: SoilMaterialId; cm: number } | null;
  topLayer: { material: SoilMaterialId } | null;
  potRu: string;
  /** 1 — сохнет за день-два, 5 — долго остаётся влажным. */
  waterRetention: number;
  /** 1 — плотный, 5 — очень воздушный. */
  aeration: number;
  tipsRu: string[];
}

type Row = Record<string, unknown>;
const ru = <T>(v: unknown, fallback: T): T => ((v as { ru?: T } | null)?.ru ?? fallback);

/** Неизвестные компоненты отбрасываем — схема рисует только то, что умеет. */
export function soilMixFromRow(r: Row): SoilMix {
  const components = ((r.components as SoilComponent[] | null) ?? [])
    .filter((c) => c.material in SOIL_MATERIALS && c.pct > 0)
    .sort((a, b) => b.pct - a.pct);
  const drainage = r.drainage as SoilMix["drainage"];
  const topLayer = r.top_layer as SoilMix["topLayer"];
  return {
    slug: r.slug as string,
    nameRu: ru(r.name, r.slug as string),
    summaryRu: ru(r.summary, ""),
    components,
    phMin: Number(r.ph_min),
    phMax: Number(r.ph_max),
    drainage: drainage && drainage.material in SOIL_MATERIALS ? drainage : null,
    topLayer: topLayer && topLayer.material in SOIL_MATERIALS ? topLayer : null,
    potRu: ru(r.pot, ""),
    waterRetention: Number(r.water_retention),
    aeration: Number(r.aeration),
    tipsRu: ru(r.tips, [] as string[]),
  };
}

/** Кислотность словами — для подписи под шкалой pH. */
export function phLabel(min: number, max: number): string {
  const mid = (min + max) / 2;
  if (mid < 5) return "кислый";
  if (mid < 6.2) return "слабокислый";
  if (mid <= 7.3) return "нейтральный";
  return "слабощелочной";
}

/** Пересчёт долей в литры для горшка заданного объёма (округление до 0,1 л, сумма сохраняется). */
export function componentVolumes(mix: SoilMix, liters: number): { material: SoilMaterialId; liters: number }[] {
  const total = mix.components.reduce((s, c) => s + c.pct, 0) || 1;
  return mix.components.map((c) => ({ material: c.material, liters: Math.round((liters * c.pct * 10) / total) / 10 }));
}

/**
 * Частицы для схемы горшка: детерминированно (одинаково на сервере и в браузере)
 * раскладываем точки так, чтобы доля каждого компонента соответствовала рецепту.
 */
export function soilParticles(mix: SoilMix, count: number, seed = 1): { material: SoilMaterialId; x: number; y: number; r: number }[] {
  let state = seed * 9301 + 49297;
  const rand = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
  const total = mix.components.reduce((s, c) => s + c.pct, 0) || 1;
  const out: { material: SoilMaterialId; x: number; y: number; r: number }[] = [];
  for (const c of mix.components) {
    const grain = SOIL_MATERIALS[c.material].grain;
    // Крупные частицы занимают больше места — их рисуем меньше штук.
    const n = Math.max(1, Math.round((count * c.pct) / total / (1 + grain)));
    for (let i = 0; i < n; i++) out.push({ material: c.material, x: rand(), y: rand(), r: 0.6 + grain * 0.9 + rand() * 0.6 });
  }
  // Перемешиваем, чтобы слои не рисовались «стопкой» по компонентам.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
