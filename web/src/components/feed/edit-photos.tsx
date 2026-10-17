"use client";

/**
 * Правка фото своей публикации: убрать лишнее («случайно выложила фото хлеба»), добавить новое,
 * первое — обложка. В записи дневника — в любое время и хотя бы одно фото.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { POST_PHOTOS_MAX, type FeedPost, type PostPhotoEdit } from "@/lib/domain/social";
import { PhotosField } from "../camera";
import { useBackend } from "../session";
import { Button, useToast } from "../ui";

/** Плитка редактора: имеющееся фото (его ключ) или новый снимок. */
type Item = { url: string; keep: string } | { url: string; blob: Blob };

export function EditPhotosForm({ post, onDone }: { post: FeedPost; onDone: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [items, setItems] = useState<Item[]>(() => post.photoUrls.map((url, i) => ({ url, keep: post.photoKeys[i] })));
  // Ссылки предпросмотра новых снимков освобождаем, когда окно закрывается.
  const [local] = useState(() => new Set<string>());
  useEffect(() => () => local.forEach((u) => URL.revokeObjectURL(u)), [local]);

  const needOne = post.kind === "diary";
  const changed = items.length !== post.photoUrls.length || items.some((it, i) => !("keep" in it) || it.keep !== post.photoKeys[i]);
  const valid = changed && (!needOne || items.length > 0);
  const save = useMutation({
    mutationFn: () =>
      backend.social.updatePostPhotos(
        post.id,
        items.map((it): PostPhotoEdit => ("keep" in it ? { keep: it.keep } : { add: it.blob })),
      ),
    onSuccess: () => {
      toast("Фото обновлены");
      qc.invalidateQueries({ queryKey: ["feed"] });
      onDone();
    },
    onError: (e) => toast(e.message),
  });

  return (
    <div className="space-y-4 pb-2">
      <PhotosField
        photos={items}
        max={POST_PHOTOS_MAX}
        onAdd={(blob) => {
          const url = URL.createObjectURL(blob);
          local.add(url);
          setItems((xs) => (xs.length < POST_PHOTOS_MAX ? [...xs, { url, blob }] : xs));
        }}
        onRemove={(i) => setItems((xs) => xs.filter((_, j) => j !== i))}
      />
      {needOne && items.length === 0 && (
        <p className="text-secondary text-center text-[13px]">В записи дневника нужно хотя бы одно фото — добавьте новое.</p>
      )}
      <Button className="w-full" loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
        Сохранить фото
      </Button>
    </div>
  );
}
