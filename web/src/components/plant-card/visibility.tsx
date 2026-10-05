"use client";

/** Кто видит растение: только я, подписчики или все — меняется в любой момент. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { cx, useToast } from "@/components/ui";
import { VISIBILITIES, type Plant, type PlantDetails, type Visibility } from "@/lib/domain/plant";

const HINTS: Record<Visibility, string> = {
  private: "Растение видите только вы",
  followers: "Растение видят ваши подписчики",
  public: "Растение видят все садоводы",
};

export function VisibilityPicker({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  // Выбор показываем сразу; при ошибке возвращаем прежний.
  const [picked, setPicked] = useState<Visibility | null>(null);
  const save = useMutation({
    mutationFn: (v: Visibility) => backend.garden.setVisibility(plant.id, v),
    onSuccess: (_d, v) => {
      qc.setQueryData<PlantDetails>(["plant", plant.id], (d) => (d ? { ...d, plant: { ...d.plant, visibility: v } } : d));
      for (const key of ["plants", "people"]) qc.invalidateQueries({ queryKey: [key] });
      toast(HINTS[v]);
    },
    onError: (e) => {
      setPicked(null);
      toast(`Не удалось сохранить: ${e.message}`);
    },
  });
  const current = picked ?? plant.visibility;
  return (
    <div className="bg-muted mt-2 rounded-xl px-4 py-3">
      <p className="flex items-center gap-2 text-[15px] font-medium">
        <Eye className="text-secondary size-4" aria-hidden /> Кто видит
      </p>
      <div className="bg-surface mt-2 flex rounded-full p-1" role="radiogroup" aria-label="Кто видит растение">
        {(Object.keys(VISIBILITIES) as Visibility[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={current === v}
            disabled={save.isPending}
            onClick={() => {
              if (v === current) return;
              setPicked(v);
              save.mutate(v);
            }}
            className={cx(
              "flex-1 rounded-full py-1.5 text-[14px] font-medium transition",
              current === v ? "bg-leaf text-white" : "text-secondary",
            )}
          >
            {VISIBILITIES[v]}
          </button>
        ))}
      </div>
    </div>
  );
}
