/** Срочность причины: подпись и цвет плашки. */

import type { Cause } from "@/lib/domain/diagnosis";

export const URGENCY: Record<Cause["urgency"], { label: string; tone: string }> = {
  1: { label: "Не срочно", tone: "bg-muted text-secondary" },
  2: { label: "Займитесь на этой неделе", tone: "bg-soil/15 text-soil" },
  3: { label: "Действуйте сегодня", tone: "bg-alert/15 text-alert" },
};
