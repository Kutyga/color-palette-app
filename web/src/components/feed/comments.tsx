"use client";

/**
 * Комментарии: форма ответа, «сердечко» и окно комментариев к записи — ответы веткой под
 * комментарием, имя и аватар ведут в профиль.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Send, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { commentThreads, type PostComment } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useComments } from "@/lib/queries";
import { useBackend } from "../session";
import { Avatar, Sheet, Spinner, cx, inputClass, useToast } from "../ui";
import { authorHref } from "./shared";

/** Кому отвечаем: комментарий и имя для подсказки над полем. */
export interface ReplyTarget {
  id: string;
  name: string;
}

export function ReplyForm({
  postId,
  placeholder,
  label,
  onSent,
  replyTo = null,
  onCancelReply,
}: {
  postId: string;
  placeholder: string;
  label: string;
  onSent: () => void;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}) {
  const backend = useBackend();
  const toast = useToast();
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  // Ответ начинается с обращения по имени — в ветке видно, кому он.
  const [shownFor, setShownFor] = useState(replyTo);
  if (replyTo !== shownFor) {
    setShownFor(replyTo);
    if (replyTo && !text.trim()) setText(`${replyTo.name}, `);
  }
  useEffect(() => {
    if (replyTo) field.current?.focus();
  }, [replyTo]);
  const add = useMutation({
    mutationFn: (t: string) => backend.social.addComment(postId, t, replyTo?.id ?? null),
    onSuccess: () => {
      setText("");
      onCancelReply?.();
      onSent();
    },
    onError: (e) => toast(`Не отправилось: ${e.message}`),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) add.mutate(text.trim());
  }
  return (
    <form onSubmit={submit} className="mt-4">
      {replyTo && (
        <p className="text-secondary mb-2 flex items-center gap-2 text-[13px]">
          Ответ для <b className="text-label">{replyTo.name}</b>
          <button
            type="button"
            onClick={() => {
              setText("");
              onCancelReply?.();
            }}
            aria-label="Не отвечать"
            className="hover:text-label ml-auto"
          >
            <X className="size-4" />
          </button>
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={field}
          className={cx(inputClass, "min-h-12 resize-y")}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          aria-label={label}
        />
        <button
          type="submit"
          disabled={!text.trim() || add.isPending}
          className="bg-leaf grid size-12 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
          aria-label="Отправить"
        >
          <Send className="size-5" />
        </button>
      </div>
    </form>
  );
}

/** «Сердечко» комментария: сразу меняется на экране, при ошибке возвращается. */
export function CommentHeart({ comment }: { comment: PostComment }) {
  const backend = useBackend();
  const toast = useToast();
  const [state, setState] = useState({ on: comment.likedByMe, count: comment.likeCount });
  const mutation = useMutation({
    mutationFn: (on: boolean) => backend.social.setCommentLiked(comment.id, on),
    onError: (e, on) => {
      setState((s) => ({ on: !on, count: s.count + (on ? -1 : 1) }));
      toast(`Не получилось: ${e.message}`);
    },
  });
  return (
    <button
      type="button"
      aria-pressed={state.on}
      aria-label={state.on ? "Убрать сердечко" : "Поставить сердечко"}
      onClick={() => {
        const on = !state.on;
        setState((s) => ({ on, count: s.count + (on ? 1 : -1) }));
        mutation.mutate(on);
      }}
      className={cx("flex w-8 shrink-0 flex-col items-center self-start pt-0.5", state.on ? "text-alert" : "text-secondary")}
    >
      <Heart className="size-4" fill={state.on ? "currentColor" : "none"} aria-hidden />
      {state.count > 0 && <span className="text-[11px] tabular-nums">{state.count}</span>}
    </button>
  );
}

/** Строка комментария: аватар и имя — ссылка в профиль, «Ответить», удалить своё, сердечко. */
function CommentRow({
  comment: c,
  reply = false,
  onReply,
  onDelete,
}: {
  comment: PostComment;
  reply?: boolean;
  onReply: () => void;
  onDelete: () => void;
}) {
  const href = authorHref({ mine: c.mine, authorName: c.authorName });
  return (
    <div className="flex gap-3">
      <Link href={href} aria-label={`Профиль: ${c.authorDisplayName}`} className="shrink-0">
        <Avatar name={c.authorDisplayName} size={reply ? 26 : 32} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] break-words whitespace-pre-line">
          <Link href={href} className="mr-1.5 font-semibold">
            {c.authorDisplayName}
          </Link>
          {c.text}
        </p>
        <p className="text-secondary mt-0.5 flex gap-4 text-[12px]">
          <span>{timeAgo(c.createdAt)}</span>
          <button type="button" onClick={onReply} className="hover:text-label font-semibold">
            Ответить
          </button>
          {c.mine && (
            <button type="button" onClick={onDelete} aria-label="Удалить комментарий" className="hover:text-alert">
              <Trash2 className="size-3.5" />
            </button>
          )}
        </p>
      </div>
      <CommentHeart comment={c} />
    </div>
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
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const answer = (c: PostComment) => setReplyTo({ id: c.id, name: c.authorDisplayName });

  return (
    <Sheet
      open={postId !== null}
      onClose={() => {
        setReplyTo(null);
        onClose();
      }}
      title="Комментарии"
    >
      {comments.isPending ? (
        <Spinner />
      ) : comments.data?.length ? (
        <ul className="space-y-4">
          {commentThreads(comments.data).map(({ root, replies }) => (
            <li key={root.id}>
              <CommentRow comment={root} onReply={() => answer(root)} onDelete={() => remove.mutate(root.id)} />
              {replies.length > 0 && (
                <ul className="mt-3 ml-11 space-y-3">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <CommentRow comment={r} reply onReply={() => answer(r)} onDelete={() => remove.mutate(r.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary py-6 text-center">Будьте первым, кто оставит комментарий.</p>
      )}
      {postId && (
        <div className="bg-surface sticky bottom-0 pb-1">
          <ReplyForm
            postId={postId}
            placeholder="Комментарий…"
            label="Текст комментария"
            onSent={refresh}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        </div>
      )}
    </Sheet>
  );
}
