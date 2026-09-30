"use client";

/**
 * «Сегодня на подоконниках»: растения, о которых написали за последние сутки, стоят в горшках
 * на подоконнике. Каждый день подоконник новый: запись старше суток с него уходит, а нет свежих
 * записей — нет и подоконника. Просмотренные растения (открывали их дневник) встают в конец
 * с серым ободком — новое всегда первым. Собирается из уже загруженной ленты — отдельного запроса нет.
 */

import Link from "next/link";
import { useState } from "react";
import type { FeedPost } from "@/lib/domain/social";
import { PlantPhoto, cx } from "../ui";
import { plantDiaryHref } from "./shared";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_POTS = 12;
/** id записей, по которым уже открывали дневник; хранятся в браузере. */
const SEEN_KEY = "windowsill-seen";

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** Последняя запись каждого растения за сутки; советы не считаются. */
function pots(posts: FeedPost[], now: Date): FeedPost[] {
  const seen = new Set<string>();
  const out: FeedPost[] = [];
  for (const p of posts) {
    if (!p.plantId || p.event === "tip" || seen.has(p.plantId)) continue;
    if (now.getTime() - p.createdAt.getTime() > DAY_MS) continue;
    seen.add(p.plantId);
    out.push(p);
    if (out.length === MAX_POTS) break;
  }
  return out;
}

export function Windowsill({ posts, now = new Date() }: { posts: FeedPost[]; now?: Date }) {
  const [seen, setSeen] = useState(readSeen);
  const fresh = pots(posts, now);
  if (!fresh.length) return null;
  // Сначала непросмотренные.
  const list = [...fresh.filter((p) => !seen.has(p.id)), ...fresh.filter((p) => seen.has(p.id))];

  function markSeen(id: string) {
    const next = new Set(seen).add(id);
    setSeen(next);
    try {
      // Храним только записи последних суток — старые с подоконника всё равно ушли.
      const keep = [...next].filter((x) => fresh.some((p) => p.id === x));
      localStorage.setItem(SEEN_KEY, JSON.stringify(keep));
    } catch {
      // хранилище недоступно — порядок сбросится после перезагрузки
    }
  }

  return (
    <section aria-label="На подоконниках" className="mb-4">
      <h2 className="text-secondary mb-2 text-[13px] font-medium">Сегодня на подоконниках</h2>
      <div className="relative -mx-4">
        <ul className="no-scrollbar relative z-10 flex gap-3 overflow-x-auto px-4 pt-2 pb-1">
          {list.map((p) => (
            <li key={p.plantId} className="w-16 shrink-0">
              <Link
                href={plantDiaryHref(p.plantId!)}
                onClick={() => markSeen(p.id)}
                className="flex flex-col items-center"
                aria-label={`${p.plantName ?? "Растение"} — ${p.authorDisplayName}`}
              >
                <PlantPhoto
                  src={p.photoUrl}
                  seed={p.plantId!}
                  alt=""
                  iconSize={20}
                  sizes="64px"
                  className={cx(
                    "ring-offset-bg size-14 rounded-full ring-[2.5px] ring-offset-2",
                    seen.has(p.id) ? "ring-separator" : "ring-leaf",
                  )}
                />
                {/* Горшок */}
                <span className="bg-soil relative -mt-1.5 h-4 w-10 rounded-b-lg" aria-hidden />
                <span className="text-secondary mt-2 w-16 truncate text-center text-[11px]">{p.plantName ?? p.authorDisplayName}</span>
              </Link>
            </li>
          ))}
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
