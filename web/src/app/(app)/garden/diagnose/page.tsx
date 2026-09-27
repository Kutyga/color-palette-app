"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ExternalLink, MessageCircleQuestion, Search, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CameraField } from "@/components/camera";
import { useBackend } from "@/components/session";
import { Button, Card, Chip, PageHeader, Spinner, cx } from "@/components/ui";
import {
  SYMPTOMS,
  SYMPTOM_GROUPS,
  describeEppo,
  diagnose,
  eppoHref,
  type Cause,
  type DiseaseGuess,
  type SymptomGroup,
} from "@/lib/domain/diagnosis";
import { toJpeg } from "@/lib/image";
import { usePlantDetails } from "@/lib/queries";

const URGENCY: Record<Cause["urgency"], { label: string; tone: string }> = {
  1: { label: "Не срочно", tone: "bg-muted text-secondary" },
  2: { label: "Займитесь на этой неделе", tone: "bg-soil/15 text-soil" },
  3: { label: "Действуйте сегодня", tone: "bg-alert/15 text-alert" },
};

function CauseCard({ cause, note }: { cause: Cause; note?: string }) {
  const u = URGENCY[cause.urgency];
  return (
    <li className="rounded-[20px] bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[17px] font-semibold">{cause.title}</h3>
        <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", u.tone)}>{u.label}</span>
      </div>
      {note && <p className="mt-1 text-[13px] text-secondary">{note}</p>}
      <p className="mt-2 text-[15px] text-secondary">{cause.about}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[15px]">
        {cause.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </li>
  );
}

function PhotoCheck() {
  const backend = useBackend();
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const check = useMutation({
    mutationFn: async (blob: Blob): Promise<DiseaseGuess[]> => backend.identifier!.diagnose(await toJpeg(blob, 1280)),
  });
  return (
    <Card className="p-5">
      <h2 className="text-[19px] font-semibold">По фото</h2>
      <p className="mt-1 text-[15px] text-secondary">Снимите поражённый лист крупно и при хорошем свете.</p>
      {!backend.identifier ? (
        <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-[15px] text-secondary">Распознавание болезней по фото работает после регистрации. Отметьте симптомы ниже.</p>
      ) : (
        <>
          <div className="mt-4">
            <CameraField
              aspect="aspect-[4/3]"
              photoUrl={photo?.url ?? null}
              onCapture={(blob) => {
                setPhoto({ blob, url: URL.createObjectURL(blob) });
                check.reset();
              }}
            />
          </div>
          {photo && !check.data && (
            <Button className="mt-3 w-full" loading={check.isPending} onClick={() => check.mutate(photo.blob)}>
              <Search className="size-4" aria-hidden /> Проверить фото
            </Button>
          )}
          {check.error && <p className="mt-3 text-[15px] text-alert">{check.error.message}</p>}
          {check.data &&
            (check.data.length ? (
              <ul className="mt-4 space-y-3" aria-label="Результаты по фото">
                {check.data.map((g) => {
                  const d = describeEppo(g);
                  return (
                    <li key={g.eppo} className="rounded-2xl bg-muted p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex-1 font-semibold">{d.name}</span>
                        <span className="text-[15px] font-semibold text-secondary">{Math.round(g.score * 100)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className="h-full rounded-full bg-alert" style={{ width: `${Math.max(4, Math.round(g.score * 100))}%` }} />
                      </div>
                      {d.cause && <p className="mt-2 text-[15px]">{d.cause.steps[0]}</p>}
                      <a href={eppoHref(g.eppo)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-leaf">
                        Подробнее (EPPO {g.eppo}) <ExternalLink className="size-3.5" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-[15px]">
                Болезнь по фото не определилась — сервис знает пока не все растения и болезни. Отметьте симптомы ниже.
              </p>
            ))}
          {check.data && check.data.length > 0 && (
            <p className="mt-3 flex gap-2 text-[13px] text-secondary">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Распознавание — подсказка, а не диагноз. Сверьтесь с симптомами ниже.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

function SymptomCheck() {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const results = diagnose(picked);
  return (
    <section aria-label="По симптомам" className="space-y-4">
      <Card className="p-5">
        <h2 className="text-[19px] font-semibold">По симптомам</h2>
        <p className="mt-1 text-[15px] text-secondary">Отметьте всё, что видите, — подскажем вероятные причины и что делать.</p>
        {(Object.keys(SYMPTOM_GROUPS) as SymptomGroup[]).map((g) => (
          <div key={g} className="mt-4" role="group" aria-label={SYMPTOM_GROUPS[g]}>
            <p className="mb-2 text-[13px] font-medium text-secondary">{SYMPTOM_GROUPS[g]}</p>
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

function Diagnose() {
  const plantId = useSearchParams().get("plant");
  const details = usePlantDetails(plantId);
  const plant = details.data?.plant ?? null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {plantId && details.isPending ? <Spinner /> : plant && <p className="px-1 text-[15px] text-secondary">Растение: {plant.nickname}</p>}
      <PhotoCheck />
      <SymptomCheck />
      <Card className="flex items-center gap-4 p-5">
        <MessageCircleQuestion className="size-6 shrink-0 text-leaf" aria-hidden />
        <p className="flex-1 text-[15px]">Не уверены? Спросите садоводов — у кого-то наверняка было так же.</p>
        <Link
          href={`/feed/new/?type=question${plantId ? `&plant=${encodeURIComponent(plantId)}` : ""}`}
          className="shrink-0 rounded-full bg-leaf px-4 py-2 text-[15px] font-semibold text-white"
        >
          Спросить
        </Link>
      </Card>
    </div>
  );
}

export default function DiagnosePage() {
  return (
    <>
      <div className="pt-4">
        <Link href="/garden/" className="inline-flex items-center gap-1 text-[15px] font-medium text-leaf">
          <ChevronLeft className="size-5" aria-hidden /> Коллекция
        </Link>
      </div>
      <PageHeader title="Что с растением?" actions={<Stethoscope className="size-7 text-alert" aria-hidden />} />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <Diagnose />
        </Suspense>
      </RequireSession>
    </>
  );
}
