"use client";

/** Подбор причин по отмеченным симптомам — справочник работает без сети. */

import { useState } from "react";
import { Card, Chip, cx } from "@/components/ui";
import { SYMPTOMS, SYMPTOM_GROUPS, diagnose, type Cause, type SymptomGroup } from "@/lib/domain/diagnosis";
import { URGENCY } from "./urgency";

function CauseCard({ cause, note }: { cause: Cause; note?: string }) {
  const u = URGENCY[cause.urgency];
  return (
    <li className="bg-surface rounded-[20px] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[17px] font-semibold">{cause.title}</h3>
        <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", u.tone)}>{u.label}</span>
      </div>
      {note && <p className="text-secondary mt-1 text-[13px]">{note}</p>}
      <p className="text-secondary mt-2 text-[15px]">{cause.about}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px]">
        {cause.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </li>
  );
}

export function SymptomCheck() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const results = diagnose(picked);
  return (
    <section aria-label="По симптомам" className="space-y-4">
      <Card className="p-5">
        <h2 className="text-[19px] font-semibold">По симптомам</h2>
        <p className="text-secondary mt-1 text-[15px]">Отметьте всё, что видите, — подскажем вероятные причины и что делать.</p>
        {(Object.keys(SYMPTOM_GROUPS) as SymptomGroup[]).map((g) => (
          <div key={g} className="mt-4" role="group" aria-label={SYMPTOM_GROUPS[g]}>
            <p className="text-secondary mb-2 text-[13px] font-medium">{SYMPTOM_GROUPS[g]}</p>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.filter((s) => s.group === g).map((s) => (
                <Chip key={s.id} active={picked.includes(s.id)} onClick={() => toggle(s.id)}>
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
      </Card>
      {results.length > 0 && (
        <>
          <h2 className="px-1 text-[22px] font-bold tracking-tight">Вероятные причины</h2>
          <ul className="space-y-3" aria-label="Вероятные причины">
            {results.map((r) => (
              <CauseCard key={r.cause.id} cause={r.cause} note={`Совпадает симптомов: ${r.matched.length} из ${picked.length}`} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
