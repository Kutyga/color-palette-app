import type { Species } from "./species";

/** Ответ распознавателя: латинское название, уверенность 0…1 и, если есть, народное название. */
export interface Prediction {
  label: string;
  score: number;
  commonName?: string | null;
}

/** Кандидат распознавания и, если нашёлся, вид из базы знаний. */
export interface IdentificationCandidate {
  latinName: string;
  commonName: string | null;
  score: number;
  percent: number;
  /** Вид из базы знаний: точное совпадение или (если genusOnly) вид того же рода. */
  species: Species | null;
  genusOnly: boolean;
}

const normalize = (s: string) => s.toLowerCase().replaceAll("×", " ").replace(/\s+/g, " ").trim();

/** Сопоставляет латинское название с базой знаний: сначала точное (с синонимами), потом по роду. */
export function matchSpecies(p: Prediction, knowledgeBase: Species[]): IdentificationCandidate {
  const base = {
    latinName: p.label,
    commonName: p.commonName ?? null,
    score: p.score,
    percent: Math.round(p.score * 100),
  };
  const name = normalize(p.label);
  const exact = knowledgeBase.find((s) => [s.latinName, ...s.synonyms].map(normalize).includes(name));
  if (exact) return { ...base, species: exact, genusOnly: false };
  const genus = name.split(" ")[0];
  const sameGenus = knowledgeBase.find((s) =>
    [s.latinName, ...s.synonyms].some((n) => normalize(n).split(" ")[0] === genus),
  );
  if (sameGenus) return { ...base, species: sameGenus, genusOnly: true };
  return { ...base, species: null, genusOnly: false };
}

/** Первая буква заглавная: «monstera deliciosa» → «Monstera deliciosa». */
export const capitalizeLatin = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
