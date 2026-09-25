"use client";

import { useEffect, useRef } from "react";
import { evaluateAchievements } from "@/lib/domain/gamification";
import { useStats } from "@/lib/queries";
import { useToast } from "./ui";

/** Поздравляет с новым достижением сразу после полива, поста или нового растения. */
export function AchievementWatcher() {
  const stats = useStats();
  const toast = useToast();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!stats.data) return;
    const unlocked = evaluateAchievements(stats.data).filter((p) => p.unlocked);
    if (seen.current) {
      for (const p of unlocked) {
        if (!seen.current.has(p.achievement.id)) toast(`Новое достижение! «${p.achievement.title}»`);
      }
    }
    seen.current = new Set(unlocked.map((p) => p.achievement.id));
  }, [stats.data, toast]);

  return null;
}
