"use client";

import { Plus, Sprout } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { Chip, EmptyState, ErrorNote, PageHeader, PlantPhoto, Spinner, cx } from "@/components/ui";
import { plantStatus, type PlantStatus } from "@/lib/domain/plant";
import { plural } from "@/lib/format";
import { useLocations, usePlants, useStats } from "@/lib/queries";

const STATUS: Record<PlantStatus, { color: string; label: string }> = {
  ok: { color: "var(--leaf)", label: "всё хорошо" },
  soon: { color: "var(--water)", label: "скоро полив" },
  overdue: { color: "var(--alert)", label: "полив просрочен" },
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[22px] font-bold">{value}</p>
      <p className="text-[13px] text-secondary">{label}</p>
    </div>
  );
}

function Collection() {
  const plants = usePlants();
  const locations = useLocations();
  const stats = useStats();
  const [location, setLocation] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  if (plants.isPending) return <Spinner />;
  if (plants.error) return <ErrorNote error={plants.error} onRetry={() => plants.refetch()} />;
  if (!plants.data.length) {
    return (
      <EmptyState
        icon={Sprout}
        title="Коллекция пока пуста"
        message="Добавьте растение — по фото или из базы знаний."
        action={
          <Link href="/garden/new/" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
            Добавить растение
          </Link>
        }
      />
    );
  }

  const shown = location ? plants.data.filter((p) => p.locationId === location) : plants.data;
  const n = plants.data.length;
  const places = locations.data?.length ?? 0;
  const streak = stats.data?.currentStreak ?? 0;

  return (
    <>
      <div className="grid grid-cols-3 rounded-[20px] bg-surface py-4">
        <Stat value={n} label={plural(n, "растение", "растения", "растений")} />
        <Stat value={places} label={plural(places, "место", "места", "мест")} />
        <Stat value={streak} label={`${plural(streak, "день", "дня", "дней")} заботы`} />
      </div>

      {places > 0 && (
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <Chip active={!location} onClick={() => setLocation(null)}>
            Все
          </Chip>
          {locations.data!.map((l) => (
            <Chip key={l.id} active={location === l.id} onClick={() => setLocation(location === l.id ? null : l.id)}>
              {l.name}
            </Chip>
          ))}
        </div>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-1 overflow-hidden rounded-[20px] sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => {
          const status = STATUS[plantStatus(p, now)];
          return (
            <li key={p.id}>
              <Link href={`/garden/plant/?id=${p.id}`} className="group relative block aspect-square overflow-hidden">
                <PlantPhoto src={p.photoUrl} seed={p.id} alt={p.nickname} className="size-full transition group-hover:scale-105" iconSize={40} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2.5 text-white">
                  <span className="block truncate text-[15px] font-semibold">{p.nickname}</span>
                  {p.speciesName && <span className="block truncate text-[12px] opacity-80">{p.speciesName}</span>}
                </span>
                <span
                  className="absolute top-2.5 right-2.5 size-3 rounded-full ring-2 ring-white"
                  style={{ background: status.color }}
                  title={status.label}
                  aria-label={status.label}
                />
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/garden/new/"
            className={cx("grid aspect-square place-items-center bg-muted text-secondary transition hover:text-leaf")}
            aria-label="Добавить растение"
          >
            <Plus className="size-10" strokeWidth={1.5} />
          </Link>
        </li>
      </ul>
    </>
  );
}

export default function GardenPage() {
  return (
    <>
      <PageHeader title="Коллекция" />
      <RequireSession>
        <Collection />
      </RequireSession>
    </>
  );
}
