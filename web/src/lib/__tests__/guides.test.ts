/** Статьи «Новичкам»: виды и ссылки в тексте существуют, slug уникальны. */

import { describe, expect, it } from "vitest";
import { catalogBySlug } from "../catalog";
import { COURSE_LESSONS, GUIDES, LESSON_VIDEOS } from "../guides";

const APP_ROUTES = ["/plants/", "/plants/soil/", "/garden/new/", "/garden/diagnose/"];

describe("статьи для новичков", () => {
  it("slug уникальны, у каждой есть текст", () => {
    expect(new Set(GUIDES.map((g) => g.slug)).size).toBe(GUIDES.length);
    for (const g of GUIDES) expect(g.blocks.length).toBeGreaterThan(0);
  });

  it("все виды из статей есть в базе знаний", () => {
    const slugs = GUIDES.flatMap((g) => g.blocks.flatMap((b) => ("plants" in b ? b.plants : [])));
    expect(slugs.length).toBeGreaterThan(0);
    expect(slugs.filter((s) => !catalogBySlug(s))).toEqual([]);
  });

  it("ссылки ведут на существующие страницы", () => {
    const guides = new Set(GUIDES.map((g) => `/plants/guide/${g.slug}/`));
    const hrefs = GUIDES.flatMap((g) => g.blocks.flatMap((b) => ("link" in b ? [b.link.href] : [])));
    expect(hrefs.filter((h) => !guides.has(h) && !APP_ROUTES.includes(h))).toEqual([]);
  });

  it("курс: каждая статья — ровно один урок, видео — у существующих уроков", () => {
    const slugs = COURSE_LESSONS.flatMap((l) => (l.soon ? [] : [l.guide.slug]));
    expect([...slugs].sort()).toEqual(GUIDES.map((g) => g.slug).sort());
    expect(COURSE_LESSONS.map((l) => l.number)).toEqual(COURSE_LESSONS.map((_, i) => i + 1));
    for (const slug of Object.keys(LESSON_VIDEOS)) expect(slugs).toContain(slug);
  });
});
