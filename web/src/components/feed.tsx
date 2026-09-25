"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Heart, Leaf, MessageCircle, Plus, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { personHref } from "./people";
import { useBackend } from "./session";
import { Avatar, PlantPhoto, Sheet, Spinner, cx, inputClass, useToast } from "./ui";
import type { FeedPost } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useComments } from "@/lib/queries";

/** Лайк с мгновенным откликом: счётчик меняется сразу, при ошибке — откатывается. */
function useLike(post: FeedPost) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [state, setState] = useState({ liked: post.likedByMe, count: post.likeCount });
  const mutation = useMutation({
    mutationFn: (liked: boolean) => backend.social.setLiked(post.id, liked),
    onError: (e, liked) => {
      setState((s) => ({ liked: !liked, count: s.count + (liked ? -1 : 1) }));
      toast(`Не получилось: ${e.message}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stats"] }),
  });
  const set = (liked: boolean) => {
    if (liked === state.liked) return;
    setState((s) => ({ liked, count: s.count + (liked ? 1 : -1) }));
    mutation.mutate(liked);
  };
  return { ...state, set };
}

/** Подписка на автора с мгновенным откликом; лента «Подписки» обновляется после ответа сервера. */
function useFollow(post: FeedPost) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [following, setFollowing] = useState(post.following);
  const mutation = useMutation({
    mutationFn: (follow: boolean) => backend.social.setFollowing(post.authorId, follow),
    onError: (e, follow) => {
      setFollowing(!follow);
      toast(`Не получилось: ${e.message}`);
    },
    onSuccess: (_d, follow) => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast(follow ? `Вы подписались на ${post.authorName}` : `Вы отписались от ${post.authorName}`);
    },
  });
  return {
    following,
    toggle: () => {
      setFollowing(!following);
      mutation.mutate(!following);
    },
  };
}

function FollowButton({ post }: { post: FeedPost }) {
  const { following, toggle } = useFollow(post);
  if (post.mine) return null;
  return (
    <button
      onClick={toggle}
      className={cx("rounded-full px-3 py-1 text-[13px] font-semibold", following ? "bg-muted text-secondary" : "bg-leaf text-white")}
    >
      {following ? "Вы подписаны" : "Подписаться"}
    </button>
  );
}

/** Фото поста: двойной клик/тап — лайк с сердцем, как в Instagram. */
function PostMedia({ post, onLike, className }: { post: FeedPost; onLike: () => void; className?: string }) {
  const [burst, setBurst] = useState(0);
  return (
    <div
      className={cx("relative select-none", className)}
      onDoubleClick={() => {
        onLike();
        setBurst((b) => b + 1);
      }}
    >
      <PlantPhoto src={post.photoUrl} seed={post.id} alt={post.plantName ?? "Фото растения"} className="size-full" iconSize={64} />
      {burst > 0 && (
        <Heart key={burst} className="animate-heart absolute inset-0 m-auto size-24 fill-white text-white drop-shadow-lg" aria-hidden />
      )}
    </div>
  );
}

function Counter({ icon: Icon, count, active, label, onClick, light }: {
  icon: typeof Heart;
  count: number;
  active?: boolean;
  label: string;
  onClick: () => void;
  light?: boolean;
}) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active} className={cx("flex items-center gap-1.5 font-semibold", light && "flex-col gap-0.5 text-[13px] text-white drop-shadow")}>
      <Icon className={cx(light ? "size-8" : "size-6", active && "fill-alert text-alert", active && "animate-pop")} strokeWidth={light ? 2 : 1.8} />
      <span>{count > 999 ? `${(count / 1000).toFixed(1).replace(".", ",")} тыс.` : count}</span>
    </button>
  );
}

/** Профиль автора: свой — страница профиля, чужой — страница садовода. */
const authorHref = (post: FeedPost) => (post.mine ? "/profile/" : personHref(post.authorName));

/** Карточка ленты «Подписки», как в Instagram. */
export function PostCard({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  const like = useLike(post);
  return (
    <article className="overflow-hidden rounded-[20px] bg-surface">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={authorHref(post)} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Профиль: ${post.authorDisplayName}`}>
          <Avatar name={post.authorDisplayName} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{post.authorDisplayName}</span>
            {post.plantName && <span className="block truncate text-[13px] text-secondary">{post.plantName}</span>}
          </span>
        </Link>
        <FollowButton post={post} />
        <time className="text-[13px] text-secondary" dateTime={post.createdAt.toISOString()}>
          {timeAgo(post.createdAt)}
        </time>
      </header>
      <PostMedia post={post} onLike={() => like.set(true)} className="aspect-square" />
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-5">
          <Counter icon={Heart} count={like.count} active={like.liked} label={like.liked ? "Убрать лайк" : "Нравится"} onClick={() => like.set(!like.liked)} />
          <Counter icon={MessageCircle} count={post.commentCount} label="Комментарии" onClick={onComments} />
        </div>
        {post.text && (
          <p className="mt-2 text-[15px] leading-relaxed">
            <b className="mr-1.5">{post.authorDisplayName}</b>
            {post.text}
          </p>
        )}
      </div>
    </article>
  );
}

/** Полноэкранная карточка «Интересного», как в TikTok: действия столбиком справа. */
export function FullPost({ post, onComments }: { post: FeedPost; onComments: () => void }) {
  const like = useLike(post);
  const follow = useFollow(post);
  return (
    <article className="relative h-full w-full overflow-hidden bg-black sm:rounded-[28px]">
      <div className="absolute inset-0">
        <PostMedia post={post} onLike={() => like.set(true)} className="size-full" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <div className="relative">
          <Link href={authorHref(post)} aria-label={`Профиль: ${post.authorDisplayName}`}>
            <Avatar name={post.authorDisplayName} size={44} />
          </Link>
          {!post.mine && (
            <button
              onClick={follow.toggle}
              aria-label={follow.following ? `Отписаться от ${post.authorName}` : `Подписаться на ${post.authorName}`}
              className={cx(
                "absolute -bottom-2 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full text-white",
                follow.following ? "bg-leaf" : "bg-alert",
              )}
            >
              {follow.following ? <Check className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
            </button>
          )}
        </div>
        <Counter light icon={Heart} count={like.count} active={like.liked} label={like.liked ? "Убрать лайк" : "Нравится"} onClick={() => like.set(!like.liked)} />
        <Counter light icon={MessageCircle} count={post.commentCount} label="Комментарии" onClick={onComments} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 pr-20 text-white">
        <p className="font-semibold">
          <Link href={authorHref(post)} className="hover:underline">
            {post.authorDisplayName}
          </Link>{" "}
          · <span className="font-normal opacity-80">{timeAgo(post.createdAt)}</span></p>
        {post.text && <p className="mt-1 text-[15px] leading-relaxed">{post.text}</p>}
        {post.plantName && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[13px] backdrop-blur">
            <Leaf className="size-3.5" aria-hidden /> {post.plantName}
          </span>
        )}
      </div>
    </article>
  );
}

export function CommentsSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const backend = useBackend();
  const comments = useComments(postId);
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState("");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["comments", postId] });
    qc.invalidateQueries({ queryKey: ["feed"] });
  };
  const add = useMutation({
    mutationFn: (t: string) => backend.social.addComment(postId!, t),
    onSuccess: () => {
      setText("");
      refresh();
    },
    onError: (e) => toast(`Не отправилось: ${e.message}`),
  });
  const remove = useMutation({ mutationFn: (id: string) => backend.social.deleteComment(id), onSuccess: refresh });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) add.mutate(text.trim());
  }

  return (
    <Sheet open={postId !== null} onClose={onClose} title="Комментарии">
      {comments.isPending ? (
        <Spinner />
      ) : comments.data?.length ? (
        <ul className="space-y-4">
          {comments.data.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar name={c.authorName} size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">
                  <b className="mr-1.5">{c.authorName}</b>
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
      <form onSubmit={submit} className="sticky bottom-0 mt-5 flex gap-2 bg-surface pt-2">
        <input className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder="Комментарий…" maxLength={1000} aria-label="Текст комментария" />
        <button type="submit" disabled={!text.trim() || add.isPending} className="grid size-12 shrink-0 place-items-center rounded-full bg-leaf text-white disabled:opacity-40" aria-label="Отправить">
          <Send className="size-5" />
        </button>
      </form>
    </Sheet>
  );
}
