"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useBackend } from "./session";
import { Button, Chip, Sheet, cx, inputClass, useToast } from "./ui";
import { LIGHT_LEVELS, type LightLevel } from "@/lib/domain/care";
import type { Location } from "@/lib/domain/plant";
import { plural } from "@/lib/format";
import { useLocations, usePlants } from "@/lib/queries";

/** Правка места: название, свет, удаление (растения остаются без места). */
function LocationEditor({ location, onDone }: { location: Location; onDone: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const plants = usePlants();
  const [name, setName] = useState(location.name);
  const [light, setLight] = useState<LightLevel | null>(location.lightLevel);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const here = (plants.data ?? []).filter((p) => p.locationId === location.id).length;
  const refresh = () => {
    for (const key of ["plant", "plants", "tasks", "locations"]) qc.invalidateQueries({ queryKey: [key] });
  };
  const save = useMutation({
    mutationFn: () => backend.garden.updateLocation(location.id, name, light),
    onSuccess: () => {
      refresh();
      const title = name.trim();
      toast(light !== location.lightLevel ? `«${title}»: сохранено, сроки ухода пересчитаны под свет` : `«${title}»: сохранено`);
      onDone();
    },
    onError: (e) => toast(`Не удалось сохранить: ${e.message}`),
  });
  const remove = useMutation({
    mutationFn: () => backend.garden.deleteLocation(location.id),
    onSuccess: () => {
      refresh();
      toast(`Место «${location.name}» удалено`);
      onDone();
    },
    onError: (e) => toast(`Не удалось удалить: ${e.message}`),
  });
  return (
    <form
      className="bg-muted space-y-3 rounded-2xl p-3"
      aria-label={`Изменить место «${location.name}»`}
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <input
        className={cx(inputClass, "bg-surface")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        aria-label="Название места"
        autoFocus
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Свет">
        {(Object.keys(LIGHT_LEVELS) as LightLevel[]).map((k) => (
          <Chip key={k} active={light === k} onClick={() => setLight(k)}>
            {LIGHT_LEVELS[k]}
          </Chip>
        ))}
      </div>
      {confirmDelete ? (
        <div className="space-y-2">
          <p className="text-[15px]">
            Удалить «{location.name}»?
            {here > 0 && ` ${here} ${plural(here, "растение останется", "растения останутся", "растений останутся")} без места.`}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Отмена
            </Button>
            <Button type="button" variant="danger" className="bg-surface flex-1" loading={remove.isPending} onClick={() => remove.mutate()}>
              Удалить
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Удалить место"
            className="bg-surface text-alert grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Trash2 className="size-5" />
          </button>
          <Button type="button" variant="secondary" className="bg-surface flex-1" onClick={onDone}>
            Отмена
          </Button>
          <Button type="submit" className="flex-1" loading={save.isPending} disabled={!name.trim()}>
            Сохранить
          </Button>
        </div>
      )}
    </form>
  );
}

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
  const [editing, setEditing] = useState<string | null>(null);
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
          <li key={l.id ?? "none"} className="flex items-center gap-2">
            {l.id && editing === l.id ? (
              <div className="flex-1">
                <LocationEditor location={{ id: l.id, name: l.name, lightLevel: l.lightLevel }} onDone={() => setEditing(null)} />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate(l.id)}
                  className={cx(
                    "flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-left",
                    current === l.id ? "bg-leaf/12 font-semibold" : "bg-muted",
                  )}
                >
                  <span className="flex-1">
                    <span className="block">{l.name}</span>
                    {l.lightLevel && <span className="text-secondary block text-[13px] font-normal">{LIGHT_LEVELS[l.lightLevel]}</span>}
                  </span>
                  {current === l.id && <Check className="text-leaf size-5" aria-hidden />}
                </button>
                {l.id && (
                  <button
                    type="button"
                    onClick={() => setEditing(l.id)}
                    aria-label={`Изменить место «${l.name}»`}
                    className="bg-muted text-secondary hover:text-label grid size-11 shrink-0 place-items-center rounded-full"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </>
            )}
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
          className="border-separator text-leaf mt-3 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 font-semibold"
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
      <button
        type="button"
        onClick={() => setConfirm(true)}
        aria-label={`Удалить отметку «${label}»`}
        className="text-secondary hover:bg-muted hover:text-alert grid size-8 place-items-center rounded-full"
      >
        <Trash2 className="size-4" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="bg-alert rounded-full px-3 py-1 text-[13px] font-semibold text-white"
      >
        Удалить
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="bg-muted rounded-full px-3 py-1 text-[13px] font-semibold">
        Нет
      </button>
    </span>
  );
}
