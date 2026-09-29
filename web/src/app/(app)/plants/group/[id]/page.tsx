/** Группа базы знаний («Ароидные», «Кактусы и суккуленты»…): компактный список видов. Собирается заранее. */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeciesRows } from "@/components/species-list";
import { PageHeader } from "@/components/ui";
import { CATALOG_GROUPS } from "@/lib/catalog";
import { speciesName } from "@/lib/domain/species";
import { plural } from "@/lib/format";

const findGroup = (id: string) => CATALOG_GROUPS.find((g) => g.group.id === id) ?? null;

export function generateStaticParams() {
  return CATALOG_GROUPS.map(({ group }) => ({ id: group.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/plants/group/[id]">): Promise<Metadata> {
  const g = findGroup((await params).id);
  if (!g) return {};
  const examples = g.species.slice(0, 4).map(speciesName).join(", ");
  return {
    title: `${g.group.title} — уход в домашних условиях`,
    description: `${g.group.title}: ${g.species.length} видов — ${examples} и другие. ${g.group.subtitle}.`,
  };
}

export default async function GroupPage({ params }: PageProps<"/plants/group/[id]">) {
  const g = findGroup((await params).id);
  if (!g) notFound();
  const { group, species } = g;
  const petSafe = species.filter((s) => s.toxicToPets === false).length;

  return (
    <>
      <nav className="text-secondary pt-6 text-[15px]">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        / {group.title}
      </nav>
      <PageHeader eyebrow={`${species.length} ${plural(species.length, "вид", "вида", "видов")}`} title={group.title} />
      <p className="text-secondary -mt-2 text-[17px]">
        {group.subtitle}
        {petSafe > 0 && ` · безопасных для животных: ${petSafe}`}
      </p>
      <SpeciesRows species={species} />
      <p className="mt-8">
        <Link href="/plants/" className="text-leaf text-[17px] font-semibold">
          ← Все группы
        </Link>
      </p>
    </>
  );
}
