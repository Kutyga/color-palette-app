"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CircleCheck, Leaf, MessageCircle, MessageCircleQuestion, Send, Sprout, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { FollowButton as PersonFollowButton, personHref } from "./people";
import { useBackend } from "./session";
import { Avatar, PlantPhoto, Sheet, Spinner, cx, inputClass, useToast } from "./ui";
import { DIARY_EVENTS, type FeedPost, type PostComment } from "@/lib/domain/social";
import { speciesName } from "@/lib/domain/species";
import { plural, timeAgo } from "@/lib/format";
import { speciesById } from "@/lib/knowledge";
import { useComments } from "@/lib/queries";

/** «Поддержать» запись дневника: счётчик меняется сразу, при ошибке — откатывается. */
function useSupport(post: FeedPost) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState({ on: post.likedByMe, count: post.likeCount });
  const mutation = useMutation({
    mutationFn: (on: boolean) => backend.social.setLiked(post.id, on),
    onError: (e, on) => {
      setState((s) => ({ on: !on, count: s.count + (on ? -1 : 1) }));
      toast(`Не получилось: ${e.message}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stats"] }),
  });
  return {
    ...state,
    toggle: () => {
      const on = !state.on;
      setState((s) => ({ on, count: s.count + (on ? 1 : -1) }));
      mutation.mutate(on);
    },
  };
}

/** Профиль автора: свой — страница профиля, чужой — страница садовода. */
const authorHref = (p: { mine: boolean; authorName: string }) => (p.mine ? "/profile/" : personHref(p.authorName));

export const questionHref = (id: string) => `/feed/question/?id=${encodeURIComponent(id)}`;
export const plantDiaryHref = (plantId: string) => `/feed/plant/?id=${encodeURIComponent(plantId)}`;

function AuthorLine({ post, size = 40 }: { post: FeedPost; size?: number }) {
  return (
    <Link href={authorHref(post)} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Профиль: ${post.authorDisplayName}`}>
      <Avatar name={post.authorDisplayName} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{post.authorDisplayName}</span>
        <time className="block text-[13px] text-secondary" dateTime={post.createdAt.toISOString()}>
          {timeAgo(post.createdAt)}
        </time>
      </span>
    </Link>
  );
}

/** Подписка прямо из записи — у кнопки садовода свой оптимистичный стейт. */
function FollowAuthor({ post }: { post: FeedPost }) {
  if (post.mine) return null;
  return (
    <PersonFollowButton
      size="sm"
      person={{
        id: post.authorId,
        username: post.authorName,
        displayName: post.authorDisplayName,
        bio: null,
        followers: 0,
        following: 0,
        plants: 0,
        isFollowing: post.following,
        followsMe: false,
        isMe: false,
      }}
    />
  );
}

function SpeciesLink({ speciesId, className }: { speciesId: string | null; className?: string }) {
  const sp = speciesById(speciesId);
  if (!sp) return null;
  return (
    <Link href={`/plants/${sp.slug}/`} className={cx("inline-flex min-w-0 items-center gap-1 text-secondary hover:text-leaf", className)}>
      <Leaf className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{speciesName(sp)}</span>
    </Link>
  );
}

export function EventBadge({ event }: { event: FeedPost["event"] }) {
  if (!event) return null;
  const e = DIARY_EVENTS[event];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf/12 px-3 py-1 text-[13px] font-semibold text-leaf">
      <span aria-hidden>{e.emoji}</span> {e.label}
    </span>
  );
}

