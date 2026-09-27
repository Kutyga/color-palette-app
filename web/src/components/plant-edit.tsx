"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useBackend } from "./session";
import { Button, Chip, Sheet, cx, inputClass, useToast } from "./ui";
import { LIGHT_LEVELS, type LightLevel } from "@/lib/domain/care";
import { useLocations } from "@/lib/queries";

/** Выбор места растения: существующее или новое; интервалы ухода пересчитываются под свет. */
export function LocationSheet({
  open,
  onClose,
  plantId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  plantId: string;
  current: string | null;
}) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const locations = useLocations();
  const [adding, setAdding] = useState<{ name: string; light: LightLevel } | null>(null);
  const save = useMutation({
    mutationFn: async (target: string | null | { name: string; light: LightLevel }) => {
      let id: string | null = typeof target === "object" && target !== null ? null : target;
      if (typeof target === "object" && target !== null) id = (await backend.garden.addLocation(target.name.trim(), target.light)).id;
      await backend.garden.setLocation(plantId, id);
    },
    onSuccess: () => {
      for (const key of ["plant", "plants", "tasks", "locations"]) qc.invalidateQueries({ queryKey: [key] });
      toast("Место сохранено — сроки ухода пересчитаны под свет");
      setAdding(null);
      onClose();
    },
    onError: (e) => toast(`Не удалось сохранить: ${e.message}`),
  });

  return (
    <Sheet open={open} onClose={onClose} title="Где стоит">
      <ul className="space-y-2">
        {[{ id: null as string | null, name: "Не указано", lightLevel: null as LightLevel | null }, ...(locations.data ?? [])].map((l) => (
          <li key={l.id ?? "none"}>
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(l.id)}
              className={cx(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left",
                current === l.id ? "bg-leaf/12 font-semibold" : "bg-muted",
              )}
            >
              <span className="flex-1">
                <span className="block">{l.name}</span>
                {l.lightLevel && <span className="block text-[13px] font-normal text-secondary">{LIGHT_LEVELS[l.lightLevel]}</span>}
              </span>
              {current === l.id && <Check className="size-5 text-leaf" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          className="mt-4 space-y-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (adding.name.trim()) save.mutate(adding);
          }}
        >
          <input
            className={inputClass}
            value={adding.name}
            onChange={(e) => setAdding({ ...adding, name: e.target.value })}
            placeholder="Например, Кухня — подоконник"
            maxLength={60}
            aria-label="Название места"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LIGHT_LEVELS) as LightLevel[]).map((k) => (
              <Chip key={k} active={adding.light === k} onClick={() => setAdding({ ...adding, light: k })}>
                {LIGHT_LEVELS[k]}
              </Chip>
            ))}
          </div>
          <Button type="submit" className="w-full" loading={save.isPending} disabled={!adding.name.trim()}>
            Сохранить место
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding({ name: "", light: "bright_indirect" })}
          className="mt-3 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-separator py-3 font-semibold text-leaf"
        >
          <Plus className="size-4" aria-hidden /> Новое место
        </button>
      )}
    </Sheet>
  );
}

/** Кнопка удаления ошибочной отметки в журнале — с подтверждением прямо в строке. */
export function DeleteEventButton({ eventId, label }: { eventId: string; label: string }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => backend.garden.deleteCareEvent(eventId),
    onSuccess: () => {
      for (const key of ["plant", "plants", "tasks", "done-today", "stats"]) qc.invalidateQueries({ queryKey: [key] });
      toast(`Отметка «${label}» удалена`);
    },
    onError: (e) => {
      setConfirm(false);
      toast(e.message);
    },
  });
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} aria-label={`Удалить отметку «${label}»`} className="grid size-8 place-items-center rounded-full text-secondary hover:bg-muted hover:text-alert">
        <Trash2 className="size-4" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded-full bg-alert px-3 py-1 text-[13px] font-semibold text-white">
        Удалить
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="rounded-full bg-muted px-3 py-1 text-[13px] font-semibold">
        Нет
      </button>
    </span>
  );
}
