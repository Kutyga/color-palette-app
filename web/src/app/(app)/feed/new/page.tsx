"use client";

import { useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, NotebookPen, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { CameraField } from "@/components/camera";
import { useBackend } from "@/components/session";
import { Button, Chip, EmptyState, Field, PageHeader, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { DIARY_EVENTS, type DiaryEvent, type PostKind } from "@/lib/domain/social";
import { usePlants } from "@/lib/queries";

const MIN_QUESTION = 15;

function NewPostForm() {
  const params = useSearchParams();
  const backend = useBackend();
  const plants = usePlants();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [kind, setKind] = useState<PostKind>(params.get("type") === "question" ? "question" : "diary");
  const [event, setEvent] = useState<DiaryEvent>("new_leaf");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [text, setText] = useState("");
  const [plantId, setPlantId] = useState(params.get("plant") ?? "");
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [saving, setSaving] = useState(false);

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const isDiary = kind === "diary";
  const ready = isDiary ? !!plantId && !!photo : text.trim().length >= MIN_QUESTION;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      const post = await backend.social.createPost({
        kind,
        event: isDiary ? event : null,
        text: text.trim(),
        plantId: plantId || null,
        photo: photo?.blob ?? null,
        visibility: isDiary ? visibility : "public",
      });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast(isDiary ? "Запись добавлена в дневник" : "Вопрос опубликован");
      router.push(isDiary ? "/feed/?tab=diaries" : `/feed/question/?id=${encodeURIComponent(post.id)}`);
    } catch (err) {
      toast(`Не удалось опубликовать: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  if (plants.isPending) return <Spinner />;
  const myPlants = plants.data ?? [];

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl">
      <div className="mb-5 flex rounded-full bg-muted p-1" role="tablist" aria-label="Что публикуем">
        {(
          [
            ["diary", "Запись в дневник", NotebookPen],
            ["question", "Вопрос", MessageCircleQuestion],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[15px] font-medium transition",
              kind === k ? "bg-surface shadow-sm" : "text-secondary",
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>

      {isDiary && myPlants.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Сначала добавьте растение"
          message="Дневник ведётся для растений из вашей коллекции."
          action={
            <Link href="/garden/new/" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
              Добавить растение
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          <Field label={isDiary ? "Растение" : "Растение (если оно у вас в коллекции)"}>
            <select className={inputClass} value={plantId} onChange={(e) => setPlantId(e.target.value)} required={isDiary}>
              <option value="">{isDiary ? "Выберите растение" : "Не указывать"}</option>
              {myPlants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </select>
          </Field>
          {isDiary && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-secondary">Что произошло</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DIARY_EVENTS) as DiaryEvent[]).map((k) => (
                  <Chip key={k} active={event === k} onClick={() => setEvent(k)}>
                    {DIARY_EVENTS[k].emoji} {DIARY_EVENTS[k].label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <CameraField aspect="aspect-[4/3]" photoUrl={photo?.url ?? null} onCapture={(blob) => setPhoto({ blob, url: URL.createObjectURL(blob) })} />
            <p className="mt-2 text-center text-[13px] text-secondary">
              {isDiary ? "Фото обязательно — так в дневнике будет видно, как растение меняется." : "Фото поможет понять, что случилось. Можно и без него."}
            </p>
          </div>
          <Field label={isDiary ? "Пара слов" : "Вопрос"} hint={isDiary ? undefined : "Опишите, что видите, как поливаете и где стоит растение."}>
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isDiary ? "Седьмой резной лист за лето" : "Желтеют нижние листья, поливаю раз в неделю, стоит у окна на север…"}
            />
          </Field>
          {isDiary && (
            <Field label="Кто видит">
              <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "followers")}>
                <option value="public">Все</option>
                <option value="followers">Подписчики</option>
              </select>
            </Field>
          )}
          <Button type="submit" className="min-h-12 w-full" loading={saving} disabled={!ready}>
            {isDiary ? "Добавить в дневник" : "Спросить"}
          </Button>
          {!ready && (
            <p className="text-center text-[13px] text-secondary">
              {isDiary ? (!plantId ? "Выберите растение и сфотографируйте его." : "Сфотографируйте растение.") : `Опишите вопрос подробнее — хотя бы ${MIN_QUESTION} символов.`}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

export default function NewPostPage() {
  return (
    <>
      <PageHeader title="Новая публикация" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <NewPostForm />
        </Suspense>
      </RequireSession>
    </>
  );
}
