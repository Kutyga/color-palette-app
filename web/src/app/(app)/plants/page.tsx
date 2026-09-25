import type { Metadata } from "next";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { PageHeader } from "@/components/ui";
import { ALL_SPECIES } from "@/lib/knowledge";

export const metadata: Metadata = {
  title: "База знаний",
  description: `Уход за ${ALL_SPECIES.length} комнатными растениями: свет, полив летом и зимой, влажность, температура, подкормки и токсичность для питомцев.`,
};

export default function PlantsPage() {
  return (
    <>
      <PageHeader eyebrow={`${ALL_SPECIES.length} растений`} title="Знания" />
      <KnowledgeBrowser />
    </>
  );
}
