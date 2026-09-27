"use client";

/** «Что с растением?»: проверка по фото и по симптомам (блоки — в components/diagnose). */

import { ChevronLeft, MessageCircleQuestion, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireSession } from "@/components/app-shell";
import { PhotoCheck, SymptomCheck } from "@/components/diagnose";
import { Card, PageHeader, Spinner } from "@/components/ui";
import { usePlantDetails } from "@/lib/queries";

function Diagnose() {
  const plantId = useSearchParams().get("plant");
  const details = usePlantDetails(plantId);
  const plant = details.data?.plant ?? null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {plantId && details.isPending ? <Spinner /> : plant && <p className="text-secondary px-1 text-[15px]">Растение: {plant.nickname}</p>}
      <PhotoCheck plantHint={plant ? [plant.nickname, plant.speciesName].filter(Boolean).join(", ") : null} />
      <SymptomCheck />
      <Card className="flex items-center gap-4 p-5">
        <MessageCircleQuestion className="text-leaf size-6 shrink-0" aria-hidden />
        <p className="flex-1 text-[15px]">Не уверены? Спросите садоводов — у кого-то наверняка было так же.</p>
        <Link
          href={`/feed/new/?type=question${plantId ? `&plant=${encodeURIComponent(plantId)}` : ""}`}
          className="bg-leaf shrink-0 rounded-full px-4 py-2 text-[15px] font-semibold text-white"
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
        <Link href="/garden/" className="text-leaf inline-flex items-center gap-1 text-[15px] font-medium">
          <ChevronLeft className="size-5" aria-hidden /> Коллекция
        </Link>
      </div>
      <PageHeader title="Что с растением?" actions={<Stethoscope className="text-alert size-7" aria-hidden />} />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <Diagnose />
        </Suspense>
      </RequireSession>
    </>
  );
}
