"use client";

/** Удаление растения из коллекции — с подтверждением; потом возвращаемся в коллекцию. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { Button, Sheet, useToast } from "@/components/ui";
import type { Plant } from "@/lib/domain/plant";

export function DeletePlantButton({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => backend.garden.deletePlant(plant.id),
    onSuccess: () => {
      for (const key of ["plants", "tasks", "stats"]) qc.invalidateQueries({ queryKey: [key] });
      toast("Растение удалено из коллекции");
      router.replace("/garden/");
    },
    onError: (e) => toast(`Не удалось удалить: ${e.message}`),
  });
  return (
    <>
      <Button variant="danger" className="mt-8" onClick={() => setConfirm(true)}>
        <Trash2 className="size-4" aria-hidden /> Удалить из коллекции
      </Button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Удалить растение?">
        <p className="text-secondary">«{plant.nickname}» пропадёт из коллекции вместе с графиком ухода.</p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
          <Button className="bg-alert flex-1" loading={remove.isPending} onClick={() => remove.mutate()}>
            Удалить
          </Button>
        </div>
      </Sheet>
    </>
  );
}
