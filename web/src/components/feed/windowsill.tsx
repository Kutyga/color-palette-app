"use client";

/**
 * «На подоконниках»: растения из свежих записей ленты стоят в горшках на подоконнике.
 * Зелёный ободок — запись за последние сутки. Нажатие открывает дневник растения.
 * Собирается из уже загруженной ленты — отдельного запроса нет.
 */

import Link from "next/link";
import type { FeedPost } from "@/lib/domain/social";
import { PlantPhoto, cx } from "../ui";
import { plantDiaryHref } from "./shared";

const FRESH_MS = 24 * 60 * 60 * 1000;
const MAX_POTS = 12;

/** Последняя запись каждого растения, от свежих к старым. Советы не считаются. */
function pots(posts: FeedPost[]): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const p of posts) {
    if (!p.plantId || p.event === "tip" || seen.has(p.plantId)) continue;
    seen.add(p.plantId);
    out.push(p);
    if (out.length === MAX_POTS) break;
  }
  return out;
}

export function Windowsill({ posts, now = new Date() }: { posts: FeedPost[]; now?: Date }) {
  const list = pots(posts);
  if (!list.length) return null;
  return (
    <section aria-label="На подоконниках" className="mb-4">
      <h2 className="text-secondary mb-2 text-[13px] font-medium">На подоконниках</h2>
      <div className="relative -mx-4">
        <ul className="no-scrollbar relative z-10 flex gap-3 overflow-x-auto px-4 pt-2 pb-1">
          {list.map((p) => {
            const fresh = now.getTime() - p.createdAt.getTime() < FRESH_MS;
            return (
              <li key={p.plantId} className="w-16 shrink-0">
                <Link
                  href={plantDiaryHref(p.plantId!)}
                  className="flex flex-col items-center"
                  aria-label={`${p.plantName ?? "Растение"} — ${p.authorDisplayName}`}
                >
                  <PlantPhoto
                    src={p.photoUrl}
                    seed={p.plantId!}
                    alt=""
                    iconSize={20}
                    sizes="64px"
                    className={cx("ring-offset-bg size-14 rounded-full ring-[2.5px] ring-offset-2", fresh ? "ring-leaf" : "ring-separator")}
                  />
                  {/* Горшок */}
                  <span className="bg-soil relative -mt-1.5 h-4 w-10 rounded-b-lg" aria-hidden />
                  <span className="text-secondary mt-2 w-16 truncate text-center text-[11px]">{p.plantName ?? p.authorDisplayName}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {/* Доска подоконника за горшками */}
        <span
          className="absolute inset-x-2 top-[70px] h-2.5 rounded-sm bg-gradient-to-b from-[#e9dcc6] to-[#d8c6a6] dark:from-[#6b5a44] dark:to-[#56473a]"
          aria-hidden
        />
      </div>
    </section>
  );
}
