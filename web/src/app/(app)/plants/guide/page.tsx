/** «Новичкам»: список статей для тех, кто только начинает, — в порядке чтения. */

import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { plural } from "@/lib/format";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Комнатные растения для начинающих",
  description: "Свет, полив, горшок, грунт, пересадка, подкормки, вредители и отпуск — всё, что нужно знать новичку о комнатных растениях.",
};

export default function GuidesPage() {
  return (
    <>
      <nav className="text-secondary pt-6 text-[15px]">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        / Новичкам
      </nav>
      <PageHeader eyebrow={`${GUIDES.length} ${plural(GUIDES.length, "статья", "статьи", "статей")}`} title="Новичкам" />
      <p className="text-secondary max-w-2xl text-[17px] leading-relaxed">
        Всё, что нужно, чтобы растения жили долго: от выбора окна до вредителей и отпуска. Читайте по порядку — или сразу то, что беспокоит.
      </p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g, i) => (
          <li key={g.slug}>
            <Link href={`/plants/guide/${g.slug}/`} className="bg-surface flex h-full items-center gap-3 rounded-[20px] p-4">
              <span className="bg-leaf/12 grid size-12 shrink-0 place-items-center rounded-2xl text-[24px]" aria-hidden>
                {g.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-secondary block text-[12px] font-semibold">
                  {i + 1} · {g.minutes} мин
                </span>
                <span className="block leading-snug font-semibold">{g.title}</span>
                <span className="text-secondary mt-0.5 line-clamp-2 block text-[13px] leading-snug">{g.summary}</span>
              </span>
              <ChevronRight className="text-secondary size-5 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
