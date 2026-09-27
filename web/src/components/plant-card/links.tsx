/** Переходы из карточки: дневник растения, проверка болезней, объявление на барахолке. */

import { BookOpen, NotebookPen, Stethoscope, Tag } from "lucide-react";
import Link from "next/link";
import { cx } from "@/components/ui";

const pill = "bg-muted inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-[15px] font-semibold";

export function PlantLinks({ plantId }: { plantId: string }) {
  return (
    <>
      <div className="mt-2 flex gap-2">
        <Link href={`/feed/new/?type=diary&plant=${plantId}`} className={pill}>
          <NotebookPen className="size-4" aria-hidden /> Запись в дневник
        </Link>
        <Link href={`/feed/plant/?id=${plantId}`} className={pill}>
          <BookOpen className="size-4" aria-hidden /> Дневник
        </Link>
      </div>
      <Link
        href={`/garden/diagnose/?plant=${plantId}`}
        className="bg-alert/10 text-alert mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
      >
        <Stethoscope className="size-4" aria-hidden /> Что-то не так? Проверить болезни
      </Link>
      <Link href={`/market/new/?plant=${plantId}`} className={cx(pill, "mt-2 w-full")}>
        <Tag className="size-4" aria-hidden /> Продать, отдать или обменять
      </Link>
    </>
  );
}
