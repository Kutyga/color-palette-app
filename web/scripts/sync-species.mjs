// Снимок базы знаний для сборки сайта: страницы видов генерируются заранее (их индексируют
// поисковики), а демо-режим работает с полной базой без сервера.
//
//   node scripts/sync-species.mjs                 — из Supabase (NEXT_PUBLIC_SUPABASE_URL и
//                                                   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
//   node scripts/sync-species.mjs --from rows.json — из выгрузки psql (формат как у PostgREST)
//
// Без переменных окружения и без --from оставляет текущий снимок как есть.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../src/data/species.json", import.meta.url));
const fromIndex = process.argv.indexOf("--from");

async function load() {
  if (fromIndex > 0) return JSON.parse(readFileSync(process.argv[fromIndex + 1], "utf8"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log("sync-species: нет адреса Supabase — используем сохранённый снимок");
    return null;
  }
  const res = await fetch(`${url}/rest/v1/species?select=*,care_profiles(*)&order=latin_name`, {
    headers: { apikey: key, authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`sync-species: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const SPECIES_FIELDS = ["slug", "latin_name", "common_names", "synonyms", "description", "plant_type", "difficulty",
  "toxic_to_pets", "toxic_to_humans", "air_purifying"];
const CARE_FIELDS = ["light", "water_interval_summer", "water_interval_winter", "soil_dryness_before_watering",
  "humidity_min_pct", "temp_min_c", "temp_max_c", "fertilize_interval_days", "fertilize_months", "repot_every_years",
  "propagation", "tips"];
const pick = (obj, fields) => Object.fromEntries(fields.map((f) => [f, obj?.[f] ?? null]));

const rows = await load();
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
