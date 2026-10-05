"use client";

/**
 * Карточки ленты: запись дневника растения и совет (запись с меткой «Совет»).
 * Фото — главное в записи: событие и имя растения лежат плашкой прямо на нём.
 * Несколько фото листаются пальцем (как в Instagram): счётчик «2/3» и точки под снимком.
 * «Поддержка» здесь — «Полить» (для совета — «Полезно»): те же счётчики, что и раньше.
 */

import { BookOpen, Droplets, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { DIARY_EVENTS, type FeedPost } from "@/lib/domain/social";
import { PlantPhoto, cx } from "../ui";
import { PostMenu } from "./post-menu";
import { AuthorLine, FollowAuthor, plantDiaryHref, useSupport } from "./shared";

/** «🌱 Новый лист · Монстера Бублик» — что случилось и с кем. На фото — полупрозрачная плашка. */
function EventTag({ post, onPhoto }: { post: FeedPost; onPhoto: boolean }) {
  const e = post.event ? DIARY_EVENTS[post.event] : null;
  if (!e && !post.plantName) return null;
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold",
        onPhoto ? "bg-black/40 text-white backdrop-blur-sm" : "bg-leaf/12 text-leaf",
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

/** Длинный текст — три строки и «ещё» (кнопка появляется, только если текст правда не влез). */
function PostText({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setClipped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div className={className}>
      <p ref={ref} className={cx("whitespace-pre-line", !open && "line-clamp-3")}>
        {text}
      </p>
      {clipped && !open && (
        <button type="button" onClick={() => setOpen(true)} className="text-secondary text-[14px] font-medium">
          ещё
        </button>
      )}
    </div>
  );
}

/** Фото записи: одно — как есть; несколько — лента с прокруткой по снимку, счётчик и точки. */
function PostPhotos({ post, alt, className, children }: { post: FeedPost; alt: string; className: string; children?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const urls = post.photoUrls.length ? post.photoUrls : post.photoUrl ? [post.photoUrl] : [];
  if (urls.length <= 1) {
    return (
      <div className="relative">
        <PlantPhoto src={urls[0]} seed={post.id} alt={alt} className={className} iconSize={48} whole />
        {children}
      </div>
    );
  }
  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        aria-label={`${urls.length} фото, листайте`}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {urls.map((url, i) => (
          <div key={url} className="w-full shrink-0 snap-center">
            <PlantPhoto src={url} seed={`${post.id}-${i}`} alt={`${alt}, фото ${i + 1}`} className={className} iconSize={48} whole />
          </div>
        ))}
      </div>
      {children}
      <span className="absolute top-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[12px] font-semibold text-white tabular-nums backdrop-blur-sm">
        {index + 1}/{urls.length}
      </span>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden>
        {urls.map((url, i) => (
          <span key={url} className={cx("size-1.5 rounded-full transition", i === index ? "bg-white" : "bg-white/50")} />
        ))}
      </div>
    </div>
  );
}

function CommentsButton({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  return (
    <button
      type="button"
      onClick={onComments}
      aria-label="Комментарии"
      className="text-secondary hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[14px] font-medium"
    >
      <MessageCircle className="size-[18px]" aria-hidden /> {post.commentCount}
    </button>
  );
}

const CARD = "bg-surface overflow-hidden rounded-[20px] shadow-[0_1px_3px_rgb(0_0_0/0.06)]";

/** Запись дневника: автор в строку, фото с плашкой события, текст, «Полить» и комментарии. */
export function DiaryCard({ post, onComments, showPlantLink = true }: { post: FeedPost; onComments: () => void; showPlantLink?: boolean }) {
  const support = useSupport(post);
  if (post.event === "tip") return <TipCard post={post} onComments={onComments} />;
  return (
    <article className={CARD} aria-label={`Запись: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-2 px-4 py-2.5">
        <AuthorLine post={post} size={32} inline />
        <FollowAuthor post={post} />
        <PostMenu post={post} />
      </header>
      {post.photoUrl ? (
        <PostPhotos post={post} alt={post.plantName ?? "Фото растения"} className="aspect-[4/3] max-h-[45vh] w-full">
          <div className="pointer-events-none absolute top-3 right-16 left-3 flex">
            <EventTag post={post} onPhoto />
          </div>
        </PostPhotos>
      ) : (
        <div className="px-4">
          <EventTag post={post} onPhoto={false} />
        </div>
      )}
      {post.text && <PostText text={post.text} className="px-4 pt-2.5 text-[16px] leading-snug" />}
      <footer className="flex items-center gap-1 px-3 pt-2 pb-2.5">
        <button
          type="button"
          onClick={support.toggle}
          aria-pressed={support.on}
          aria-label={support.on ? "Убрать полив" : "Полить"}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold transition",
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
            className="text-secondary hover:text-leaf ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
          >
            <BookOpen className="size-4" aria-hidden /> Дневник
          </Link>
        )}
      </footer>
    </article>
  );
}

/** Совет или лайфхак: белая карточка с зелёной меткой, текст покрупнее, «Полезно». */
function TipCard({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  const support = useSupport(post);
  return (
    <article className={CARD} aria-label={`Совет: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-2 px-4 py-2.5">
        <AuthorLine post={post} size={32} inline />
        <FollowAuthor post={post} />
        <PostMenu post={post} />
      </header>
      <p className="bg-leaf/12 text-leaf mx-4 inline-flex rounded-full px-3 py-1 text-[13px] font-semibold">
        💡 Совет{post.plantName && ` · ${post.plantName}`}
      </p>
      {post.text && <PostText text={post.text} className="px-4 pt-2 text-[17px] leading-snug font-semibold" />}
      {post.photoUrl && (
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl">
          <PostPhotos post={post} alt={post.plantName ?? "Иллюстрация к совету"} className="aspect-[4/3] max-h-[40vh] w-full" />
        </div>
      )}
      <footer className="flex items-center gap-1 px-3 pt-2 pb-2.5">
        <button
          type="button"
          onClick={support.toggle}
          aria-pressed={support.on}
          aria-label={support.on ? "Убрать «Полезно»" : "Полезно"}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] font-semibold transition",
            support.on ? "bg-leaf text-white" : "bg-leaf/10 text-leaf",
          )}
        >
          <ThumbsUp className="size-4" aria-hidden /> Полезно
          {support.count > 0 && <span className="tabular-nums opacity-80">· {support.count}</span>}
        </button>
        <CommentsButton post={post} onComments={onComments} />
      </footer>
    </article>
  );
}
