"use client";

/** Три главных факта: когда полить, сколько света и где стоит (место можно сменить). */

import { Droplet, MapPin, Sun } from "lucide-react";
import { useState } from "react";
import { LIGHT_LEVELS, type CareSchedule } from "@/lib/domain/care";
import type { Plant } from "@/lib/domain/plant";
import { relativeDay } from "@/lib/format";
import { LocationSheet } from "./location";

function Fact({ icon: Icon, label, value, color }: { icon: typeof Droplet; label: string; value: string; color: string }) {
  return (
    <>
      <Icon className="size-4" style={{ color }} aria-hidden />
      <p className="text-secondary mt-2 text-[12px]">{label}</p>
      <p className="text-[15px] leading-tight font-semibold">{value}</p>
    </>
  );
}

export function PlantFacts({ plant, water, now }: { plant: Plant; water: CareSchedule | undefined; now: Date }) {
  const [locationOpen, setLocationOpen] = useState(false);
  const place = plant.locationName ?? "не указано";
  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      <div className="bg-surface rounded-2xl p-3">
        {plant.inWater ? (
          <Fact icon={Droplet} label="Полив" value="не нужен — в воде" color="var(--water)" />
        ) : plant.wick ? (
          <Fact icon={Droplet} label="Полив" value="фитиль" color="var(--water)" />
        ) : (
          <Fact icon={Droplet} label="Полить" value={water?.nextDueAt ? relativeDay(water.nextDueAt, now) : "—"} color="var(--water)" />
        )}
      </div>
      <div className="bg-surface rounded-2xl p-3">
        <Fact icon={Sun} label="Свет" value={plant.lightLevel ? LIGHT_LEVELS[plant.lightLevel] : "не указан"} color="var(--soil)" />
      </div>
      <button
        type="button"
        onClick={() => setLocationOpen(true)}
        aria-label={`Место: ${place}. Изменить`}
        className="bg-surface rounded-2xl p-3 text-left transition hover:brightness-95"
      >
        <Fact icon={MapPin} label="Место · изменить" value={place} color="var(--leaf)" />
      </button>
      <LocationSheet open={locationOpen} onClose={() => setLocationOpen(false)} plantId={plant.id} current={plant.locationId} />
    </div>
  );
}
