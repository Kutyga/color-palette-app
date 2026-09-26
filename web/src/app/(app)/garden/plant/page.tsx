"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Camera, ChevronLeft, Droplet, MapPin, MoreHorizontal, NotebookPen, Sun, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend } from "@/components/session";
import { Button, CARE_COLORS, CARE_ICONS, ErrorNote, PlantPhoto, SectionTitle, Sheet, Spinner, useToast } from "@/components/ui";
import {
  CARE_TYPES,
  CARE_TYPE_ORDER,
  LIGHT_LEVELS,
  POT_MATERIALS,
  effectiveIntervalDays,
  type CareSchedule,
  type CareType,
} from "@/lib/domain/care";
import type { Plant } from "@/lib/domain/plant";
import { everyDays, formatShortDate, relativeDay } from "@/lib/format";
import { soilMixFor, speciesBySlug } from "@/lib/knowledge";
import { CameraCapture } from "@/components/camera";
import { SoilSummary } from "@/components/soil-schematic";
import { useLogCare, usePlantDetails } from "@/lib/queries";

function effectiveDays(s: CareSchedule, plant: Plant, now: Date) {
  return effectiveIntervalDays({
    type: s.type,
    intervalDays: s.intervalDays,
    userFactor: s.userFactor,
    autoAdjust: s.autoAdjust,
    month: now.getMonth() + 1,
    pot: plant.potMaterial,
    light: plant.lightLevel,
  });
}

