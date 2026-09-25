// Снимок базы знаний для сборки сайта: страницы видов генерируются заранее (их индексируют
// поисковики), а демо-режим работает с полной базой без сервера.
//
//   node scripts/sync-species.mjs                 — из Supabase (NEXT_PUBLIC_SUPABASE_URL и
//                                                   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
//   node scripts/sync-species.mjs --from rows.json [--soil-from mixes.json]
//                                                — из выгрузки psql (формат как у PostgREST)
//
// Рядом пишется справочник грунтов src/data/soil-mixes.json (таблица soil_mixes).
//
// Без переменных окружения и без --from оставляет текущий снимок как есть.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../src/data/species.json", import.meta.url));
const soilOut = fileURLToPath(new URL("../src/data/soil-mixes.json", import.meta.url));
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};

async function load(file, path) {
  if (arg("--from")) return file ? JSON.parse(readFileSync(file, "utf8")) : null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

const SPECIES_FIELDS = ["slug", "latin_name", "common_names", "synonyms", "description", "plant_type", "difficulty",
  "toxic_to_pets", "toxic_to_humans", "air_purifying", "image_url", "image_credit", "image_license", "image_source_url"];
const CARE_FIELDS = ["light", "water_interval_summer", "water_interval_winter", "soil_dryness_before_watering",
  "humidity_min_pct", "temp_min_c", "temp_max_c", "fertilize_interval_days", "fertilize_months", "repot_every_years",
  "propagation", "tips", "soil_mix_slug", "soil_note"];
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

const SOIL_FIELDS = ["slug", "name", "summary", "components", "ph_min", "ph_max", "drainage", "top_layer", "pot",
  "water_retention", "aeration", "tips", "sort"];
const mixes = await load(arg("--soil-from"), "soil_mixes?select=*&order=sort");
if (mixes) {
  const sorted = mixes.map((m) => pick(m, SOIL_FIELDS)).sort((a, b) => a.sort - b.sort);
  writeFileSync(soilOut, JSON.stringify(sorted, null, 1) + "\n");
  console.log(`sync-species: ${sorted.length} грунтов → src/data/soil-mixes.json`);
}
