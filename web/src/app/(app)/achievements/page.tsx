"use client";

import {
  Anchor,
  Armchair,
  BookOpen,
  Camera,
  Cat,
  ChefHat,
  Cloud,
  Droplet,
  Droplets,
  Flame,
  Heart,
  Leaf,
  Library,
  Lock,
  Moon,
  Mountain,
  Sprout,
  Star,
  Sun,
  Sunrise,
  TreePalm,
  Trees,
  Truck,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { RequireSession } from "@/components/app-shell";
import { Card, ErrorNote, PageHeader, ProgressRing, Spinner, cx } from "@/components/ui";
import { TIERS, evaluateAchievements, levelFor, type AchievementProgress, type Tier } from "@/lib/domain/gamification";
import { plural } from "@/lib/format";
import { useStats } from "@/lib/queries";

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  Sprout, Droplet, Truck, Camera, Armchair, Leaf, Flame, Droplets, ChefHat, Cloud, Cat, Mountain, Sunrise, Moon,
  BookOpen, Heart, Trees, Zap, Waves, Library, TreePalm, Sun, Star, Anchor,
};

function Badge({ p }: { p: AchievementProgress }) {
  const { achievement: a, unlocked } = p;
  const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Star;
  const [from, to] = TIERS[a.tier].gradient;
  const hidden = a.secret && !unlocked;
  return (
    <li className={cx("flex flex-col items-center rounded-[20px] bg-surface p-4 text-center", !unlocked && "opacity-80")}>
      {unlocked ? (
        <span className="grid size-16 place-items-center rounded-full text-white shadow-md" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
          <Icon className="size-8" aria-hidden />
        </span>
      ) : (
        <ProgressRing progress={p.fraction} color={to} size={64} stroke={5} label={`${Math.round(p.fraction * 100)}%`}>
          {hidden ? <Lock className="size-6 text-secondary" aria-hidden /> : <Icon className="size-7 text-secondary" aria-hidden />}
        </ProgressRing>
      )}
      <p className="mt-3 text-[15px] leading-tight font-semibold">{hidden ? "Секрет" : a.title}</p>
      <p className="mt-1 text-[13px] text-secondary">{hidden ? "Откроется неожиданно" : a.description}</p>
      {!unlocked && !hidden && (
        <p className="mt-1.5 text-[12px] font-medium text-secondary">
          {Math.min(p.current, a.target)} / {a.target}
        </p>
      )}
    </li>
  );
}

function Achievements() {
  const stats = useStats();
  if (stats.isPending) return <Spinner />;
  if (stats.error) return <ErrorNote error={stats.error} onRetry={() => stats.refetch()} />;
  const lp = levelFor(stats.data);
  const progress = evaluateAchievements(stats.data);
  const unlocked = progress.filter((p) => p.unlocked).length;

  return (
    <>
      <Card className="flex flex-col items-center gap-5 p-6 sm:flex-row">
        <ProgressRing progress={lp.fraction} size={112} stroke={12} label={`Уровень ${lp.level.number}`}>
          <span className="text-center">
            <span className="block text-[34px] leading-none font-bold">{lp.level.number}</span>
            <span className="text-[12px] text-secondary">уровень</span>
          </span>
        </ProgressRing>
        <div className="text-center sm:text-left">
          <p className="text-[28px] font-bold tracking-tight">{lp.level.title}</p>
          <p className="text-secondary">
            {lp.xp} XP{lp.next ? ` · до «${lp.next.title}» ещё ${lp.xpToNext} XP` : " · высший уровень"}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-[13px] font-medium sm:justify-start">
            <span className="rounded-full bg-soil/15 px-3 py-1 text-soil">
              Серия: {stats.data.currentStreak} {plural(stats.data.currentStreak, "день", "дня", "дней")} · рекорд {stats.data.bestStreak}
            </span>
            <span className="rounded-full bg-leaf/15 px-3 py-1 text-leaf">
              {unlocked} из {progress.length} наград
            </span>
          </div>
        </div>
      </Card>

      {(Object.keys(TIERS) as Tier[]).map((tier) => (
        <section key={tier}>
          <h2 className="mt-8 mb-3 flex items-baseline gap-2 text-[20px] font-semibold">
            {TIERS[tier].label}
            <span className="text-[13px] font-medium text-secondary">+{TIERS[tier].xp} XP за каждую</span>
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {progress
              .filter((p) => p.achievement.tier === tier)
              .map((p) => (
                <Badge key={p.achievement.id} p={p} />
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

export default function AchievementsPage() {
  return (
    <>
      <PageHeader title="Достижения" />
      <RequireSession>
        <Achievements />
      </RequireSession>
    </>
  );
}
