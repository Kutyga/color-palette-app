"use client";

/**
 * Карточки ленты: запись дневника растения и совет (запись с меткой «Совет»).
 * Фото — главное в записи: событие и имя растения лежат плашкой прямо на нём.
 * «Поддержка» здесь — «Полить» (для совета — «Пригодилось»): те же счётчики, что и раньше.
 */

import { BookOpen, Droplets, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { DIARY_EVENTS, type FeedPost } from "@/lib/domain/social";
import { PlantPhoto, cx } from "../ui";
import { PostMenu } from "./post-menu";
import { AuthorLine, FollowAuthor, SpeciesLink, plantDiaryHref, useSupport } from "./shared";

/** «🌱 Новый лист · Монстера Бублик» — что случилось и с кем. */
function EventTag({ post, onPhoto }: { post: FeedPost; onPhoto: boolean }) {
  const e = post.event ? DIARY_EVENTS[post.event] : null;
  if (!e && !post.plantName) return null;
  return (
    <span
      className={cx(
        "text-leaf inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
        onPhoto ? "bg-surface/90 shadow-sm backdrop-blur" : "bg-leaf/12",
      )}
    >
      {e && <span aria-hidden>{e.emoji}</span>}
      <span className="truncate">
        {e?.label}
        {e && post.plantName && " · "}
        {post.plantName}
      </span>
    </span>
  );
}

function CommentsButton({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  return (
    <button
      type="button"
      onClick={onComments}
      aria-label="Комментарии"
      className="text-label hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold"
    >
      <MessageCircle className="size-4" aria-hidden /> {post.commentCount}
    </button>
  );
}

/** Запись дневника: фото с плашкой события, пара слов, «Полить» и комментарии. */
export function DiaryCard({ post, onComments, showPlantLink = true }: { post: FeedPost; onComments: () => void; showPlantLink?: boolean }) {
  const support = useSupport(post);
  if (post.event === "tip") return <TipCard post={post} onComments={onComments} />;
  return (
    <article className="bg-surface overflow-hidden rounded-[20px]" aria-label={`Запись: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-2 px-4 py-3">
        <AuthorLine post={post} size={36} />
        <FollowAuthor post={post} />
        <PostMenu post={post} />
      </header>
      {post.photoUrl ? (
        <div className="relative">
          <PlantPhoto
            src={post.photoUrl}
            seed={post.id}
            alt={post.plantName ?? "Фото растения"}
            className="aspect-[4/3] w-full"
            iconSize={48}
            whole
          />
          <div className="absolute inset-x-3 top-3 flex">
            <EventTag post={post} onPhoto />
          </div>
        </div>
      ) : (
        <div className="px-4">
          <EventTag post={post} onPhoto={false} />
        </div>
      )}
      {post.text && <p className="px-4 pt-3 text-[15px] leading-relaxed whitespace-pre-line">{post.text}</p>}
      <SpeciesLink speciesId={post.speciesId} className="px-4 pt-1.5 text-[13px]" />
      <footer className="flex items-center gap-1 px-3 pt-2 pb-3">
        <button
          type="button"
          onClick={support.toggle}
          aria-pressed={support.on}
          aria-label={support.on ? "Убрать полив" : "Полить"}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition",
            support.on ? "bg-water text-white" : "bg-water/10 text-water",
          )}
        >
          <Droplets className="size-4" aria-hidden /> {support.on ? "Полито" : "Полить"}
          {support.count > 0 && <span className="tabular-nums opacity-80">· {support.count}</span>}
        </button>
        <CommentsButton post={post} onComments={onComments} />
        {showPlantLink && post.plantId && (
          <Link
            href={plantDiaryHref(post.plantId)}
            aria-label="Дневник растения"
            className="text-secondary hover:text-leaf ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
          >
            <BookOpen className="size-4" aria-hidden /> Дневник
          </Link>
        )}
      </footer>
    </article>
  );
}

/** Совет или лайфхак: жёлтая карточка, крупный текст, «Пригодилось». */
function TipCard({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  const support = useSupport(post);
  return (
    <article className="overflow-hidden rounded-[20px] bg-amber-50 dark:bg-amber-400/10" aria-label={`Совет: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-2 px-4 pt-3">
        <AuthorLine post={post} size={36} />
        <FollowAuthor post={post} />
        <PostMenu post={post} />
      </header>
      <p className="px-4 pt-3 text-[12px] font-bold tracking-wide text-amber-700 uppercase dark:text-amber-300">
        💡 Совет{post.plantName && ` · ${post.plantName}`}
      </p>
      {post.text && <p className="px-4 pt-1 text-[17px] leading-snug font-semibold whitespace-pre-line">{post.text}</p>}
      {post.photoUrl && (
        <PlantPhoto
          src={post.photoUrl}
          seed={post.id}
          alt={post.plantName ?? "Иллюстрация к совету"}
          className="mx-4 mt-3 aspect-[4/3] w-[calc(100%-2rem)] rounded-2xl"
          iconSize={40}
          whole
        />
      )}
      <SpeciesLink speciesId={post.speciesId} className="px-4 pt-2 text-[13px]" />
      <footer className="flex items-center gap-1 px-3 pt-2 pb-3">
        <button
          type="button"
          onClick={support.toggle}
          aria-pressed={support.on}
          aria-label={support.on ? "Убрать «Пригодилось»" : "Пригодилось"}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[14px] font-semibold transition",
            support.on ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
          )}
        >
          <ThumbsUp className="size-4" aria-hidden /> Пригодилось
          {support.count > 0 && <span className="tabular-nums opacity-80">· {support.count}</span>}
        </button>
        <CommentsButton post={post} onComments={onComments} />
      </footer>
    </article>
  );
}
