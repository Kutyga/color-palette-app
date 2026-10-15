"use client";

/**
 * Группы растения: свои подборки в коллекции («Бонсаи», «Кактусы на кухне») — чтобы не искать
 * растения на общей большой полке. Нажатие на группу добавляет растение или убирает его оттуда;
 * новую группу можно создать прямо здесь.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderHeart, Plus } from "lucide-react";
import { useState } from "react";
import { useBackend } from "@/components/session";
import { Chip, useToast } from "@/components/ui";
import { GROUP_NAME_MAX, type Plant, type PlantGroup } from "@/lib/domain/plant";
import { useGroups } from "@/lib/queries";
import { NameForm } from "./name";

export function PlantGroupsPicker({ plant }: { plant: Plant }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const groups = useGroups();
  const [creating, setCreating] = useState(false);

  const toggle = useMutation({
    mutationFn: ({ group, member }: { group: PlantGroup; member: boolean }) => backend.garden.setGroupMember(group.id, plant.id, member),
    onMutate: ({ group, member }) =>
      qc.setQueryData<PlantGroup[]>(["groups"], (gs) =>
        gs?.map((g) =>
          g.id !== group.id ? g : { ...g, plantIds: member ? [...g.plantIds, plant.id] : g.plantIds.filter((x) => x !== plant.id) },
        ),
      ),
    onError: (e) => {
      toast(`Не сохранилось: ${e.message}`);
      qc.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const create = useMutation({
    mutationFn: async (name: string) => {
      const g = await backend.garden.createGroup(name);
      await backend.garden.setGroupMember(g.id, plant.id, true);
      return g;
    },
    onSuccess: (g) => {
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["groups"] });
      toast(`Группа «${g.name}» создана`);
    },
    onError: (e) => toast(e.message),
  });

  const list = groups.data ?? [];
  return (
    <div className="bg-muted mt-2 rounded-xl px-4 py-3">
      <p className="flex items-center gap-2 text-[15px] font-medium">
        <FolderHeart className="text-secondary size-4" aria-hidden /> Группы
      </p>
      {!list.length && !creating && (
        <p className="text-secondary mt-1 text-[13px]">
          Соберите свои подборки — например, «Бонсаи» — и находите их в коллекции одним нажатием.
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((g) => {
          const member = g.plantIds.includes(plant.id);
          return (
            <Chip key={g.id} active={member} onClick={() => toggle.mutate({ group: g, member: !member })}>
              {g.name}
            </Chip>
          );
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-leaf border-leaf/40 inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed px-3 text-[14px] font-medium"
          >
            <Plus className="size-4" aria-hidden /> Новая группа
          </button>
        )}
      </div>
      {creating && (
        <NameForm
          initial=""
          max={GROUP_NAME_MAX}
          label="Название группы"
          placeholder="Например, Бонсаи"
          busy={create.isPending}
          onSave={(name) => create.mutate(name)}
          onCancel={() => setCreating(false)}
          className="mt-2"
        />
      )}
    </div>
  );
}
