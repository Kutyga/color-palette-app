import rows from "@/data/species.json";
import { searchLocal, speciesFromRow, speciesMatches, type Species } from "./domain/species";

/**
 * База знаний из снимка src/data/species.json (обновляется при сборке скриптом
 * scripts/sync-species.mjs). Витрина и поиск работают мгновенно и без сети;
 * id в снимке = slug, настоящий id вида для записи в базу берёт репозиторий.
 */
export const ALL_SPECIES: Species[] = (rows as Record<string, unknown>[]).map(speciesFromRow);

const bySlug = new Map(ALL_SPECIES.map((s) => [s.slug, s]));
export const speciesBySlug = (slug: string | null | undefined) => (slug ? bySlug.get(slug) ?? null : null);

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Похожесть слова запроса на лучшее слово названия (как word_similarity в pg_trgm, упрощённо). */
function similarity(query: string, name: string): number {
  const q = trigrams(query);
  let best = 0;
  for (const word of name.toLowerCase().split(/[\s\-«»"',.]+/)) {
    if (!word) continue;
    const w = trigrams(word);
    let common = 0;
    q.forEach((t) => w.has(t) && common++);
    best = Math.max(best, common / (q.size + w.size - common));
  }
  return best;
}

/** Поиск: сначала точные совпадения и вхождения, при опечатках — похожие названия. */
export function searchSpecies(query: string, all: Species[] = ALL_SPECIES): Species[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  const direct = searchLocal(all, q);
  if (direct.length) return direct;
  return all
    .map((s) => ({
      s,
      score: Math.max(...[s.latinName, ...s.synonyms, ...s.commonNamesRu, ...s.commonNamesEn].map((n) => similarity(q, n))),
    }))
    .filter((x) => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

export { speciesMatches };