/** Запись дневника: событие из жизни растения, фото, пара слов. Без бесконечных лайков. */
export function DiaryCard({ post, onComments, showPlantLink = true }: { post: FeedPost; onComments: () => void; showPlantLink?: boolean }) {
  const support = useSupport(post);
  return (
    <article className="overflow-hidden rounded-[20px] bg-surface" aria-label={`Запись: ${post.authorDisplayName}`}>
      <header className="flex items-center gap-3 px-4 pt-4">
        <AuthorLine post={post} />
        <FollowAuthor post={post} />
      </header>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 text-[15px]">
        <EventBadge event={post.event} />
        {post.plantName && <span className="font-semibold">{post.plantName}</span>}
        <SpeciesLink speciesId={post.speciesId} className="text-[13px]" />
      </div>
      {post.photoUrl && (
        <PlantPhoto src={post.photoUrl} seed={post.id} alt={post.plantName ?? "Фото растения"} className="mt-3 aspect-[4/3] w-full" iconSize={48} />
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
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[13px] font-semibold"
        >
          <MessageCircle className="size-4" aria-hidden /> {post.commentCount}
        </button>
        {showPlantLink && post.plantId && (
          <Link
            href={plantDiaryHref(post.plantId)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-leaf hover:bg-muted"
          >
            <BookOpen className="size-4" aria-hidden /> Дневник растения
          </Link>
        )}
      </footer>
    </article>
  );
}

/** Статус вопроса: решён / есть ответы / ждёт ответа. */
export function QuestionStatus({ post }: { post: FeedPost }) {
  if (post.solvedCommentId) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-leaf/12 px-2.5 py-0.5 text-[12px] font-semibold text-leaf">
        <CircleCheck className="size-3.5" aria-hidden /> Решено
      </span>
    );
  }
  if (post.commentCount === 0) {
    return <span className="rounded-full bg-soil/15 px-2.5 py-0.5 text-[12px] font-semibold text-soil">Ждёт ответа</span>;
  }
  return (
    <span className="rounded-full bg-water/15 px-2.5 py-0.5 text-[12px] font-semibold text-water">
      {post.commentCount} {plural(post.commentCount, "ответ", "ответа", "ответов")}
    </span>
  );
}

/** Вопрос в списке «Помощи»: коротко, со статусом, открывается отдельной страницей. */
export function QuestionRow({ post }: { post: FeedPost }) {
  return (
    <li>
      <Link href={questionHref(post.id)} className="flex gap-3 rounded-[20px] bg-surface p-4 transition hover:brightness-[0.98]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <QuestionStatus post={post} />
            {speciesById(post.speciesId) && (
              <span className="truncate text-[13px] text-secondary">{speciesName(speciesById(post.speciesId)!)}</span>
            )}
          </div>
          <p className="mt-2 line-clamp-3 text-[15px] leading-snug font-medium">{post.text}</p>
          <p className="mt-2 text-[13px] text-secondary">
            {post.authorDisplayName} · {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.photoUrl && <PlantPhoto src={post.photoUrl} seed={post.id} alt="Фото к вопросу" className="size-20 shrink-0 rounded-2xl" iconSize={24} />}
      </Link>
    </li>
  );
}

/** Полный вопрос: фото, текст, вид — наверху страницы вопроса. */
export function QuestionHeader({ post }: { post: FeedPost }) {
  return (
    <article className="overflow-hidden rounded-[20px] bg-surface">
      <header className="flex items-center gap-3 px-4 pt-4">
        <AuthorLine post={post} />
        <QuestionStatus post={post} />
      </header>
      <p className="px-4 pt-3 text-[17px] leading-relaxed whitespace-pre-line">{post.text}</p>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-2 text-[13px]">
        {post.plantName && <span className="font-semibold">{post.plantName}</span>}
        <SpeciesLink speciesId={post.speciesId} />
      </div>
      {post.photoUrl ? (
        <PlantPhoto src={post.photoUrl} seed={post.id} alt="Фото к вопросу" className="mt-3 aspect-[4/3] w-full" iconSize={48} />
      ) : (
        <div className="h-4" />
      )}
    </article>
  );
}

/** Ответы на вопрос: лучший — первым; автор вопроса отмечает лучший ответ. */
export function Answers({ post }: { post: FeedPost }) {
  const backend = useBackend();
  const comments = useComments(post.id);
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = () => qc.invalidateQueries({ queryKey: ["feed"] }).then(() => qc.invalidateQueries({ queryKey: ["comments", post.id] }));
  const solve = useMutation({
    mutationFn: (commentId: string | null) => backend.social.markSolved(post.id, commentId),
    onSuccess: (_d, commentId) => {
      toast(commentId ? "Отмечено как лучший ответ" : "Отметка снята");
      refresh();
    },
    onError: (e) => toast(`Не получилось: ${e.message}`),
  });
  const remove = useMutation({ mutationFn: (id: string) => backend.social.deleteComment(id), onSuccess: refresh });

  if (comments.isPending) return <Spinner />;
  const list = [...(comments.data ?? [])].sort((a, b) => Number(b.id === post.solvedCommentId) - Number(a.id === post.solvedCommentId));
  return (
    <section aria-label="Ответы">
      <h2 className="mt-6 mb-3 text-[20px] font-bold">
        {list.length ? `${list.length} ${plural(list.length, "ответ", "ответа", "ответов")}` : "Ответов пока нет"}
      </h2>
      {list.length === 0 && <p className="mb-4 text-secondary">Знаете, в чём дело? Помогите — ответ увидят все, кто держит это растение.</p>}
      <ul className="space-y-3">
        {list.map((c) => (
          <AnswerItem
            key={c.id}
            comment={c}
            best={c.id === post.solvedCommentId}
            canMark={post.mine && !c.mine}
            onMark={() => solve.mutate(c.id === post.solvedCommentId ? null : c.id)}
            onDelete={() => remove.mutate(c.id)}
          />
        ))}
      </ul>
      <ReplyForm postId={post.id} placeholder="Ваш ответ…" label="Текст ответа" onSent={refresh} />
    </section>
  );
}

function AnswerItem({ comment: c, best, canMark, onMark, onDelete }: {
  comment: PostComment;
  best: boolean;
  canMark: boolean;
  onMark: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cx("rounded-[20px] bg-surface p-4", best && "ring-2 ring-leaf")}>
      {best && (
        <p className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-leaf">
          <CircleCheck className="size-4" aria-hidden /> Лучший ответ
        </p>
      )}
      <div className="flex gap-3">
        <Link href={authorHref({ mine: c.mine, authorName: c.authorName })} aria-label={`Профиль: ${c.authorDisplayName}`}>
          <Avatar name={c.authorDisplayName} size={32} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[13px]">
            <b>{c.authorDisplayName}</b> <span className="text-secondary">· {timeAgo(c.createdAt)}</span>
          </p>
          <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line">{c.text}</p>
          {canMark && (
            <button type="button" onClick={onMark} className="mt-2 text-[13px] font-semibold text-leaf">
              {best ? "Снять отметку" : "Это лучший ответ"}
            </button>
          )}
        </div>
        {c.mine && (
          <button onClick={onDelete} aria-label="Удалить ответ" className="self-start text-secondary hover:text-alert">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}

function ReplyForm({ postId, placeholder, label, onSent }: { postId: string; placeholder: string; label: string; onSent: () => void }) {
  const backend = useBackend();
  const toast = useToast();
  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: (t: string) => backend.social.addComment(postId, t),
    onSuccess: () => {
      setText("");
      onSent();
    },
    onError: (e) => toast(`Не отправилось: ${e.message}`),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) add.mutate(text.trim());
  }
  return (
    <form onSubmit={submit} className="mt-4 flex items-end gap-2">
      <textarea
        className={cx(inputClass, "min-h-12 resize-y")}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        aria-label={label}
      />
      <button type="submit" disabled={!text.trim() || add.isPending} className="grid size-12 shrink-0 place-items-center rounded-full bg-leaf text-white disabled:opacity-40" aria-label="Отправить">
        <Send className="size-5" />
      </button>
    </form>
  );
}

/** Комментарии к записи дневника. */
export function CommentsSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const backend = useBackend();
  const comments = useComments(postId);
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["comments", postId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  };
  const remove = useMutation({ mutationFn: (id: string) => backend.social.deleteComment(id), onSuccess: refresh });

  return (
    <Sheet open={postId !== null} onClose={onClose} title="Комментарии">
      {comments.isPending ? (
        <Spinner />
      ) : comments.data?.length ? (
        <ul className="space-y-4">
          {comments.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorDisplayName} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">
                  <b className="mr-1.5">{c.authorDisplayName}</b>
                  {c.text}
                </p>
                <p className="text-[12px] text-secondary">{timeAgo(c.createdAt)}</p>
              </div>
              {c.mine && (
                <button onClick={() => remove.mutate(c.id)} aria-label="Удалить комментарий" className="text-secondary hover:text-alert">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-secondary">Будьте первым, кто оставит комментарий.</p>
      )}
      {postId && (
        <div className="sticky bottom-0 bg-surface pb-1">
          <ReplyForm postId={postId} placeholder="Комментарий…" label="Текст комментария" onSent={refresh} />
        </div>
      )}
    </Sheet>
  );
}

export const QuestionIcon = MessageCircleQuestion;
