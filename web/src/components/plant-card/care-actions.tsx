"use client";

/**
 * Отметки ухода: большая кнопка «Полить», быстрые кнопки по графику, лист со всеми видами ухода
 * и выбор «Как поливаю»: по графику, фитиль или в воде (последним двум полив не напоминаем).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { Button, CARE_COLORS, CARE_ICONS, Sheet, cx, useToast } from "@/components/ui";
import { CARE_TYPES, CARE_TYPE_ORDER, type CareSchedule, type CareType } from "@/lib/domain/care";
import { waterModeOf, type Plant, type PlantDetails, type WaterMode } from "@/lib/domain/plant";
import { WICK_HOWTO, wickAdvice } from "@/lib/domain/wick";
import { useLogCare } from "@/lib/queries";

const WATER_MODES: { mode: WaterMode; label: string }[] = [
  { mode: "soil", label: "По графику" },
  { mode: "wick", label: "Фитиль" },
  { mode: "water", label: "В воде" },
];

/** Подходит ли фитиль этому виду — из базы знаний (грузится только здесь). */
function WickAdviceNote({ slug }: { slug: string | null }) {
  const advice = useQuery({
    queryKey: ["wick-advice", slug],
    queryFn: async () => {
      const s = (await import("@/lib/knowledge")).speciesBySlug(slug);
      return s ? wickAdvice(s.group, s.care) : null;
    },
    enabled: !!slug,
    staleTime: Infinity,
  });
  if (!advice.data) return null;
  const a = advice.data;
  return (
    <p className={cx("mt-2 text-[14px] font-medium", a.fit === "good" ? "text-leaf" : a.fit === "no" ? "text-alert" : "text-soil")}>
      {a.fit === "good" ? "✓" : a.fit === "no" ? "⚠️" : "•"} {a.title}. {a.text}
    </p>
  );
}

/** Как растение получает воду: по графику, фитиль из резервуара или растёт в воде. */
function WaterModePicker({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  // Выбор показываем сразу, не дожидаясь ответа; сбрасываем только при ошибке.
  const [picked, setPicked] = useState<WaterMode | null>(null);
  const save = useMutation({
    mutationFn: (mode: WaterMode) => backend.garden.setWaterMode(plant.id, mode),
    onSuccess: (_d, mode) => {
      qc.setQueryData<PlantDetails>(["plant", plant.id], (d) =>
        d ? { ...d, plant: { ...d.plant, inWater: mode === "water", wick: mode === "wick" } } : d,
      );
      for (const key of ["plant", "plants", "tasks", "stats"]) qc.invalidateQueries({ queryKey: [key] });
      toast(
        mode === "water"
          ? "Растёт в воде — полив больше не напоминаем"
          : mode === "wick"
            ? "Фитильный полив — полив больше не напоминаем"
            : "Полив снова в графике",
      );
    },
    onError: (e) => {
      setPicked(null);
      toast(`Не удалось сохранить: ${e.message}`);
    },
  });
  const current = picked ?? waterModeOf(plant);
  return (
    <div className="bg-muted mt-2 rounded-xl px-4 py-3">
      <p className="text-[15px] font-medium">Как поливаю</p>
      <div className="bg-surface mt-2 flex rounded-full p-1" role="radiogroup" aria-label="Как поливаю">
        {WATER_MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={current === mode}
            disabled={save.isPending}
            onClick={() => {
              if (mode === current) return;
              setPicked(mode);
              save.mutate(mode);
            }}
            className={cx(
              "flex-1 rounded-full py-1.5 text-[14px] font-medium transition",
              current === mode ? "bg-water text-white" : "text-secondary",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {current === "wick" && <WickAdviceNote slug={plant.speciesSlug} />}
    </div>
  );
}

export function CareActions({ plant, schedules }: { plant: Plant; schedules: CareSchedule[] }) {
  const logCare = useLogCare();
  const toast = useToast();
  const [moreOpen, setMoreOpen] = useState(false);
  const quickTypes = schedules.map((s) => s.type).filter((t) => t !== "water");

  async function mark(type: CareType) {
    setMoreOpen(false);
    try {
      await logCare.mutateAsync({ plantId: plant.id, type });
      toast(`${CARE_TYPES[type].label}: ${plant.nickname} — готово`);
    } catch (e) {
      toast(`Не удалось сохранить: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <>
      {plant.inWater ? (
        <p className="bg-water/10 mt-5 rounded-2xl px-4 py-3 text-[15px]">
          💧 Растёт в воде — поливать не нужно. Меняйте воду раз в 5–7 дней на отстоянную комнатной температуры и следите, чтобы вода не
          зеленела.
        </p>
      ) : plant.wick ? (
        <p className="bg-water/10 mt-5 rounded-2xl px-4 py-3 text-[15px]">🧵 Фитильный полив — график не нужен. {WICK_HOWTO}</p>
      ) : (
        <Button className="bg-water mt-5 min-h-13 w-full text-[17px]" onClick={() => mark("water")} loading={logCare.isPending}>
          <Droplet className="size-5" aria-hidden /> Полить
        </Button>
      )}
      <WaterModePicker plant={plant} />
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

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Отметить уход">
        <div className="grid grid-cols-2 gap-2">
          {CARE_TYPE_ORDER.map((t) => {
            const Icon = CARE_ICONS[t];
            return (
              <button
                type="button"
                key={t}
                onClick={() => mark(t)}
                className="bg-muted flex items-center gap-3 rounded-2xl p-4 text-left font-medium"
              >
                <Icon className="size-5" style={{ color: CARE_COLORS[t] }} aria-hidden /> {CARE_TYPES[t].label}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