function PlantView({ id }: { id: string }) {
  const details = usePlantDetails(id);
  const backend = useBackend();
  const logCare = useLogCare();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useMemo(() => new Date(), []);

  const photo = useMutation({
    mutationFn: async (blob: Blob) => backend.garden.setPlantPhoto(id, blob),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plant", id] });
      qc.invalidateQueries({ queryKey: ["plants"] });
    },
    onError: (e) => toast(`Не удалось загрузить фото: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: () => backend.garden.deletePlant(id),
    onSuccess: () => {
      for (const key of ["plants", "tasks", "stats"]) qc.invalidateQueries({ queryKey: [key] });
      toast("Растение удалено из коллекции");
      router.replace("/garden/");
    },
  });

  if (details.isPending) return <Spinner />;
  if (details.error) return <ErrorNote error={details.error} onRetry={() => details.refetch()} />;
  const { plant, schedules, events } = details.data;
  const species = speciesBySlug(plant.speciesSlug);
  const soil = soilMixFor(species);
  const water = schedules.find((s) => s.type === "water");

  async function mark(type: CareType) {
    setMoreOpen(false);
    try {
      await logCare.mutateAsync({ plantId: id, type });
      toast(`${CARE_TYPES[type].label}: ${plant.nickname} — готово`);
    } catch (e) {
      toast(`Не удалось сохранить: ${e instanceof Error ? e.message : e}`);
    }
  }

  const facts = [
    { icon: Droplet, label: "Полить", value: water?.nextDueAt ? relativeDay(water.nextDueAt, now) : "—", color: "var(--water)" },
    { icon: Sun, label: "Свет", value: plant.lightLevel ? LIGHT_LEVELS[plant.lightLevel] : "не указан", color: "var(--soil)" },
    { icon: MapPin, label: "Место", value: plant.locationName ?? "не указано", color: "var(--leaf)" },
  ];
  const quickTypes = schedules.map((s) => s.type).filter((t) => t !== "water");

  return (
    <div className="pt-4">
      <Link href="/garden/" className="inline-flex items-center gap-1 text-[17px] text-leaf">
        <ChevronLeft className="size-5" aria-hidden /> Коллекция
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="relative">
          <PlantPhoto src={plant.photoUrl ?? species?.image?.url} seed={plant.id} alt={plant.nickname} className="aspect-square w-full rounded-[28px]" iconSize={72} />
          {!plant.photoUrl && species?.image && (
            <span className="glass absolute top-4 left-4 rounded-full px-3 py-1 text-[12px] font-medium">Фото из базы знаний</span>
          )}
          <button
            onClick={() => setCameraOpen(true)}
            className="glass absolute right-4 bottom-4 flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold"
            disabled={photo.isPending}
          >
            <Camera className="size-4" aria-hidden /> {photo.isPending ? "Загружаем…" : plant.photoUrl ? "Переснять" : "Сфотографировать"}
          </button>
          {/* Только съёмка камерой: фото из галереи и интернета в коллекцию не загружаются. */}
          <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(blob) => photo.mutate(blob)} />
        </div>

        <div>
          <h1 className="text-[40px] leading-tight font-bold tracking-tight">{plant.nickname}</h1>
          {species ? (
            <Link href={`/plants/${species.slug}/`} className="text-[17px] text-secondary hover:text-leaf">
              {plant.speciesName} · <i>{species.latinName}</i>
            </Link>
          ) : (
            <p className="text-[17px] text-secondary">{plant.speciesName ?? "Вид не указан"}</p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            {facts.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-2xl bg-surface p-3">
                <Icon className="size-4" style={{ color }} aria-hidden />
                <p className="mt-2 text-[12px] text-secondary">{label}</p>
                <p className="text-[15px] leading-tight font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <Button className="mt-5 min-h-13 w-full bg-water text-[17px]" onClick={() => mark("water")} loading={logCare.isPending}>
            <Droplet className="size-5" aria-hidden /> Полить
          </Button>
          <div className="mt-2 flex gap-2">
            {quickTypes.map((t) => {
              const Icon = CARE_ICONS[t];
              return (
                <Button key={t} variant="secondary" className="flex-1" onClick={() => mark(t)}>
                  <Icon className="size-4" style={{ color: CARE_COLORS[t] }} aria-hidden /> {CARE_TYPES[t].action}
                </Button>
              );
            })}
            <Button variant="secondary" onClick={() => setMoreOpen(true)} aria-label="Другой уход">
              <MoreHorizontal className="size-5" />
            </Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Link
              href={`/feed/new/?type=diary&plant=${plant.id}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-muted text-[15px] font-semibold"
            >
              <NotebookPen className="size-4" aria-hidden /> Запись в дневник
            </Link>
            <Link
              href={`/feed/plant/?id=${plant.id}`}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-muted text-[15px] font-semibold"
            >
              <BookOpen className="size-4" aria-hidden /> Дневник
            </Link>
          </div>
        </div>
      </div>

      <SectionTitle>График ухода</SectionTitle>
      <ul className="divide-y divide-separator rounded-[20px] bg-surface">
        {schedules.map((s) => {
          const Icon = CARE_ICONS[s.type];
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Icon className="size-5" style={{ color: CARE_COLORS[s.type] }} aria-hidden />
              <div className="flex-1">
                <p className="font-medium">{CARE_TYPES[s.type].label}</p>
                <p className="text-[13px] text-secondary">{everyDays(effectiveDays(s, plant, now))}</p>
              </div>
              <p className="text-[15px] text-secondary">{s.nextDueAt ? relativeDay(s.nextDueAt, now) : "—"}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[13px] text-secondary">
        Интервал учитывает сезон, горшок{plant.potMaterial ? ` (${POT_MATERIALS[plant.potMaterial].toLowerCase()})` : ""}, свет и то, как вы поливаете на
        самом деле.
      </p>

      <SectionTitle>Журнал</SectionTitle>
      {events.length === 0 ? (
        <p className="rounded-[20px] bg-surface p-4 text-secondary">Пока пусто — отметьте первый полив.</p>
      ) : (
        <ul className="divide-y divide-separator rounded-[20px] bg-surface">
          {events.slice(0, 20).map((e) => {
            const Icon = CARE_ICONS[e.type];
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-4" style={{ color: CARE_COLORS[e.type] }} aria-hidden />
                <span className="flex-1">{CARE_TYPES[e.type].label}</span>
                <span className="text-[15px] text-secondary">
                  {formatShortDate(e.performedAt)}, {e.performedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {soil && species && (
        <>
          <SectionTitle>Грунт для пересадки</SectionTitle>
          <SoilSummary mix={soil} href={`/plants/${species.slug}/#soil`} />
        </>
      )}

      {species?.care && species.care.tipsRu.length > 0 && (
        <>
          <SectionTitle
            action={
              <Link href={`/plants/${species.slug}/`} className="flex items-center gap-1 text-[15px] font-semibold text-leaf">
                <BookOpen className="size-4" aria-hidden /> Всё о виде
              </Link>
            }
          >
            Советы
          </SectionTitle>
          <ul className="space-y-2 rounded-[20px] bg-surface p-4">
            {species.care.tipsRu.map((t) => (
              <li key={t} className="flex gap-3 text-[15px]">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </>
      )}

      <Button variant="danger" className="mt-8" onClick={() => setConfirmDelete(true)}>
        <Trash2 className="size-4" aria-hidden /> Удалить из коллекции
      </Button>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Отметить уход">
        <div className="grid grid-cols-2 gap-2">
          {CARE_TYPE_ORDER.map((t) => {
            const Icon = CARE_ICONS[t];
            return (
              <button key={t} onClick={() => mark(t)} className="flex items-center gap-3 rounded-2xl bg-muted p-4 text-left font-medium">
                <Icon className="size-5" style={{ color: CARE_COLORS[t] }} aria-hidden /> {CARE_TYPES[t].label}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Удалить растение?">
        <p className="text-secondary">«{plant.nickname}» пропадёт из коллекции вместе с графиком ухода.</p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
          <Button className="flex-1 bg-alert" loading={remove.isPending} onClick={() => remove.mutate()}>
            Удалить
          </Button>
        </div>
      </Sheet>
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
