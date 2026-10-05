/** Статья «Новичкам»: текст из lib/guides.ts, собирается заранее для каждой статьи. */

import { AlertTriangle, ArrowRight, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeciesCard } from "@/components/species-list";
import { PageHeader } from "@/components/ui";
import { catalogBySlug } from "@/lib/catalog";
import type { SpeciesSummary } from "@/lib/domain/species";
import { GUIDES, guideBySlug, type GuideBlock } from "@/lib/guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/plants/guide/[slug]">): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  return g ? { title: g.title, description: g.summary } : {};
}

function Block({ block }: { block: GuideBlock }) {
  if ("p" in block) return <p className="text-[17px] leading-relaxed">{block.p}</p>;
  if ("h" in block) return <h2 className="pt-2 text-[22px] font-bold tracking-tight">{block.h}</h2>;
  if ("list" in block)
    return (
      <ul className="marker:text-leaf list-disc space-y-2 pl-5 text-[17px] leading-relaxed">
        {block.list.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    );
  if ("steps" in block)
    return (
      <ol className="space-y-3">
        {block.steps.map((t, i) => (
          <li key={t} className="flex gap-3 text-[17px] leading-relaxed">
            <span className="bg-leaf grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-bold text-white">{i + 1}</span>
            <span className="pt-0.5">{t}</span>
          </li>
        ))}
      </ol>
    );
  if ("tip" in block)
    return (
      <p className="bg-leaf/10 flex gap-3 rounded-2xl p-4 text-[16px] leading-relaxed">
        <Lightbulb className="text-leaf mt-0.5 size-5 shrink-0" aria-hidden />
        <span>{block.tip}</span>
      </p>
    );
  if ("warn" in block)
    return (
      <p className="bg-alert/10 flex gap-3 rounded-2xl p-4 text-[16px] leading-relaxed">
        <AlertTriangle className="text-alert mt-0.5 size-5 shrink-0" aria-hidden />
        <span>{block.warn}</span>
      </p>
    );
  if ("table" in block)
    return (
      <div className="bg-surface overflow-hidden rounded-[20px]">
        <table className="w-full text-left text-[15px] leading-snug">
          <thead className="text-secondary text-[13px]">
            <tr>
              <th className="px-4 pt-3 pb-1 font-semibold">{block.head[0]}</th>
              <th className="px-4 pt-3 pb-1 font-semibold">{block.head[1]}</th>
            </tr>
          </thead>
          <tbody className="divide-separator divide-y">
            {block.table.map(([a, b]) => (
              <tr key={a} className="align-top">
                <th scope="row" className="w-[38%] px-4 py-3 font-semibold">
                  {a}
                </th>
                <td className="px-4 py-3">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if ("plants" in block) {
    const list = block.plants.map(catalogBySlug).filter((s): s is SpeciesSummary => !!s);
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((s) => (
          <SpeciesCard key={s.slug} s={s} />
        ))}
      </div>
    );
  }
  return (
    <Link href={block.link.href} className="text-leaf inline-flex items-center gap-1.5 text-[17px] font-semibold">
      {block.link.label} <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

export default async function GuidePage({ params }: PageProps<"/plants/guide/[slug]">) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const i = GUIDES.indexOf(g);
  const next = GUIDES[i + 1];
  return (
    <article className="mx-auto max-w-2xl">
      <nav className="text-secondary pt-6 text-[15px]">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        /{" "}
        <Link href="/plants/guide/" className="hover:text-label">
          Новичкам
        </Link>
      </nav>
      <PageHeader eyebrow={`${g.emoji} ${g.minutes} мин чтения`} title={g.title} />
      <div className="space-y-5">
        {g.blocks.map((b, j) => (
          <Block key={j} block={b} />
        ))}
      </div>
      {next && (
        <Link href={`/plants/guide/${next.slug}/`} className="bg-surface mt-10 flex items-center gap-3 rounded-[20px] p-4">
          <span className="text-[24px]" aria-hidden>
            {next.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-secondary block text-[12px] font-semibold">Следующая статья</span>
            <span className="block font-semibold">{next.title}</span>
          </span>
          <ArrowRight className="text-secondary size-5 shrink-0" aria-hidden />
        </Link>
      )}
    </article>
  );
}
