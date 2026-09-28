"use client";

/**
 * Карточка записи дневника растения в ленте «Дневники».
 */

import { BookOpen, MessageCircle, Sprout } from "lucide-react";
import Link from "next/link";
import { DIARY_EVENTS, type FeedPost } from "@/lib/domain/social";
import { PlantPhoto, cx } from "../ui";
import { PostMenu } from "./post-menu";
import { AuthorLine, FollowAuthor, SpeciesLink, plantDiaryHref, useSupport } from "./shared";

function EventBadge({ event }: { event: FeedPost["event"] }) {
  if (!event) return null;
  const e = DIARY_EVENTS[event];
  return (
    <span className="bg-leaf/12 text-leaf inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold">
      <span aria-hidden>{e.emoji}</span> {e.label}
    </span>
  );
}

/** Запись дневника: событие из жизни растения, фото, пара слов. Без бесконечных лайков. */
export function DiaryCard({ post, onComments, showPlantLink = true }: { post: FeedPost; onComments: () => void; showPlantLink?: boolean }) {
  const support = useSupport(post);
  return (
    <article className="bg-surface overflow-hidden rounded-[20px]" aria-label={`Запись: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-3 px-4 pt-4">
        <AuthorLine post={post} />
        <FollowAuthor post={post} />
        <PostMenu post={post} />
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 text-[15px]">
        <EventBadge event={post.event} />
        {post.plantName && <span className="font-semibold">{post.plantName}</span>}
        <SpeciesLink speciesId={post.speciesId} className="text-[13px]" />
      </div>
      {post.photoUrl && (
        <PlantPhoto
          src={post.photoUrl}
          seed={post.id}
          alt={post.plantName ?? "Фото растения"}
          className="mt-3 aspect-[4/3] w-full"
          iconSize={48}
          whole
        />
      )}
      {post.text && <p className="px-4 pt-3 text-[15px] leading-relaxed whitespace-pre-line">{post.text}</p>}
      <footer className="flex items-center gap-2 px-3 pt-3 pb-3">
        <button
          type="button"
          onClick={support.toggle}
          aria-pressed={support.on}
          aria-label={support.on ? "Убрать поддержку" : "Поддержать"}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition",
            support.on ? "bg-leaf text-white" : "bg-muted text-label",
          )}
        >
          <Sprout className="size-4" aria-hidden /> {support.on ? "Поддержали" : "Поддержать"}
          {support.count > 0 && <span className="tabular-nums opacity-80">{support.count}</span>}
        </button>
        <button
          type="button"
          onClick={onComments}
          aria-label="Комментарии"
          className="bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
        >
          <MessageCircle className="size-4" aria-hidden /> {post.commentCount}
        </button>
        {showPlantLink && post.plantId && (
          <Link
            href={plantDiaryHref(post.plantId)}
            className="text-leaf hover:bg-muted ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
          >
            <BookOpen className="size-4" aria-hidden /> Дневник растения
          </Link>
        )}
      </footer>
    </article>
  );
}

/** Статус вопроса: решён / есть ответы / ждёт ответа. */
