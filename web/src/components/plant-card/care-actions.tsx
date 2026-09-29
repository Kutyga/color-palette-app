"use client";

/**
 * Отметки ухода: большая кнопка «Полить», быстрые кнопки по графику, лист со всеми видами ухода
 * и переключатель «Растёт в воде» (такому растению полив не напоминаем).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplet, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { Button, CARE_COLORS, CARE_ICONS, Sheet, useToast } from "@/components/ui";
import { CARE_TYPES, CARE_TYPE_ORDER, type CareSchedule, type CareType } from "@/lib/domain/care";
import type { Plant, PlantDetails } from "@/lib/domain/plant";
import { useLogCare } from "@/lib/queries";

function InWaterToggle({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  // Выбор пользователя показываем сразу, не дожидаясь ответа. Сбрасываем его только при ошибке:
  // после успеха он совпадает с кэшем карточки, а ранний сброс на миг возвращал старое значение.
  const [picked, setPicked] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: (inWater: boolean) => backend.garden.setInWater(plant.id, inWater),
    onSuccess: (_d, inWater) => {
      qc.setQueryData<PlantDetails>(["plant", plant.id], (d) => (d ? { ...d, plant: { ...d.plant, inWater } } : d));
      for (const key of ["plant", "plants", "tasks", "stats"]) qc.invalidateQueries({ queryKey: [key] });
      toast(inWater ? "Растёт в воде — полив больше не напоминаем" : "Полив снова в графике");
    },
    onError: (e) => {
      setPicked(null);
      toast(`Не удалось сохранить: ${e.message}`);
    },
  });
  return (
    <label className="bg-muted mt-2 flex items-center justify-between gap-3 rounded-xl px-4 py-3">
      <span>
        <span className="block text-[15px] font-medium">Растёт в воде</span>
        <span className="text-secondary block text-[13px]">Черенок в стакане или гидропоника</span>
      </span>
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-[var(--water)]"
        checked={picked ?? plant.inWater}
        disabled={save.isPending}
        onChange={(e) => {
          setPicked(e.target.checked);
          save.mutate(e.target.checked);
        }}
        aria-label="Растёт в воде"
      />
    </label>
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
      ) : (
        <Button className="bg-water mt-5 min-h-13 w-full text-[17px]" onClick={() => mark("water")} loading={logCare.isPending}>
          <Droplet className="size-5" aria-hidden /> Полить
        </Button>
      )}
      <InWaterToggle plant={plant} />
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
