"use client";

/**
 * Комментарии: форма ответа и окно комментариев к записи.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { timeAgo } from "@/lib/format";
import { useComments } from "@/lib/queries";
import { useBackend } from "../session";
import { Avatar, Sheet, Spinner, cx, inputClass, useToast } from "../ui";

export function ReplyForm({
  postId,
  placeholder,
  label,
  onSent,
}: {
  postId: string;
  placeholder: string;
  label: string;
  onSent: () => void;
}) {
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
      <button
        type="submit"
        disabled={!text.trim() || add.isPending}
        className="bg-leaf grid size-12 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
        aria-label="Отправить"
      >
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
                <p className="text-secondary text-[12px]">{timeAgo(c.createdAt)}</p>
              </div>
              {c.mine && (
                <button
                  type="button"
                  onClick={() => remove.mutate(c.id)}
                  aria-label="Удалить комментарий"
                  className="text-secondary hover:text-alert"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary py-6 text-center">Будьте первым, кто оставит комментарий.</p>
      )}
      {postId && (
        <div className="bg-surface sticky bottom-0 pb-1">
          <ReplyForm postId={postId} placeholder="Комментарий…" label="Текст комментария" onSent={refresh} />
        </div>
      )}
    </Sheet>
  );
}
