/**
 * Иконки и цвета видов ухода — одинаковые на всех экранах.
 */

import { Bug, Droplet, FlaskConical, RotateCw, Scissors, Shovel, Sparkles, SprayCan, type LucideIcon } from "lucide-react";
import type { CareType } from "@/lib/domain/care";

export const CARE_ICONS: Record<CareType, LucideIcon> = {
  water: Droplet,
  fertilize: FlaskConical,
  mist: SprayCan,
  repot: Shovel,
  prune: Scissors,
  rotate: RotateCw,
  clean_leaves: Sparkles,
  treat_pests: Bug,
};

/** Цвет вида ухода: полив — вода, подкормка и пересадка — почва, опрыскивание — туман. */
export const CARE_COLORS: Record<CareType, string> = {
  water: "var(--water)",
  fertilize: "var(--soil)",
  mist: "var(--mist)",
  repot: "var(--soil)",
  prune: "var(--leaf)",
  rotate: "var(--leaf)",
  clean_leaves: "var(--mist)",
  treat_pests: "var(--alert)",
};
