"use client";

/**
 * Вопросы «Помощи»: строка списка, шапка вопроса и ответы с отметкой лучшего.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { catalogById } from "@/lib/catalog";
import type { FeedPost, PostComment } from "@/lib/domain/social";
import { speciesName } from "@/lib/domain/species";
import { plural, timeAgo } from "@/lib/format";
import { useComments } from "@/lib/queries";
import { useBackend } from "../session";
import { Avatar, LARGE_PHOTO, PlantPhoto, Spinner, cx, useToast } from "../ui";
import { ReplyForm } from "./comments";
import { PostMenu } from "./post-menu";
import { AuthorLine, SpeciesLink, authorHref, questionHref } from "./shared";

function QuestionStatus({ post }: { post: FeedPost }) {
  if (post.solvedCommentId) {
    return (
      <span className="bg-leaf/12 text-leaf inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold">
        <CircleCheck className="size-3.5" aria-hidden /> Решено
      </span>
    );
  }
  if (post.commentCount === 0) {
    return <span className="bg-soil/15 text-soil rounded-full px-2.5 py-0.5 text-[12px] font-semibold">Ждёт ответа</span>;
  }
  return (
    <span className="bg-water/15 text-water rounded-full px-2.5 py-0.5 text-[12px] font-semibold">
      {post.commentCount} {plural(post.commentCount, "ответ", "ответа", "ответов")}
    </span>
  );
}

/** Вопрос в списке «Помощи»: коротко, со статусом, открывается отдельной страницей. */
export function QuestionRow({ post }: { post: FeedPost }) {
  return (
    <li>
      <Link href={questionHref(post.id)} className="bg-surface flex gap-3 rounded-[20px] p-4 transition hover:brightness-[0.98]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <QuestionStatus post={post} />
            {catalogById(post.speciesId) && (
              <span className="text-secondary truncate text-[13px]">{speciesName(catalogById(post.speciesId)!)}</span>
            )}
          </div>
          <p className="mt-2 line-clamp-3 text-[15px] leading-snug font-medium">{post.text}</p>
          <p className="text-secondary mt-2 text-[13px]">
            {post.authorDisplayName} · {timeAgo(post.createdAt)}
          </p>
        </div>
        {post.photoUrl && (
          <PlantPhoto src={post.photoUrl} seed={post.id} alt="Фото к вопросу" className="size-20 shrink-0 rounded-2xl" iconSize={24} />
        )}
      </Link>
    </li>
  );
}

/** Полный вопрос: фото, текст, вид — наверху страницы вопроса. */
export function QuestionHeader({ post, onDeleted }: { post: FeedPost; onDeleted?: () => void }) {
  return (
    <article className="bg-surface overflow-hidden rounded-[20px]">
      <header className="flex items-center gap-3 px-4 pt-4">
        <AuthorLine post={post} />
        <QuestionStatus post={post} />
        <PostMenu post={post} onDeleted={onDeleted} />
      </header>
      <p className="px-4 pt-3 text-[17px] leading-relaxed whitespace-pre-line">{post.text}</p>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-2 text-[13px]">
        {post.plantName && <span className="font-semibold">{post.plantName}</span>}
        <SpeciesLink speciesId={post.speciesId} />
      </div>
      {post.photoUrl ? (
        <PlantPhoto
          src={post.photoUrl}
          seed={post.id}
          alt="Фото к вопросу"
          className="mt-3 aspect-[4/3] w-full"
          iconSize={48}
          sizes={LARGE_PHOTO}
          whole
        />
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
      {list.length === 0 && (
        <p className="text-secondary mb-4">Знаете, в чём дело? Помогите — ответ увидят все, кто держит это растение.</p>
      )}
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

function AnswerItem({
  comment: c,
  best,
  canMark,
  onMark,
  onDelete,
}: {
  comment: PostComment;
  best: boolean;
  canMark: boolean;
  onMark: () => void;
  onDelete: () => void;
}) {
  return (
    <li className={cx("bg-surface rounded-[20px] p-4", best && "ring-leaf ring-2")}>
      {best && (
        <p className="text-leaf mb-2 inline-flex items-center gap-1 text-[13px] font-semibold">
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
            <button type="button" onClick={onMark} className="text-leaf mt-2 text-[13px] font-semibold">
              {best ? "Снять отметку" : "Это лучший ответ"}
            </button>
          )}
        </div>
        {c.mine && (
          <button type="button" onClick={onDelete} aria-label="Удалить ответ" className="text-secondary hover:text-alert self-start">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}
