/** Лист «Похоже на»: кандидаты Pl@ntNet с уверенностью и пометкой, есть ли вид в базе знаний. */

import { ChevronRight } from "lucide-react";
import { ProgressRing } from "@/components/ui";
import { capitalizeLatin, type IdentificationCandidate } from "@/lib/domain/identification";
import { speciesName } from "@/lib/domain/species";

export function IdentifyResults({
  candidates,
  onPick,
}: {
  candidates: IdentificationCandidate[];
  onPick: (c: IdentificationCandidate) => void;
}) {
  if (!candidates.length) {
    return (
      <p className="text-secondary">
        Не удалось узнать растение. Снимите лист или цветок крупно при хорошем свете — или выберите вид вручную.
      </p>
    );
  }
  return (
    <>
      <p className="text-secondary text-[13px]">По данным Pl@ntNet. Проверьте по фото в базе знаний.</p>
      <ul className="mt-3 space-y-1">
        {candidates.map((c) => {
          const exact = c.species && !c.genusOnly;
          return (
            <li key={c.latinName}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className="hover:bg-muted flex w-full items-center gap-3 rounded-2xl p-2 text-left"
              >
                <ProgressRing progress={c.score} color={exact ? "var(--leaf)" : "var(--water)"} size={44} stroke={5}>
                  <span className="text-[11px] font-semibold">{c.percent}%</span>
                </ProgressRing>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {exact ? speciesName(c.species!) : (c.commonName ?? capitalizeLatin(c.latinName))}
                  </span>
                  <span className="text-secondary block truncate text-[13px] italic">
                    {!c.species
                      ? `${c.commonName ? `${capitalizeLatin(c.latinName)} · ` : ""}нет в базе знаний — добавим с этим названием`
                      : c.genusOnly
                        ? `Род ${c.species.latinName.split(" ")[0]} — уточните вид`
                        : capitalizeLatin(c.latinName)}
                  </span>
                </span>
                <ChevronRight className="text-secondary size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
