"use client";

/**
 * Имя растения с карандашом: имя часто появляется не сразу («через неделю назвала Бубликом») —
 * его можно поменять в любой момент, записи дневника подхватят новое имя.
 * Здесь же — маленькая форма названия, которой пользуются и группы.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useBackend } from "@/components/session";
import { cx, inputClass, useToast } from "@/components/ui";
import { PLANT_NAME_MAX, type Plant, type PlantDetails } from "@/lib/domain/plant";

/** Поле названия с «Сохранить» и «Отмена»; Escape — отмена. */
export function NameForm({
  initial,
  max,
  label,
  placeholder,
  busy,
  onSave,
  onCancel,
  className,
}: {
  initial: string;
  max: number;
  label: string;
  placeholder?: string;
  busy?: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState(initial);
  const name = value.trim();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name || busy) return;
    if (name === initial.trim()) onCancel();
    else onSave(name);
  }
  return (
    <form onSubmit={submit} className={cx("flex items-center gap-2", className)}>
      <input
        autoFocus
        className={cx(inputClass, "min-w-0 flex-1")}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button
        type="submit"
        disabled={!name || busy}
        aria-label="Сохранить"
        className="bg-leaf grid size-11 shrink-0 place-items-center rounded-full text-white disabled:opacity-50"
      >
        <Check className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Отмена"
        className="bg-muted grid size-11 shrink-0 place-items-center rounded-full"
      >
        <X className="size-5" aria-hidden />
      </button>
    </form>
  );
}

export function PlantName({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const rename = useMutation({
    mutationFn: (name: string) => backend.garden.renamePlant(plant.id, name),
    onSuccess: (_d, name) => {
      qc.setQueryData<PlantDetails>(["plant", plant.id], (d) => (d ? { ...d, plant: { ...d.plant, nickname: name } } : d));
      for (const key of ["plants", "feed", "people", "tasks"]) qc.invalidateQueries({ queryKey: [key] });
      setEditing(false);
      toast(`Теперь растение зовут «${name}»`);
    },
    onError: (e) => toast(`Не удалось переименовать: ${e.message}`),
  });
  if (editing) {
    return (
      <NameForm
        initial={plant.nickname}
        max={PLANT_NAME_MAX}
        label="Имя растения"
        busy={rename.isPending}
        onSave={(name) => rename.mutate(name)}
        onCancel={() => setEditing(false)}
        className="py-1"
      />
    );
  }
  return (
    <div className="flex items-start gap-2">
      <h1 className="min-w-0 text-[40px] leading-tight font-bold tracking-tight break-words">{plant.nickname}</h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Переименовать"
        title="Переименовать"
        className="text-secondary hover:text-leaf hover:bg-muted mt-2.5 grid size-9 shrink-0 place-items-center rounded-full"
      >
        <Pencil className="size-5" aria-hidden />
      </button>
    </div>
  );
}
