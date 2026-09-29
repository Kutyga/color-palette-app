"use client";

/** Карточка растения: страница собирает блоки из components/plant-card. */

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { RequireSession } from "@/components/app-shell";
import {
  CareActions,
  CareJournal,
  CareScheduleList,
  DeletePlantButton,
  PlantFacts,
  PlantHero,
  PlantLinks,
  SpeciesNotes,
} from "@/components/plant-card";
import { ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { catalogBySlug } from "@/lib/catalog";
import { usePlantDetails } from "@/lib/queries";

function PlantView({ id }: { id: string }) {
  const details = usePlantDetails(id);
  // Одно «сейчас» на всю карточку: сроки в фактах и в графике считаются от одного момента.
  const now = useMemo(() => new Date(), []);

  if (details.isPending) return <Spinner />;
  if (details.error) return <ErrorNote error={details.error} onRetry={() => details.refetch()} />;
  const { plant, schedules, events } = details.data;
  const species = catalogBySlug(plant.speciesSlug);

  return (
    <div className="pt-4">
      <Link href="/garden/" className="text-leaf inline-flex items-center gap-1 text-[17px]">
        <ChevronLeft className="size-5" aria-hidden /> Коллекция
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <PlantHero plant={plant} species={species} />
        <div>
          <h1 className="text-[40px] leading-tight font-bold tracking-tight">{plant.nickname}</h1>
          {species ? (
            <Link href={`/plants/${species.slug}/`} className="text-secondary hover:text-leaf text-[17px]">
              {plant.speciesName} · <i>{species.latinName}</i>
            </Link>
          ) : (
            <p className="text-secondary text-[17px]">{plant.speciesName ?? "Вид не указан"}</p>
          )}
          <PlantFacts plant={plant} water={schedules.find((s) => s.type === "water")} now={now} />
          <CareActions plant={plant} schedules={schedules} />
          <PlantLinks plantId={plant.id} />
        </div>
      </div>

      <SectionTitle>График ухода</SectionTitle>
      <CareScheduleList plant={plant} schedules={schedules} now={now} />

      <SectionTitle>Журнал</SectionTitle>
      <CareJournal events={events} />

      {species && <SpeciesNotes slug={species.slug} />}

      <DeletePlantButton plant={plant} />
    </div>
  );
}

function PlantPageInner() {
  const id = useSearchParams().get("id");
  if (!id) return <ErrorNote error="Растение не найдено" />;
  return <PlantView id={id} />;
}

export default function PlantPage() {
  return (
    <RequireSession>
      <Suspense fallback={<Spinner />}>
        <PlantPageInner />
      </Suspense>
    </RequireSession>
  );
}
