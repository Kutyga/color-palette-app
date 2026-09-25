"use client";

import { Check, Flame, PartyPopper, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import {
  CARE_COLORS,
  CARE_ICONS,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  PlantPhoto,
  ProgressRing,
  SectionTitle,
  Spinner,
  cx,
  useIsClient,
  useToast,
} from "@/components/ui";
import { CARE_TYPES, taskBucket, type CareTask, type TaskBucket } from "@/lib/domain/care";
import { evaluateAchievements, levelFor } from "@/lib/domain/gamification";
import type { Plant } from "@/lib/domain/plant";
import { formatDate, plural, relativeDay } from "@/lib/format";
import { useDoneToday, useLogCare, usePlants, useStats, useTasks } from "@/lib/queries";

const SECTIONS: { bucket: TaskBucket; title: string }[] = [
  { bucket: "overdue", title: "Просрочено" },
  { bucket: "today", title: "Сегодня" },
  { bucket: "soon", title: "На неделе" },
];

function dueText(task: CareTask, bucket: TaskBucket, now: Date) {
  const label = CARE_TYPES[task.type].label.toLowerCase();
  if (bucket === "overdue") return `${label} · срок был ${relativeDay(task.dueAt, now)}`;
  if (bucket === "today") return `${label} · сегодня`;
  return `${label} · ${relativeDay(task.dueAt, now)}`;
}

function TaskRow({ task, bucket, plant, now }: { task: CareTask; bucket: TaskBucket; plant?: Plant; now: Date }) {
  const logCare = useLogCare();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const Icon = CARE_ICONS[task.type];
  const color = bucket === "overdue" ? "var(--alert)" : CARE_COLORS[task.type];

  async function complete() {
    setDone(true);
    try {
      await logCare.mutateAsync({ plantId: task.plantId, type: task.type });
      toast(`${CARE_TYPES[task.type].label}: ${task.plantName} — готово`);
    } catch (e) {
      setDone(false);
      toast(`Не удалось сохранить: ${e instanceof Error ? e.message : e}`);
    }
  }

  return (
    <li className={cx("flex items-center gap-3 rounded-[20px] bg-surface p-3 pr-4 transition", done && "opacity-50")}>
      <Link href={`/garden/plant/?id=${task.plantId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative shrink-0">
          <PlantPhoto src={plant?.photoUrl} seed={task.plantId} alt="" className="size-14 rounded-2xl" iconSize={22} />
          <span className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-surface" style={{ color }}>
            <Icon className="size-4" aria-hidden />
          </span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold">{task.plantName}</p>
          <p className="truncate text-[15px]" style={{ color: bucket === "soon" ? "var(--secondary)" : color }}>
            {dueText(task, bucket, now)}
          </p>
        </div>
      </Link>
      <button
        onClick={complete}
        disabled={done}
        aria-label={`${CARE_TYPES[task.type].action}: ${task.plantName}`}
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-full transition active:scale-90",
          done ? "bg-leaf text-white" : "bg-muted text-secondary hover:bg-leaf hover:text-white",
        )}
      >
        <Check className={cx("size-5", done && "animate-pop")} strokeWidth={2.6} />
      </button>
    </li>
  );
}

/** Ряд «историй»: растения, которым нужен уход; кольцо — статус. */
function Stories({ plants, tasks, now }: { plants: Plant[]; tasks: CareTask[]; now: Date }) {
  const urgent = new Map<string, TaskBucket>();
  for (const t of tasks) {
    const b = taskBucket(t, now);
    if (b !== "soon" && urgent.get(t.plantId) !== "overdue") urgent.set(t.plantId, b);
  }
  const ordered = [...plants].sort((a, b) => (urgent.has(b.id) ? 1 : 0) - (urgent.has(a.id) ? 1 : 0));
  if (!ordered.length) return null;
  return (
    <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      {ordered.map((p) => {
        const state = urgent.get(p.id);
        const ring =
          state === "overdue"
            ? "linear-gradient(135deg, var(--soil), var(--alert))"
            : state === "today"
              ? "linear-gradient(135deg, var(--leaf), var(--water))"
              : "var(--separator)";
        return (
          <Link key={p.id} href={`/garden/plant/?id=${p.id}`} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
            <span className="rounded-full p-[3px]" style={{ background: ring }}>
              <span className="block rounded-full bg-bg p-[2px]">
                <PlantPhoto src={p.photoUrl} seed={p.id} alt={p.nickname} className="size-16 rounded-full" iconSize={24} />
              </span>
            </span>
            <span className="w-full truncate text-center text-[12px]">{p.nickname}</span>
          </Link>
        );
      })}
    </div>
  );
}

function TodayContent() {
  const tasks = useTasks();
  const plants = usePlants();
  const done = useDoneToday();
  const stats = useStats();
  const now = useMemo(() => new Date(), []);

  if (tasks.isPending || plants.isPending) return <Spinner />;
  if (tasks.error || plants.error) return <ErrorNote error={tasks.error ?? plants.error} onRetry={() => tasks.refetch()} />;

  const byPlant = new Map(plants.data.map((p) => [p.id, p]));
  const grouped = SECTIONS.map((s) => ({ ...s, tasks: tasks.data.filter((t) => taskBucket(t, now) === s.bucket) }));
  const pending = grouped.filter((g) => g.bucket !== "soon").flatMap((g) => g.tasks);
  const doneCount = done.data?.length ?? 0;
  const total = doneCount + pending.length;
  const waterPending = pending.filter((t) => t.type === "water").length;
  const waterDone = done.data?.filter((e) => e.type === "water").length ?? 0;
  const otherPending = pending.length - waterPending;
  const otherDone = doneCount - waterDone;
  const level = stats.data ? levelFor(stats.data) : null;
  const unlocked = stats.data ? evaluateAchievements(stats.data).filter((a) => a.unlocked).length : 0;

  if (!plants.data.length) {
    return (
      <EmptyState
        icon={PartyPopper}
        title="Начнём ваш сад"
        message="Добавьте первое растение — мы составим график полива по карточке вида и напомним, когда пора."
        action={
          <Link href="/garden/new/" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
            Добавить растение
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Card className="flex items-center gap-5 p-5">
        <div className="relative grid place-items-center">
          <ProgressRing progress={waterDone + waterPending ? waterDone / (waterDone + waterPending) : 1} color="var(--water)" size={88} stroke={10} label="Полив" />
          <div className="absolute">
            <ProgressRing progress={otherDone + otherPending ? otherDone / (otherDone + otherPending) : 1} color="var(--leaf)" size={60} stroke={10} label="Другой уход" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-semibold">
            {pending.length === 0 ? "На сегодня всё" : `${doneCount} из ${total} сделано`}
          </p>
          <p className="text-[15px] text-secondary">
            {pending.length === 0
              ? "Растения довольны. Загляните в ленту — посмотрите, что растёт у других."
              : `Ещё ${pending.length} ${plural(pending.length, "дело", "дела", "дел")} ждут заботы`}
          </p>
          {stats.data && level && (
            <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-medium">
              <span className="inline-flex items-center gap-1 rounded-full bg-soil/15 px-3 py-1 text-soil">
                <Flame className="size-3.5" aria-hidden />
                {stats.data.currentStreak
                  ? `${stats.data.currentStreak} ${plural(stats.data.currentStreak, "день", "дня", "дней")} подряд`
                  : "Начните серию"}
              </span>
              <Link href="/achievements/" className="inline-flex items-center gap-1 rounded-full bg-leaf/15 px-3 py-1 text-leaf">
                <Trophy className="size-3.5" aria-hidden /> Ур. {level.level.number} · {level.level.title} · {unlocked} {plural(unlocked, "награда", "награды", "наград")}
              </Link>
            </div>
          )}
        </div>
      </Card>

      <Stories plants={plants.data} tasks={tasks.data} now={now} />

      {pending.length === 0 && grouped[2].tasks.length === 0 && (
        <EmptyState icon={PartyPopper} title="Сегодня без забот" message="Все растения в порядке. Следующие дела появятся здесь." />
      )}

      {grouped.map(
        (g) =>
          g.tasks.length > 0 && (
            <section key={g.bucket}>
              <SectionTitle>{g.title}</SectionTitle>
              <ul className="space-y-2">
                {g.tasks.map((t) => (
                  <TaskRow key={t.scheduleId} task={t} bucket={g.bucket} plant={byPlant.get(t.plantId)} now={now} />
                ))}
              </ul>
            </section>
          ),
      )}
    </>
  );
}

export default function TodayPage() {
  const isClient = useIsClient();
  return (
    <>
      <PageHeader eyebrow={isClient ? formatDate(new Date()) : "\u00a0"} title="Сегодня" />
      <RequireSession>
        <TodayContent />
      </RequireSession>
    </>
  );
}
