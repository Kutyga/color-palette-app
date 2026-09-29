/** База знаний: поиск, подборки и группы видов комнатных растений. */

import type { Metadata } from "next";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { GroupTile } from "@/components/species-list";
import { PageHeader } from "@/components/ui";
import { CATALOG, CATALOG_GROUPS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "База знаний",
  description: `Уход за ${CATALOG.length} комнатными растениями по группам — ароидные, калатеи, суккуленты, орхидеи, пальмы: свет, полив летом и зимой, влажность, подкормки и токсичность для питомцев.`,
};

export default function PlantsPage() {
  return (
    <>
      <PageHeader eyebrow={`${CATALOG.length} растений`} title="Знания" />
      <KnowledgeBrowser>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG_GROUPS.map(({ group, species }) => (
            <GroupTile key={group.id} group={group} species={species} />
          ))}
        </div>
      </KnowledgeBrowser>
    </>
  );
}
