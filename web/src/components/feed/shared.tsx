"use client";

/**
 * Общее для записей и вопросов: автор, ссылки, «Поддержать», вид растения.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Leaf } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { FeedPost } from "@/lib/domain/social";
import { speciesName } from "@/lib/domain/species";
import { timeAgo } from "@/lib/format";
import { speciesById } from "@/lib/knowledge";
import { FollowButton as PersonFollowButton, personHref } from "../people";
import { useBackend } from "../session";
import { Avatar, cx, useToast } from "../ui";

export function useSupport(post: FeedPost) {
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
export const authorHref = (p: { mine: boolean; authorName: string }) => (p.mine ? "/profile/" : personHref(p.authorName));

export const questionHref = (id: string) => `/feed/question/?id=${encodeURIComponent(id)}`;
export const plantDiaryHref = (plantId: string) => `/feed/plant/?id=${encodeURIComponent(plantId)}`;

export function AuthorLine({ post, size = 40 }: { post: FeedPost; size?: number }) {
  return (
    <Link href={authorHref(post)} className="flex min-w-0 flex-1 items-center gap-3" aria-label={`Профиль: ${post.authorDisplayName}`}>
      <Avatar name={post.authorDisplayName} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-semibold">{post.authorDisplayName}</span>
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

export function SpeciesLink({ speciesId, className }: { speciesId: string | null; className?: string }) {
  const sp = speciesById(speciesId);
  if (!sp) return null;
  return (
    <Link href={`/plants/${sp.slug}/`} className={cx("text-secondary hover:text-leaf inline-flex min-w-0 items-center gap-1", className)}>
      <Leaf className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{speciesName(sp)}</span>
    </Link>
  );
}
