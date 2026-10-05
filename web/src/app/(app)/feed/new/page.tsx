"use client";

/** Новая публикация: запись в дневник растения, совет для всех (без растения) или вопрос в «Помощь». */

import { useQueryClient } from "@tanstack/react-query";
import { Lightbulb, MessageCircleQuestion, NotebookPen, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { PhotosField, type PickedPhoto } from "@/components/camera";
import { useBackend } from "@/components/session";
import { Button, Chip, EmptyState, Field, PageHeader, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { DIARY_EVENTS, type DiaryEvent } from "@/lib/domain/social";
import { usePlants } from "@/lib/queries";

const MIN_QUESTION = 15;
const MIN_TIP = 20;
/** Сколько фото можно приложить к публикации: например, новый росток и всё растение целиком. */
const MAX_PHOTOS = 5;

/** Что публикуем: tip — запись с меткой «Совет» без обязательного растения и фото. */
type Mode = "diary" | "tip" | "question";
const modeOf = (type: string | null): Mode => (type === "question" || type === "tip" ? type : "diary");
/** События для записи о своём растении; «Совет» — отдельный режим. */
const PLANT_EVENTS = (Object.keys(DIARY_EVENTS) as DiaryEvent[]).filter((k) => k !== "tip");

function NewPostForm() {
  const params = useSearchParams();
  const backend = useBackend();
  const plants = usePlants();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(modeOf(params.get("type")));
  const [event, setEvent] = useState<DiaryEvent>("new_leaf");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [text, setText] = useState("");
  const [plantId, setPlantId] = useState(params.get("plant") ?? "");
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [saving, setSaving] = useState(false);

  // Ссылки предпросмотра освобождаем, когда форма закрывается.
  const [urls] = useState(() => new Set<string>());
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  const addPhoto = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.add(url);
    setPhotos((ps) => (ps.length < MAX_PHOTOS ? [...ps, { blob, url }] : ps));
  };

  const isDiary = mode === "diary";
  const isTip = mode === "tip";
  const minText = isTip ? MIN_TIP : MIN_QUESTION;
  const ready = isDiary ? !!plantId && photos.length > 0 : text.trim().length >= minText;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      const post = await backend.social.createPost({
        kind: mode === "question" ? "question" : "diary",
        event: isDiary ? event : isTip ? "tip" : null,
        text: text.trim(),
        plantId: plantId || null,
        photos: photos.map((p) => p.blob),
        visibility: mode === "question" ? "public" : visibility,
      });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast(isDiary ? "Запись добавлена в дневник" : isTip ? "Совет опубликован" : "Вопрос опубликован");
      router.push(mode === "question" ? `/feed/question/?id=${encodeURIComponent(post.id)}` : "/feed/?tab=diaries");
    } catch (err) {
      toast(`Не удалось опубликовать: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  if (plants.isPending) return <Spinner />;
  const myPlants = plants.data ?? [];

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl">
      <div className="bg-muted mb-5 flex rounded-full p-1" role="tablist" aria-label="Что публикуем">
        {(
          [
            ["diary", "Дневник", NotebookPen],
            ["tip", "Совет", Lightbulb],
            ["question", "Вопрос", MessageCircleQuestion],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={cx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[15px] font-medium transition",
              mode === k ? "bg-surface shadow-sm" : "text-secondary",
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
            <Link href="/garden/new/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
              Добавить растение
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {isTip && (
            <p className="bg-muted text-secondary rounded-2xl px-4 py-3 text-[14px]">
              Поделитесь лайфхаком, советом или новостью для всех садоводов. Растение и фото — по желанию.
            </p>
          )}
          <Field label={isDiary ? "Растение" : isTip ? "Растение (если совет про ваше)" : "Растение (если оно у вас в коллекции)"}>
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
              <legend className="text-secondary mb-2 text-[13px] font-medium">Что произошло</legend>
              <div className="flex flex-wrap gap-2">
                {PLANT_EVENTS.map((k) => (
                  <Chip key={k} active={event === k} onClick={() => setEvent(k)}>
                    {DIARY_EVENTS[k].emoji} {DIARY_EVENTS[k].label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
          <div>
            <PhotosField
              photos={photos}
              max={MAX_PHOTOS}
              onAdd={addPhoto}
              onRemove={(i) => setPhotos((ps) => ps.filter((_, j) => j !== i))}
            />
            <p className="text-secondary mt-2 text-center text-[13px]">
              {isDiary
                ? `Хотя бы одно фото — так в дневнике будет видно, как растение меняется. Можно до ${MAX_PHOTOS}.`
                : isTip
                  ? "Картинка по желанию — например, как это выглядит на деле."
                  : "Фото поможет понять, что случилось. Можно и без него."}
            </p>
          </div>
          <Field
            label={isDiary ? "Пара слов" : isTip ? "Совет" : "Вопрос"}
            hint={
              isDiary ? undefined : isTip ? "Что делать и почему это работает." : "Опишите, что видите, как поливаете и где стоит растение."
            }
          >
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                isDiary
                  ? "Седьмой резной лист за лето"
                  : isTip
                    ? "Лайфхак: воду для полива отстаиваю в бутылке у батареи — она сразу комнатной температуры…"
                    : "Желтеют нижние листья, поливаю раз в неделю, стоит у окна на север…"
              }
            />
          </Field>
          {mode !== "question" && (
            <Field label="Кто видит">
              <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "followers")}>
                <option value="public">Все</option>
                <option value="followers">Подписчики</option>
              </select>
            </Field>
          )}
          <Button type="submit" className="min-h-12 w-full" loading={saving} disabled={!ready}>
            {isDiary ? "Добавить в дневник" : isTip ? "Опубликовать совет" : "Спросить"}
          </Button>
          {!ready && (
            <p className="text-secondary text-center text-[13px]">
              {isDiary
                ? !plantId
                  ? "Выберите растение и сфотографируйте его."
                  : "Сфотографируйте растение."
                : `${isTip ? "Напишите совет" : "Опишите вопрос"} подробнее — хотя бы ${minText} символов.`}
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
