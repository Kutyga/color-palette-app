"use client";

/**
 * Общее для записей и вопросов: автор, ссылки, «Поддержать», вид растения.
 */

import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, Leaf } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { catalogById } from "@/lib/catalog";
import type { FeedPost } from "@/lib/domain/social";
import { speciesName } from "@/lib/domain/species";
import { timeAgo } from "@/lib/format";
import { FollowButton as PersonFollowButton, personHref } from "../people";
import { useBackend } from "../session";
import { Avatar, cx, useToast } from "../ui";

export function useSupport(post: FeedPost) {
  const backend = useBackend();
  const toast = useToast();
  const [state, setState] = useState({ on: post.likedByMe, count: post.likeCount });
  const mutation = useMutation({
    mutationFn: (on: boolean) => backend.social.setLiked(post.id, on),
    onError: (e, on) => {
      setState((s) => ({ on: !on, count: s.count + (on ? -1 : 1) }));
      toast(`Не получилось: ${e.message}`);
    },
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
export const authorHref = (p: { mine: boolean; authorName: string }) => (p.mine ? "/profile/" : personHref(p.authorName));

export const questionHref = (id: string) => `/feed/question/?id=${encodeURIComponent(id)}`;
export const plantDiaryHref = (plantId: string) => `/feed/plant/?id=${encodeURIComponent(plantId)}`;

/** Автор и время. inline — в одну строку («Анна · 3 ч»), для компактных карточек ленты. */
export function AuthorLine({ post, size = 40, inline = false }: { post: FeedPost; size?: number; inline?: boolean }) {
  if (inline) {
    return (
      <Link href={authorHref(post)} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={`Профиль: ${post.authorDisplayName}`}>
        <Avatar name={post.authorDisplayName} size={size} />
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[15px] font-semibold">{post.authorDisplayName}</span>
          {post.authorIsTeam && <BadgeCheck className="text-leaf size-4 shrink-0 self-center" aria-label="Команда" />}
          <time className="text-secondary shrink-0 text-[13px]" dateTime={post.createdAt.toISOString()}>
            · {timeAgo(post.createdAt)}
            {post.editedAt && " · изменено"}
          </time>
        </span>
      </Link>
    );
  }
  return (
    <Link href={authorHref(post)} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Профиль: ${post.authorDisplayName}`}>
      <Avatar name={post.authorDisplayName} size={size} />
      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-semibold">{post.authorDisplayName}</span>
          {post.authorIsTeam && (
            <span className="bg-leaf/12 text-leaf inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold">
              <BadgeCheck className="size-3" aria-hidden /> Команда
            </span>
          )}
        </span>
        <time className="text-secondary block text-[13px]" dateTime={post.createdAt.toISOString()}>
          {timeAgo(post.createdAt)}
          {post.editedAt && " · изменено"}
        </time>
      </span>
    </Link>
  );
}

/**
 * Меню своей публикации: «Редактировать» — первый час после публикации, «Удалить» — всегда.
 * onDeleted — куда уйти, если публикация была открыта отдельной страницей.
 */

export function FollowAuthor({ post }: { post: FeedPost }) {
  if (post.mine) return null;
  return (
    <PersonFollowButton
      size="link"
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

export function SpeciesLink({ speciesId, className }: { speciesId: string | null; className?: string }) {
  const sp = catalogById(speciesId);
  if (!sp) return null;
  return (
    <Link href={`/plants/${sp.slug}/`} className={cx("text-secondary hover:text-leaf inline-flex min-w-0 items-center gap-1", className)}>
      <Leaf className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{speciesName(sp)}</span>
    </Link>
  );
}
