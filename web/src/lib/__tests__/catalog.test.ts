import { describe, expect, it } from "vitest";
import index from "@/data/species-index.json";
import full from "@/data/species.json";
import { CATALOG, CATALOG_GROUPS, catalogBySlug, searchCatalog } from "../catalog";
import { SPECIES_GROUPS } from "../domain/groups";
import { indexRowOf } from "../domain/species";
import { ALL_SPECIES } from "../knowledge";

describe("лёгкий указатель базы знаний", () => {
  it("совпадает с полным снимком (scripts/sync-species.mjs и lib/domain дают одно и то же)", () => {
    expect(index).toEqual(ALL_SPECIES.map(indexRowOf));
  });

  it("заметно легче полного снимка", () => {
    expect(JSON.stringify(index).length).toBeLessThan(JSON.stringify(full).length * 0.4);
  });

  it("каждый вид — в известной группе, пустых групп нет, обложка — из своей группы", () => {
    const ids = new Set(SPECIES_GROUPS.map((g) => g.id));
    expect(CATALOG.filter((s) => !ids.has(s.group)).map((s) => s.slug)).toEqual([]);
    expect(CATALOG_GROUPS.map((g) => g.group.id)).toEqual(SPECIES_GROUPS.map((g) => g.id));
    for (const g of SPECIES_GROUPS) expect(catalogBySlug(g.cover)?.group, g.id).toBe(g.id);
  });

  it("группы по правилам: род, тип растения и программа подкормки", () => {
    const groupOf = (slug: string) => catalogBySlug(slug)?.group;
    expect(groupOf("monstera-deliciosa")).toBe("aroids");
    expect(groupOf("goeppertia-orbifolia")).toBe("marantaceae");
    expect(groupOf("dionaea-muscipula")).toBe("carnivorous");
    expect(groupOf("phalaenopsis-hybrid")).toBe("orchids");
    expect(groupOf("echeveria-elegans")).toBe("succulents");
    expect(groupOf("citrus-limon")).toBe("edible");
    expect(groupOf("hoya-carnosa")).toBe("vines");
    expect(groupOf("ficus-lyrata")).toBe("trees");
  });

  it("поиск по указателю: опечатки и сорта", () => {
    expect(
      searchCatalog("монстра")
        .slice(0, 3)
        .map((s) => s.slug),
    ).toContain("monstera-deliciosa");
    expect(searchCatalog("kinky")[0]?.slug).toBe("ficus-benjamina");
  });
});
