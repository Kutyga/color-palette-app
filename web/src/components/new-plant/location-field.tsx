"use client";

/** «Где стоит»: одно из мест пользователя, «не указано» или новое место со светом. */

import { cx, inputClass } from "@/components/ui";
import { LIGHT_LEVELS, type LightLevel } from "@/lib/domain/care";
import { useLocations } from "@/lib/queries";

/** Выбранное место: существующее (id; null — не указано) или новое, которое создадим при сохранении. */
export type LocationChoice = { id: string | null } | { name: string; light: LightLevel };

const NEW = "__new";

export function LocationField({ value, onChange }: { value: LocationChoice; onChange: (v: LocationChoice) => void }) {
  const locations = useLocations();
  if ("name" in value) {
    return (
      <div className="flex gap-2">
        <input
          className={inputClass}
          autoFocus
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="Гостиная, южное окно"
          aria-label="Название места"
        />
        <select
          className={cx(inputClass, "w-auto")}
          value={value.light}
          onChange={(e) => onChange({ ...value, light: e.target.value as LightLevel })}
          aria-label="Освещение"
        >
          {Object.entries(LIGHT_LEVELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <select
      className={inputClass}
      aria-label="Где стоит"
      value={value.id ?? ""}
      onChange={(e) => onChange(e.target.value === NEW ? { name: "", light: "bright_indirect" } : { id: e.target.value || null })}
    >
      <option value="">Не указано</option>
      {locations.data?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
          {l.lightLevel ? ` · ${LIGHT_LEVELS[l.lightLevel].toLowerCase()}` : ""}
        </option>
      ))}
      <option value={NEW}>+ Новое место…</option>
    </select>
  );
}
