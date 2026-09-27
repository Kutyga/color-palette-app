"use client";

/** Проверка по фото: Gemini разбирает, что видно, Pl@ntNet называет болезни по кодам EPPO. */

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { CameraField } from "@/components/camera";
import { useBackend } from "@/components/session";
import { Button, Card, cx } from "@/components/ui";
import {
  causeById,
  confidentGuesses,
  describeEppo,
  eppoHref,
  type AiDiagnosis,
  type DiseaseGuess,
  type PhotoDiagnosis,
} from "@/lib/domain/diagnosis";
import { toJpeg } from "@/lib/image";
import { URGENCY } from "./urgency";

function GuessList({ guesses }: { guesses: DiseaseGuess[] }) {
  return (
    <ul className="mt-2 space-y-2" aria-label="Результаты Pl@ntNet">
      {guesses.map((g) => {
        const d = describeEppo(g);
        return (
          <li key={g.eppo} className="bg-muted rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 font-semibold">{d.name}</span>
              <span className="text-secondary text-[15px] font-semibold">{Math.round(g.score * 100)}%</span>
            </div>
            <div className="bg-surface mt-2 h-1.5 overflow-hidden rounded-full">
              <div className="bg-alert h-full rounded-full" style={{ width: `${Math.max(4, Math.round(g.score * 100))}%` }} />
            </div>
            {d.cause && <p className="mt-2 text-[15px]">{d.cause.steps[0]}</p>}
            <a
              href={eppoHref(g.eppo)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-leaf mt-2 inline-flex items-center gap-1 text-[13px] font-medium"
            >
              Подробнее (EPPO {g.eppo}) <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Разбор Gemini: вывод, проблемы с объяснением и шаги из справочника. */
function AiVerdict({ ai }: { ai: AiDiagnosis }) {
  const tone = !ai.isPlant ? "bg-muted" : ai.healthy ? "bg-leaf/10" : "bg-alert/10";
  return (
    <section aria-label="Разбор по фото" className="mt-4 space-y-3">
      <div className={cx("rounded-2xl p-4", tone)}>
        <p className="flex items-center gap-2 font-semibold">
          {ai.healthy ? <CheckCircle2 className="text-leaf size-5" aria-hidden /> : <Sparkles className="text-alert size-5" aria-hidden />}
          {!ai.isPlant ? "На фото не видно растения" : ai.healthy ? "Выглядит здоровым" : "Что видно на фото"}
        </p>
        {ai.plant && ai.isPlant && <p className="text-secondary mt-1 text-[13px]">Похоже на: {ai.plant}</p>}
        {ai.summary && <p className="mt-2 text-[15px]">{ai.summary}</p>}
      </div>
      {ai.problems.map((p) => {
        const cause = causeById(p.cause);
        return (
          <div key={p.title} className="bg-surface ring-separator rounded-2xl p-4 ring-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="flex-1 text-[17px] font-semibold">{p.title}</h3>
              <span className="text-secondary text-[15px] font-semibold">{Math.round(p.confidence * 100)}%</span>
            </div>
            {cause && (
              <span className={cx("mt-1 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold", URGENCY[cause.urgency].tone)}>
                {URGENCY[cause.urgency].label}
              </span>
            )}
            {p.evidence && <p className="text-secondary mt-2 text-[15px]">Что видно: {p.evidence}</p>}
            {cause && (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
                {cause.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function PhotoCheck({ plantHint }: { plantHint: string | null }) {
  const backend = useBackend();
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const check = useMutation({
    mutationFn: async (blob: Blob): Promise<PhotoDiagnosis> => {
      const r = await backend.identifier!.diagnose(await toJpeg(blob, 1280), plantHint);
      return { ...r, guesses: confidentGuesses(r.guesses) };
    },
  });
  const result = check.data;
  const nothing = result && !result.ai && !result.guesses.length;
  return (
    <Card className="p-5">
      <h2 className="text-[19px] font-semibold">По фото</h2>
      <p className="text-secondary mt-1 text-[15px]">Снимите поражённый лист крупно и при хорошем свете.</p>
      {!backend.identifier ? (
        <p className="bg-muted text-secondary mt-3 rounded-2xl px-4 py-3 text-[15px]">
          Распознавание болезней по фото работает после регистрации. Отметьте симптомы ниже.
        </p>
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
          {photo && !result && (
            <>
              <Button className="mt-3 w-full" loading={check.isPending} onClick={() => check.mutate(photo.blob)}>
                <Search className="size-4" aria-hidden /> Проверить фото
              </Button>
              <p className="text-secondary mt-2 text-[12px]">Фото отправится на анализ в Pl@ntNet и Google Gemini.</p>
            </>
          )}
          {check.error && <p className="text-alert mt-3 text-[15px]">{check.error.message}</p>}
          {result?.ai && <AiVerdict ai={result.ai} />}
          {result && result.guesses.length > 0 && (
            <div className="mt-4">
              <p className="text-secondary text-[13px] font-medium">{result.ai ? "Pl@ntNet также нашёл" : "Pl@ntNet нашёл"}</p>
              <GuessList guesses={result.guesses} />
            </div>
          )}
          {nothing && (
            <p className="bg-muted mt-3 rounded-2xl px-4 py-3 text-[15px]">
              Явных признаков болезни на фото не нашли. Если что-то беспокоит — снимите поражённое место крупнее или отметьте симптомы ниже.
            </p>
          )}
          {result && !nothing && (
            <p className="text-secondary mt-3 flex gap-2 text-[13px]">
              <AlertTriangle className="size-4 shrink-0" aria-hidden /> Разбор делают нейросети — это подсказка, а не диагноз. Сверьтесь с
              симптомами ниже.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
