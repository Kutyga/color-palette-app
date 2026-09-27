/** Диагностика: согласованность справочника, подбор причин по симптомам, коды EPPO и отсев слабых догадок. */

import { describe, expect, it } from "vitest";
import { CAUSE_IDS } from "../../../../../supabase/functions/identify-plant/gemini";
import { CAUSES, SYMPTOMS, confidentGuesses, describeEppo, diagnose } from "../diagnosis";

describe("«Что с растением?»", () => {
  it("справочник согласован: у каждой причины известные симптомы, каждый симптом к чему-то ведёт", () => {
    const ids = new Set(SYMPTOMS.map((s) => s.id));
    expect(ids.size).toBe(SYMPTOMS.length);
    for (const c of CAUSES) for (const s of c.symptoms) expect(ids.has(s), `${c.id}: ${s}`).toBe(true);
    for (const s of SYMPTOMS)
      expect(
        CAUSES.some((c) => c.symptoms.includes(s.id)),
        s.id,
      ).toBe(true);
  });

  it("мокрая земля + запах + тёмный стебель → корневая гниль первой", () => {
    const [first] = diagnose(["soil_wet", "bad_smell", "stem_black"]);
    expect(first.cause.id).toBe("root_rot");
    expect(first.matched).toHaveLength(3);
    expect(first.score).toBe(1);
  });

  it("паутинка → клещ; мошки → сциариды; без симптомов — пусто", () => {
    expect(diagnose(["webs"])[0].cause.id).toBe("spider_mite");
    expect(diagnose(["gnats"])[0].cause.id).toBe("fungus_gnats");
    expect(diagnose([])).toEqual([]);
    expect(diagnose(["yellow_lower", "brown_tips", "drooping", "curling", "leaf_drop"])).toHaveLength(4);
  });

  it("код EPPO: знакомый — по-русски и с советом, род — по первым буквам, незнакомый — как есть", () => {
    expect(describeEppo({ eppo: "TETRUR", score: 0.8, name: "Tetranychus urticae" })).toMatchObject({
      name: "Паутинный клещ",
      cause: { id: "spider_mite" },
    });
    expect(describeEppo({ eppo: "BOTRAL", score: 0.5, name: "Botrytis" })).toMatchObject({ name: "Серая гниль" });
    expect(describeEppo({ eppo: "ZZZZZZ", score: 0.5, name: "Unknown blight" })).toEqual({ name: "Unknown blight", cause: null });
  });

  it("слабые догадки по фото (шум на здоровом растении) отбрасываются", () => {
    const guesses = [
      { eppo: "ERYSSP", score: 0.62, name: "Erysiphe" },
      { eppo: "RIZSPI", score: 0.08, name: "Rhizosphaera pini" },
    ];
    expect(confidentGuesses(guesses).map((g) => g.eppo)).toEqual(["ERYSSP"]);
  });

  it("Gemini выбирает причины из того же справочника, что и сайт", () => {
    expect([...CAUSE_IDS].sort()).toEqual(CAUSES.map((c) => c.id).sort());
  });
});
