"use client";

/** Фото растения: своё или из базы знаний, пересъёмка камерой. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { useState } from "react";
import { CameraCapture } from "@/components/camera";
import { useBackend } from "@/components/session";
import { LARGE_PHOTO, PlantPhoto, useToast } from "@/components/ui";
import type { Plant } from "@/lib/domain/plant";
import type { Species } from "@/lib/domain/species";

export function PlantHero({ plant, species }: { plant: Plant; species: Species | null }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [cameraOpen, setCameraOpen] = useState(false);
  const upload = useMutation({
    mutationFn: (blob: Blob) => backend.garden.setPlantPhoto(plant.id, blob),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plant", plant.id] });
      qc.invalidateQueries({ queryKey: ["plants"] });
    },
    onError: (e) => toast(`Не удалось загрузить фото: ${e.message}`),
  });

  return (
    <div className="relative">
      <PlantPhoto
        src={plant.photoUrl ?? species?.image?.url}
        seed={plant.id}
        alt={plant.nickname}
        className="aspect-square w-full rounded-[28px]"
        iconSize={72}
        sizes={LARGE_PHOTO}
        whole
      />
      {!plant.photoUrl && species?.image && (
        <span className="glass absolute top-4 left-4 rounded-full px-3 py-1 text-[12px] font-medium">Фото из базы знаний</span>
      )}
      <button
        onClick={() => setCameraOpen(true)}
        className="glass absolute right-4 bottom-4 flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-semibold"
        disabled={upload.isPending}
      >
        <Camera className="size-4" aria-hidden /> {upload.isPending ? "Загружаем…" : plant.photoUrl ? "Переснять" : "Сфотографировать"}
      </button>
      {/* Только съёмка камерой: фото из галереи и интернета в коллекцию не загружаются. */}
      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(blob) => upload.mutate(blob)} />
    </div>
  );
}
