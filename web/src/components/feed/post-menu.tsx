"use client";

/**
 * Меню своей публикации: правка в течение часа и удаление.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { DIARY_EVENTS, editTimeLeft, type DiaryEvent, type FeedPost } from "@/lib/domain/social";
import { plural } from "@/lib/format";
import { useBackend } from "../session";
import { Button, Chip, Sheet, cx, inputClass, useToast } from "../ui";

export function PostMenu({ post, onDeleted }: { post: FeedPost; onDeleted?: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<"menu" | "edit" | "delete" | null>(null);
  const [left, setLeft] = useState(0);
  const close = () => setMode(null);
  // Закрытие одного окна (событие close у <dialog>) не должно сбрасывать уже открытое следующее.
  const closeIf = (m: typeof mode) => () => setMode((cur) => (cur === m ? null : cur));
  const remove = useMutation({
    mutationFn: () => backend.social.deletePost(post.id),
    onSuccess: () => {
      close();
      toast(post.kind === "question" ? "Вопрос удалён" : "Запись удалена");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      onDeleted?.();
    },
    onError: (e) => toast(`Не удалось удалить: ${e.message}`),
  });
  if (!post.mine) return null;
  const minutes = Math.ceil(left / 60_000);
  const what = post.kind === "question" ? "вопрос" : "запись";
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLeft(editTimeLeft(post));
          setMode("menu");
        }}
        aria-label="Действия с публикацией"
        className="text-secondary hover:bg-muted grid size-9 shrink-0 place-items-center rounded-full"
      >
        <MoreHorizontal className="size-5" />
      </button>
      <Sheet open={mode === "menu"} onClose={closeIf("menu")} title={post.kind === "question" ? "Мой вопрос" : "Моя запись"}>
        <div className="space-y-2 pb-2">
          {left > 0 ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="bg-muted flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
            >
              <Pencil className="text-leaf size-5" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold">Редактировать</span>
                <span className="text-secondary block text-[13px]">
                  Ещё {minutes} {plural(minutes, "минуту", "минуты", "минут")}
                </span>
              </span>
            </button>
          ) : (
            <p className="bg-muted text-secondary rounded-2xl px-4 py-3.5 text-[15px]">
              Редактировать можно в течение часа после публикации — это время прошло.
            </p>
          )}
          <button
            type="button"
            onClick={() => setMode("delete")}
            className="bg-muted text-alert flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-semibold"
          >
            <Trash2 className="size-5" aria-hidden /> Удалить {what}
          </button>
        </div>
      </Sheet>
      <Sheet open={mode === "delete"} onClose={closeIf("delete")} title={`Удалить ${what}?`}>
        <p className="text-secondary">
          {post.kind === "question"
            ? "Вопрос и ответы на него пропадут из «Помощи». Отменить нельзя."
            : "Запись пропадёт из дневника и ленты вместе с комментариями. Отменить нельзя."}
        </p>
        <div className="mt-5 flex gap-2 pb-2">
          <Button variant="secondary" className="flex-1" onClick={close}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" loading={remove.isPending} onClick={() => remove.mutate()}>
            Удалить
          </Button>
        </div>
      </Sheet>
      <Sheet open={mode === "edit"} onClose={closeIf("edit")} title={post.kind === "question" ? "Изменить вопрос" : "Изменить запись"}>
        {mode === "edit" && <EditPostForm post={post} onDone={close} />}
      </Sheet>
    </>
  );
}

function EditPostForm({ post, onDone }: { post: FeedPost; onDone: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [text, setText] = useState(post.text);
  const [event, setEvent] = useState<DiaryEvent>(post.event ?? "progress");
  const isQuestion = post.kind === "question";
  const valid = isQuestion ? text.trim().length >= 15 : true;
  const save = useMutation({
    mutationFn: () => backend.social.updatePost(post.id, { text: text.trim(), event: isQuestion ? undefined : event }),
    onSuccess: () => {
      toast("Сохранено");
      qc.invalidateQueries({ queryKey: ["feed"] });
      onDone();
    },
    onError: (e) => toast(e.message),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) save.mutate();
      }}
      className="space-y-4 pb-2"
    >
      {!isQuestion && (
        <fieldset>
          <legend className="text-secondary mb-2 text-[13px] font-medium">Что произошло</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DIARY_EVENTS) as DiaryEvent[]).map((k) => (
              <Chip key={k} active={event === k} onClick={() => setEvent(k)}>
                {DIARY_EVENTS[k].emoji} {DIARY_EVENTS[k].label}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      <textarea
        className={cx(inputClass, "min-h-32 resize-y")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        aria-label={isQuestion ? "Текст вопроса" : "Текст записи"}
      />
      <Button type="submit" className="w-full" loading={save.isPending} disabled={!valid}>
        Сохранить
      </Button>
    </form>
  );
}

/** Подписка прямо из записи — у кнопки садовода свой оптимистичный стейт. */
