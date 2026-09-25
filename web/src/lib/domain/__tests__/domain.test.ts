import { describe, expect, it } from "vitest";
import { adjustUserFactor, baseWaterInterval, effectiveIntervalDays, nextDue, taskBucket } from "../care";
import { EMPTY_STATS, ACHIEVEMENTS, TIERS, evaluateAchievements, experience, levelFor } from "../gamification";
import { capitalizeLatin, matchSpecies } from "../identification";
import { searchLocal, type Species } from "../species";
import { plural, relativeDay } from "../../format";

// Ожидаемые значения совпадают с supabase/tests/smoke_test.sql и тестами мобильного приложения —
// клиентская и серверная формулы должны давать одно и то же.
describe("интервал ухода", () => {
  const water = { type: "water" as const, intervalDays: 7, month: 7 };
  it("лето, пластик, яркий рассеянный: 7 × 0.85 × 1.1 = 6.5", () => {
    expect(effectiveIntervalDays({ ...water, pot: "plastic", light: "bright_indirect" })).toBe(6.5);
  });
  it("коэффициент пользователя 0.98: 6.4 дня", () => {
    expect(effectiveIntervalDays({ ...water, userFactor: 0.98, pot: "plastic", light: "bright_indirect" })).toBe(6.4);
  });
  it("терракота: 5.0", () => {
    expect(effectiveIntervalDays({ ...water, userFactor: 0.98, pot: "terracotta", light: "bright_indirect" })).toBe(5.0);
  });
  it("июль в южном полушарии — зима: 8.2", () => {
    expect(
      effectiveIntervalDays({ ...water, userFactor: 0.98, hemisphere: "S", pot: "terracotta", light: "bright_indirect" }),
    ).toBe(8.2);
  });
  it("без автоподстройки интервал не меняется", () => {
    expect(effectiveIntervalDays({ ...water, autoAdjust: false, month: 1, pot: "terracotta", light: "low" })).toBe(7);
  });
  it("сезон не влияет на пересадку", () => {
    expect(effectiveIntervalDays({ type: "repot", intervalDays: 730, month: 1 })).toBe(730);
  });
  it("интервал не бывает меньше полудня", () => {
    expect(effectiveIntervalDays({ ...water, intervalDays: 0.1 })).toBe(0.5);
  });
  it("подстройка под привычки", () => {
    expect(adjustUserFactor(1, 6.5, 6)).toBe(0.98);
    expect(adjustUserFactor(1, 7, 20)).toBe(1);
    expect(adjustUserFactor(1, 7, 1)).toBe(1);
    expect(adjustUserFactor(0.3, 10, 5)).toBe(0.3);
  });
  it("nextDue добавляет дробные дни", () => {
    expect(nextDue(new Date("2026-07-01T10:00:00Z"), 6.5).toISOString()).toBe("2026-07-07T22:00:00.000Z");
  });
  it("базовый интервал из летнего значения", () => {
    expect(baseWaterInterval(7)).toBe(8.2);
  });
  it("задачи делятся на просроченные, сегодняшние и скорые", () => {
    const now = new Date(2026, 8, 24, 12);
    const t = (d: Date) => ({ scheduleId: "s", plantId: "p", plantName: "x", type: "water" as const, dueAt: d });
    expect(taskBucket(t(new Date(2026, 8, 23, 23)), now)).toBe("overdue");
    expect(taskBucket(t(new Date(2026, 8, 24, 20)), now)).toBe("today");
    expect(taskBucket(t(new Date(2026, 8, 25, 8)), now)).toBe("soon");
  });
});

