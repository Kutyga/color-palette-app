import { describe, expect, it } from "vitest";
import { SOIL_MATERIALS, componentVolumes, phLabel, soilMixFromRow, soilParticles } from "../soil";
import { speciesFromRow } from "../species";

const row = {
  slug: "aroid",
  name: { ru: "Ароидный рыхлый" },
  summary: { ru: "Для монстер" },
  components: [
    { material: "bark_fine", pct: 30, role: "loosener" },
    { material: "peat", pct: 40, role: "base" },
    { material: "perlite", pct: 25, role: "loosener" },
    { material: "charcoal", pct: 5, role: "additive" },
    { material: "unobtainium", pct: 10, role: "additive" },
  ],
  ph_min: "5.5",
  ph_max: 6.5,
  drainage: { material: "clay_pebbles", cm: 2 },
  top_layer: null,
  pot: { ru: "Пластиковый с отверстиями" },
  water_retention: 3,
  aeration: 4,
  tips: { ru: ["Не утрамбовывайте"] },
  sort: 1,
};

describe("состав грунта", () => {
  it("разбирает строку soil_mixes, сортирует компоненты и отбрасывает неизвестные", () => {
    const mix = soilMixFromRow(row);
    expect(mix.nameRu).toBe("Ароидный рыхлый");
    expect(mix.components.map((c) => c.material)).toEqual(["peat", "bark_fine", "perlite", "charcoal"]);
    expect(mix.phMin).toBe(5.5);
    expect(mix.drainage).toEqual({ material: "clay_pebbles", cm: 2 });
    expect(mix.tipsRu).toEqual(["Не утрамбовывайте"]);
  });

  it("пересчитывает доли в литры для горшка", () => {
    const v = componentVolumes(soilMixFromRow(row), 2);
    expect(v).toEqual([
      { material: "peat", liters: 0.8 },
      { material: "bark_fine", liters: 0.6 },
      { material: "perlite", liters: 0.5 },
      { material: "charcoal", liters: 0.1 },
    ]);
  });

  it("частицы схемы детерминированы и повторяют пропорции", () => {
    const mix = soilMixFromRow(row);
    const a = soilParticles(mix, 100, 3);
    expect(soilParticles(mix, 100, 3)).toEqual(a);
    const count = (m: string) => a.filter((p) => p.material === m).length;
    // Торфа (40%, мелкий) больше, чем крупной коры (30%).
    expect(count("peat")).toBeGreaterThan(count("bark_fine"));
    expect(a.every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1)).toBe(true);
  });

  it("называет кислотность словами", () => {
    expect(phLabel(4, 5)).toBe("кислый");
    expect(phLabel(5.5, 6.5)).toBe("слабокислый");
    expect(phLabel(6.2, 7.2)).toBe("нейтральный");
    expect(phLabel(7, 8)).toBe("слабощелочной");
    expect(phLabel(5, 6)).toBe("слабокислый");
  });

  it("у каждого компонента палитры есть цвет и подпись", () => {
    for (const m of Object.values(SOIL_MATERIALS)) {
      expect(m.label).toBeTruthy();
      expect(m.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("фото и грунт в карточке вида", () => {
  it("берёт фото, автора и грунт из строки", () => {
    const s = speciesFromRow({
      id: "x", slug: "x", latin_name: "X y", common_names: {}, synonyms: [], description: {},
      image_url: "https://upload.wikimedia.org/a.jpg", image_credit: "Автор", image_license: "CC BY-SA 4.0",
      image_source_url: "https://commons.wikimedia.org/wiki/File:A.jpg",
      care_profiles: { water_interval_summer: 7, water_interval_winter: 14, tips: {}, soil_mix_slug: "aroid", soil_note: { ru: "Больше коры" } },
    });
    expect(s.image).toEqual({ url: "https://upload.wikimedia.org/a.jpg", credit: "Автор", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:A.jpg" });
    expect(s.care?.soilMixSlug).toBe("aroid");
    expect(s.care?.soilNoteRu).toBe("Больше коры");
    expect(speciesFromRow({ slug: "y", latin_name: "Y", common_names: {}, care_profiles: null }).image).toBeNull();
  });
});
