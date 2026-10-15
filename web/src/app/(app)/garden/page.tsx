"use client";

/** Коллекция: все растения пользователя со статусом полива. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, Pencil, Plus, Sprout, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { NameForm } from "@/components/plant-card";
import { useBackend } from "@/components/session";
import { Chip, EmptyState, ErrorNote, PageHeader, PlantPhoto, Spinner, cx, useToast } from "@/components/ui";
import { plantPhotoUrl } from "@/lib/catalog";
import { GROUP_NAME_MAX, plantStatus, type PlantGroup, type PlantStatus } from "@/lib/domain/plant";
import { plural } from "@/lib/format";
import { useGroups, useLocations, usePlants, useStats } from "@/lib/queries";

const STATUS: Record<PlantStatus, { color: string; label: string }> = {
  ok: { color: "var(--leaf)", label: "всё хорошо" },
  soon: { color: "var(--water)", label: "скоро полив" },
  overdue: { color: "var(--alert)", label: "полив просрочен" },
};

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[22px] font-bold">{value}</p>
      <p className="text-secondary text-[13px]">{label}</p>
    </div>
  );
}

/**
 * Свои группы растений: фильтр коллекции («Бонсаи» — только бонсаи), новая группа,
 * переименование и удаление выбранной. Растения добавляют в группу на их странице.
 */
function GroupsBar({ selected, onSelect, count }: { selected: string | null; onSelect: (id: string | null) => void; count: number }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const groups = useGroups();
  const [mode, setMode] = useState<"idle" | "create" | "rename">("idle");
  const current = groups.data?.find((g) => g.id === selected) ?? null;
  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ["groups"] });
    setMode("idle");
    toast(msg);
  };
  const create = useMutation({
    mutationFn: (name: string) => backend.garden.createGroup(name),
    onSuccess: (g: PlantGroup) => {
      onSelect(g.id);
      done(`Группа «${g.name}» создана — добавляйте в неё растения на их страницах`);
    },
    onError: (e) => toast(e.message),
  });
  const rename = useMutation({
    mutationFn: (name: string) => backend.garden.renameGroup(selected!, name),
    onSuccess: (_d, name) => done(`Группа переименована: «${name}»`),
    onError: (e) => toast(e.message),
  });
  const share = useMutation({
    mutationFn: (isPublic: boolean) => backend.garden.setGroupPublic(selected!, isPublic),
    onSuccess: (_d, isPublic) =>
      done(isPublic ? "Группа видна в вашем профиле — гости увидят её растения, которые им и так открыты" : "Группа снова личная"),
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: () => backend.garden.deleteGroup(selected!),
    onSuccess: () => {
      onSelect(null);
      done("Группа удалена, растения остались в коллекции");
    },
    onError: (e) => toast(e.message),
  });

  return (
    <>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        {(groups.data ?? []).map((g) => (
          <Chip key={g.id} active={selected === g.id} onClick={() => onSelect(selected === g.id ? null : g.id)}>
            📁 {g.name}
          </Chip>
        ))}
        <button
          type="button"
          onClick={() => setMode("create")}
          className="text-leaf border-leaf/40 inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-dashed px-3 text-[14px] font-medium whitespace-nowrap"
        >
          <Plus className="size-4" aria-hidden /> Группа
        </button>
      </div>
      {mode === "create" && (
        <NameForm
          initial=""
          max={GROUP_NAME_MAX}
          label="Название группы"
          placeholder="Например, Бонсаи"
          busy={create.isPending}
          onSave={(name) => create.mutate(name)}
          onCancel={() => setMode("idle")}
          className="mt-3"
        />
      )}
      {current && mode === "rename" && (
        <NameForm
          initial={current.name}
          max={GROUP_NAME_MAX}
          label="Новое название группы"
          busy={rename.isPending}
          onSave={(name) => rename.mutate(name)}
          onCancel={() => setMode("idle")}
          className="mt-3"
        />
      )}
      {current && mode === "idle" && (
        <div className="bg-surface mt-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[14px]">
          <span className="min-w-0 flex-1 truncate">
            <b>{current.name}</b> · {count} {plural(count, "растение", "растения", "растений")}
            {count === 0 && <span className="text-secondary"> — добавьте растения на их страницах</span>}
            {current.isPublic && <span className="text-secondary"> · видна в профиле</span>}
          </span>
          <button
            type="button"
            onClick={() => share.mutate(!current.isPublic)}
            disabled={share.isPending}
            aria-label={current.isPublic ? "Сделать группу личной" : "Показывать группу в профиле"}
            title={current.isPublic ? "Видна в профиле — сделать личной" : "Личная — показывать в профиле"}
            className={cx("hover:bg-muted rounded-full p-2", current.isPublic && "text-leaf")}
          >
            {current.isPublic ? <Globe className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setMode("rename")}
            aria-label="Переименовать группу"
            className="hover:bg-muted rounded-full p-2"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Удалить группу"
            className="text-alert hover:bg-muted rounded-full p-2"
            disabled={remove.isPending}
            onClick={() => window.confirm(`Удалить группу «${current.name}»? Растения останутся в коллекции.`) && remove.mutate()}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}

function Collection() {
  const plants = usePlants();
  const locations = useLocations();
  const stats = useStats();
  const [location, setLocation] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const groups = useGroups();
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
          <Link href="/garden/new/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Добавить растение
          </Link>
        }
      />
    );
  }

  const inGroup = group ? new Set(groups.data?.find((g) => g.id === group)?.plantIds ?? []) : null;
  const shown = plants.data.filter((p) => (!location || p.locationId === location) && (!inGroup || inGroup.has(p.id)));
  const n = plants.data.length;
  const places = locations.data?.length ?? 0;
  const streak = stats.data?.currentStreak ?? 0;

  return (
    <>
      <div className="bg-surface grid grid-cols-3 rounded-[20px] py-4">
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

      <GroupsBar selected={group} onSelect={setGroup} count={shown.length} />

      <ul className="mt-4 grid grid-cols-2 gap-1 overflow-hidden rounded-[20px] sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => {
          const status = STATUS[plantStatus(p, now)];
          return (
            <li key={p.id}>
              <Link href={`/garden/plant/?id=${p.id}`} className="group relative block aspect-square overflow-hidden">
                <PlantPhoto
                  src={plantPhotoUrl(p)}
                  seed={p.id}
                  alt={p.nickname}
                  className="size-full transition group-hover:scale-105"
                  iconSize={40}
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pt-8 pb-2.5 text-white">
                  <span className="block truncate text-[15px] font-semibold">{p.nickname}</span>
                  {p.speciesName && <span className="block truncate text-[12px] opacity-80">{p.speciesName}</span>}
                </span>
                {p.inWater || p.wick ? (
                  <span
                    className="glass absolute top-2 right-2 rounded-full px-2 py-0.5 text-[12px] font-medium"
                    title={p.inWater ? "Растёт в воде" : "Фитильный полив"}
                  >
                    {p.inWater ? "💧 в воде" : "🧵 фитиль"}
                  </span>
                ) : (
                  <span
                    className="absolute top-2.5 right-2.5 size-3 rounded-full ring-2 ring-white"
                    style={{ background: status.color }}
                    title={status.label}
                    aria-label={status.label}
                  />
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/garden/new/"
            className={cx("bg-muted text-secondary hover:text-leaf grid aspect-square place-items-center transition")}
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
