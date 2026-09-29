// Снимок базы знаний для сборки сайта: страницы видов генерируются заранее (их индексируют
// поисковики), а демо-режим работает с полной базой без сервера.
//
//   node scripts/sync-species.mjs                 — из API (NEXT_PUBLIC_SUPABASE_URL и
//                                                   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; для «/api» —
//                                                   полный адрес в SPECIES_SYNC_URL)
//   node scripts/sync-species.mjs --from rows.json [--soil-from mixes.json] [--fert-from fertilizers.json]
//                                                — из выгрузки psql (формат как у PostgREST)
//
// Рядом пишутся справочники грунтов src/data/soil-mixes.json (таблица soil_mixes)
// и подкормок src/data/fertilizers.json (таблица fertilizers).
//
// Без переменных окружения и без --from оставляет текущий снимок как есть.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../src/data/species.json", import.meta.url));
const soilOut = fileURLToPath(new URL("../src/data/soil-mixes.json", import.meta.url));
const fertOut = fileURLToPath(new URL("../src/data/fertilizers.json", import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};

async function load(file, path) {
  if (arg("--from")) return file ? JSON.parse(readFileSync(file, "utf8")) : null;
  // Относительный адрес API (свой сервер) при сборке недоступен — тогда полный адрес в SPECIES_SYNC_URL.
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = raw?.startsWith("/") ? process.env.SPECIES_SYNC_URL : raw;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log("sync-species: нет адреса Supabase — используем сохранённый снимок");
    return null;
  }
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`sync-species: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const SPECIES_FIELDS = [
  "slug",
  "latin_name",
  "common_names",
  "synonyms",
  "description",
  "plant_type",
  "difficulty",
  "toxic_to_pets",
  "toxic_to_humans",
  "air_purifying",
  "image_url",
  "image_credit",
  "image_license",
  "image_source_url",
  "cultivars",
];
const CARE_FIELDS = [
  "light",
  "water_interval_summer",
  "water_interval_winter",
  "soil_dryness_before_watering",
  "humidity_min_pct",
  "temp_min_c",
  "temp_max_c",
  "fertilize_interval_days",
  "fertilize_months",
  "repot_every_years",
  "propagation",
  "tips",
  "soil_mix_slug",
  "soil_note",
  "fertilizer_slug",
];
const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj?.[f] ?? null]));

const rows = await load(arg("--from"), "species?select=*,care_profiles(*)&order=latin_name");
if (rows) {
  const species = rows
    .map((r) => {
      const care = Array.isArray(r.care_profiles) ? r.care_profiles[0] : r.care_profiles;
      // id = slug: снимок не зависит от случайных uuid конкретной базы.
      return { id: r.slug, ...pick(r, SPECIES_FIELDS), care_profiles: care ? pick(care, CARE_FIELDS) : null };
    })
    .sort((a, b) => a.latin_name.localeCompare(b.latin_name));
  writeFileSync(out, JSON.stringify(species, null, 1) + "\n");
  console.log(`sync-species: ${species.length} видов → src/data/species.json`);
}

const SOIL_FIELDS = [
  "slug",
  "name",
  "summary",
  "components",
  "ph_min",
  "ph_max",
  "drainage",
  "top_layer",
  "pot",
  "water_retention",
  "aeration",
  "tips",
  "sort",
];
const mixes = await load(arg("--soil-from"), "soil_mixes?select=*&order=sort");
if (mixes) {
  const sorted = mixes.map((m) => pick(m, SOIL_FIELDS)).sort((a, b) => a.sort - b.sort);
  writeFileSync(soilOut, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`sync-species: ${sorted.length} грунтов → src/data/soil-mixes.json`);
}

const FERT_FIELDS = ["slug", "name", "summary", "npk", "form", "dose", "signs_under", "signs_over", "tips", "sort"];
const ferts = await load(arg("--fert-from"), "fertilizers?select=*&order=sort");
if (ferts) {
  const sorted = ferts.map((f) => pick(f, FERT_FIELDS)).sort((a, b) => a.sort - b.sort);
  writeFileSync(fertOut, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`sync-species: ${sorted.length} программ подкормки → src/data/fertilizers.json`);
}

// Лёгкий указатель для браузера (src/data/species-index.json): названия, фото, сложность, группа —
// без ухода и описаний. Строится из снимка всегда, даже без доступа к API. Правила групп —
// src/data/species-groups.json (их же применяет lib/domain/groups.ts; тест сверяет результат).
const indexOut = fileURLToPath(new URL("../src/data/species-index.json", import.meta.url));
const groupsFile = fileURLToPath(new URL("../src/data/species-groups.json", import.meta.url));
const { rules } = JSON.parse(readFileSync(groupsFile, "utf8"));
const groupOf = (s) => {
  const genus = s.latin_name.replace(/^×\s*/, "").split(" ")[0];
  const fert = s.care_profiles?.fertilizer_slug;
  const rule = rules.find(
    (r) =>
      (!r.fertilizer && !r.plantType && !r.genus) ||
      (fert && r.fertilizer?.includes(fert)) ||
      (s.plant_type && r.plantType?.includes(s.plant_type)) ||
      r.genus?.includes(genus),
  );
  return rule?.group ?? "foliage";
};
const snapshot = JSON.parse(readFileSync(out, "utf8"));
const index = snapshot.map((s) => ({
  slug: s.slug,
  latin: s.latin_name,
  ru: s.common_names?.ru ?? [],
  en: s.common_names?.en ?? [],
  syn: s.synonyms ?? [],
  cv: (s.cultivars ?? []).filter((c) => c?.name).map((c) => [c.name, c.ru ?? null]),
  img: s.image_url ?? null,
  diff: s.difficulty ?? null,
  pets: s.toxic_to_pets ?? null,
  air: s.air_purifying ?? null,
  light: s.care_profiles?.light ?? null,
  type: s.plant_type ?? null,
  group: groupOf(s),
}));
writeFileSync(indexOut, JSON.stringify(index) + "\n");
console.log(`sync-species: указатель ${index.length} видов → src/data/species-index.json`);
