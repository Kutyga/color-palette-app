"use client";

/** Журнал ухода: последние отметки; ошибочную можно удалить — график вернётся как был. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { CARE_COLORS, CARE_ICONS, useToast } from "@/components/ui";
import { CARE_TYPES, type CareEvent } from "@/lib/domain/care";
import { formatShortDate } from "@/lib/format";

/** Сколько последних отметок показывать в карточке. */
const JOURNAL_SIZE = 20;

/** Кнопка удаления ошибочной отметки в журнале — с подтверждением прямо в строке. */
function DeleteEventButton({ eventId, label }: { eventId: string; label: string }) {
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

export function CareJournal({ events }: { events: CareEvent[] }) {
  if (events.length === 0) return <p className="bg-surface text-secondary rounded-[20px] p-4">Пока пусто — отметьте первый полив.</p>;
  return (
    <>
      <p className="text-secondary -mt-1 mb-2 text-[13px]">Отметили по ошибке? Удалите отметку — график вернётся как был.</p>
      <ul className="divide-separator bg-surface divide-y rounded-[20px]" aria-label="Журнал ухода">
        {events.slice(0, JOURNAL_SIZE).map((e) => {
          const Icon = CARE_ICONS[e.type];
          return (
            <li key={e.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
              <Icon className="size-4" style={{ color: CARE_COLORS[e.type] }} aria-hidden />
              <span className="flex-1">{CARE_TYPES[e.type].label}</span>
              <span className="text-secondary text-[15px]">
                {formatShortDate(e.performedAt)}, {e.performedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <DeleteEventButton eventId={e.id} label={CARE_TYPES[e.type].label} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
