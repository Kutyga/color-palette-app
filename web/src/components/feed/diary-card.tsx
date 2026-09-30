"use client";

/**
 * Карточки ленты: запись дневника растения и совет (запись с меткой «Совет»).
 * Фото — главное в записи: событие и имя растения лежат плашкой прямо на нём.
 * «Поддержка» здесь — «Полить» (для совета — «Полезно»): те же счётчики, что и раньше.
 */

import { BookOpen, Droplets, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
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
        <div className="relative">
          <PlantPhoto
            src={post.photoUrl}
            seed={post.id}
            alt={post.plantName ?? "Фото растения"}
            className="aspect-[4/3] max-h-[45vh] w-full"
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
        <PlantPhoto
          src={post.photoUrl}
          seed={post.id}
          alt={post.plantName ?? "Иллюстрация к совету"}
          className="mx-4 mt-3 aspect-[4/3] max-h-[40vh] w-[calc(100%-2rem)] rounded-2xl"
          iconSize={40}
          whole
        />
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