describe("геймификация", () => {
  it("новичок: семечко, до следующего уровня 100 XP", () => {
    expect(evaluateAchievements(EMPTY_STATS).filter((p) => p.unlocked)).toHaveLength(0);
    expect(levelFor(EMPTY_STATS).level.title).toBe("Семечко");
    expect(levelFor(EMPTY_STATS).xpToNext).toBe(100);
  });
  it("первое растение и полив открывают достижения и дают 85 XP", () => {
    const stats = { ...EMPTY_STATS, plants: 1, waterings: 1, careEvents: 1 };
    const unlocked = evaluateAchievements(stats).filter((p) => p.unlocked).map((p) => p.achievement.id);
    expect(unlocked).toEqual(expect.arrayContaining(["first_sprout", "wet_business"]));
    expect(experience(stats)).toBe(85);
  });
  it("прогресс серии", () => {
    const week = (best: number) =>
      evaluateAchievements({ ...EMPTY_STATS, bestStreak: best }).find((p) => p.achievement.id === "no_drought_week")!;
    expect(week(3).fraction).toBeCloseTo(3 / 7);
    expect(week(12).fraction).toBe(1);
    expect(week(12).unlocked).toBe(true);
  });
  it("в каждом уровне сложности есть достижения, id уникальны", () => {
    for (const tier of Object.keys(TIERS)) expect(ACHIEVEMENTS.some((a) => a.tier === tier)).toBe(true);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it("максимальный уровень", () => {
    const lp = levelFor({ ...EMPTY_STATS, waterings: 1000, careEvents: 1000, plants: 30 });
    expect(lp.level.title).toBe("Хранитель джунглей");
    expect(lp.next).toBeNull();
    expect(lp.fraction).toBe(1);
  });
});

const sp = (slug: string, latinName: string, ru: string[], synonyms: string[] = []): Species => ({
  id: slug, slug, latinName, commonNamesRu: ru, commonNamesEn: [], synonyms, descriptionRu: null, plantType: null,
  difficulty: null, toxicToPets: null, toxicToHumans: null, airPurifying: null, image: null, care: null,
});
const kb = [
  sp("monstera-deliciosa", "Monstera deliciosa", ["Монстера деликатесная", "Монстера"]),
  sp("monstera-adansonii", "Monstera adansonii", ["Монстера Адансона"]),
  sp("dracaena-trifasciata", "Dracaena trifasciata", ["Сансевиерия"], ["Sansevieria trifasciata"]),
  sp("alocasia-amazonica", "Alocasia × amazonica", ["Алоказия амазонская"]),
];

describe("сопоставление распознавания с базой знаний", () => {
  it("точное название, синоним, гибрид", () => {
    expect(matchSpecies({ label: "monstera deliciosa", score: 0.8 }, kb)).toMatchObject({ genusOnly: false, percent: 80, species: { slug: "monstera-deliciosa" } });
    expect(matchSpecies({ label: "Sansevieria trifasciata", score: 0.5 }, kb).species?.slug).toBe("dracaena-trifasciata");
    expect(matchSpecies({ label: "Alocasia amazonica", score: 0.5 }, kb).species?.slug).toBe("alocasia-amazonica");
  });
  it("только род", () => {
    const m = matchSpecies({ label: "Monstera obliqua", score: 0.4 }, kb);
    expect(m.genusOnly).toBe(true);
    expect(m.species?.slug).toBe("monstera-deliciosa");
  });
  it("нет в базе", () => {
    const m = matchSpecies({ label: "urtica dioica", score: 0.3, commonName: "Крапива двудомная" }, kb);
    expect(m.species).toBeNull();
    expect(m.commonName).toBe("Крапива двудомная");
    expect(capitalizeLatin(m.latinName)).toBe("Urtica dioica");
  });
});

describe("поиск в демо-режиме", () => {
  it("точное название первым", () => {
    expect(searchLocal(kb, "монстера")[0].slug).toBe("monstera-deliciosa");
    expect(searchLocal(kb, "sansevieria")[0].slug).toBe("dracaena-trifasciata");
    expect(searchLocal(kb, "")).toHaveLength(kb.length);
  });
});

describe("форматирование", () => {
  it("склонение", () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => plural(n, "день", "дня", "дней"))).toEqual(["день", "дня", "дней", "дней", "день", "дня", "дней"]);
  });
  it("относительные дни", () => {
    const now = new Date(2026, 8, 24, 12);
    expect(relativeDay(new Date(2026, 8, 24, 1), now)).toBe("сегодня");
    expect(relativeDay(new Date(2026, 8, 21), now)).toBe("3 дня назад");
    expect(relativeDay(new Date(2026, 8, 25), now)).toBe("завтра");
    expect(relativeDay(new Date(2028, 8, 24), now)).toBe("через 2 года");
    expect(relativeDay(new Date(2026, 10, 24), now)).toBe("через 2 месяца");
  });
});
