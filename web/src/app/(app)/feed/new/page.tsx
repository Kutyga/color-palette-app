"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend } from "@/components/session";
import { Button, Field, PageHeader, Spinner, inputClass, useToast } from "@/components/ui";
import { toJpeg } from "@/lib/image";
import { usePlants } from "@/lib/queries";

function NewPostForm() {
  const params = useSearchParams();
  const backend = useBackend();
  const plants = usePlants();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [text, setText] = useState("");
  const [plantId, setPlantId] = useState(params.get("plant") ?? "");
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await backend.social.createPost({
        text: text.trim(),
        plantId: plantId || null,
        photo: photo ? await toJpeg(photo.file) : null,
        visibility,
      });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast("Пост опубликован");
      router.push("/feed/?tab=following");
    } catch (err) {
      toast(`Не удалось опубликовать: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
      <label className="relative block cursor-pointer overflow-hidden rounded-[28px]">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр
          <img src={photo.url} alt="Фото для поста" className="aspect-square w-full object-cover" />
        ) : (
          <span className="grid aspect-square w-full place-items-center bg-muted text-secondary">
            <span className="flex flex-col items-center gap-2">
              <ImagePlus className="size-10" strokeWidth={1.5} aria-hidden />
              <span className="font-medium">Выбрать фото</span>
            </span>
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPhoto({ file, url: URL.createObjectURL(file) });
          }}
        />
      </label>
      <div className="space-y-5">
        <Field label="Подпись">
          <textarea
            className={`${inputClass} min-h-32 resize-y`}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Седьмой резной лист за лето 🌿"
          />
        </Field>
        <Field label="Растение">
          <select className={inputClass} value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            <option value="">Без привязки</option>
            {plants.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Кто видит">
          <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "followers")}>
            <option value="public">Все</option>
            <option value="followers">Подписчики</option>
          </select>
        </Field>
        <Button type="submit" className="w-full min-h-12" loading={saving} disabled={!text.trim() && !photo}>
          Опубликовать
        </Button>
      </div>
    </form>
  );
}

export default function NewPostPage() {
  return (
    <>
      <PageHeader title="Новый пост" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <NewPostForm />
        </Suspense>
      </RequireSession>
    </>
  );
}
