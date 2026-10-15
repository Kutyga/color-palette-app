"use client";

/** Профиль садовода: о себе, подписки, «Написать», открытые растения и открытые группы. */

import { Lock, Sprout, UserX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { BackLink } from "@/components/back-link";
import { FollowButton, MessageButton, ProfileHeader, PublicPlantsGrid } from "@/components/people";
import { Chip, EmptyState, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import type { PlantGroup } from "@/lib/domain/plant";
import { useGroupsOf, usePerson, usePlantsOf } from "@/lib/queries";

/** Растения выбранной группы; без группы — все. */
function inGroup<T extends { id: string }>(plants: T[], group: PlantGroup | undefined): T[] {
  if (!group) return plants;
  const ids = new Set(group.plantIds);
  return plants.filter((p) => ids.has(p.id));
}

function PersonProfile() {
  const params = useSearchParams();
  const router = useRouter();
  const username = params.get("u");
  const person = usePerson(username);
  const plants = usePlantsOf(person.data?.id ?? null);
  const groups = useGroupsOf(person.data?.id ?? null);
  const [group, setGroup] = useState<string | null>(null);

  // Свой профиль открываем на обычной странице профиля — там же редактирование.
  useEffect(() => {
    if (person.data?.isMe) router.replace("/profile/");
  }, [person.data?.isMe, router]);

  if (!username) return <EmptyState icon={UserX} title="Садовод не найден" message="Ссылка неполная." />;
  if (person.isPending) return <Spinner />;
  if (person.error) return <ErrorNote error={person.error} onRetry={() => person.refetch()} />;
  if (!person.data) return <EmptyState icon={UserX} title="Садовод не найден" message={`Профиля @${username} нет или он скрыт.`} />;
  const p = person.data;

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <ProfileHeader
        person={p}
        action={
          <>
            <FollowButton person={p} />
            <MessageButton person={p} />
          </>
        }
      />
      <SectionTitle>Растения</SectionTitle>
      {plants.isPending ? (
        <Spinner />
      ) : plants.error ? (
        <ErrorNote error={plants.error} onRetry={() => plants.refetch()} />
      ) : plants.data.length > 0 ? (
        <>
          {/* Открытые группы хозяина: «Бонсаи», «Кактусы на кухне» — показывают только свои растения. */}
          {!!groups.data?.length && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              <Chip active={!group} onClick={() => setGroup(null)}>
                Все
              </Chip>
              {groups.data.map((g) => (
                <Chip key={g.id} active={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)}>
                  📁 {g.name}
                </Chip>
              ))}
            </div>
          )}
          <PublicPlantsGrid
            plants={inGroup(
              plants.data,
              groups.data?.find((g) => g.id === group),
            )}
          />
        </>
      ) : p.isFollowing ? (
        <EmptyState icon={Sprout} title="Пока пусто" message={`${p.displayName} ещё не добавил(а) растения или скрыл(а) их.`} />
      ) : (
        <EmptyState icon={Lock} title="Растения видны подписчикам" message="Подпишитесь, чтобы посмотреть коллекцию." />
      )}
    </div>
  );
}

export default function PersonPage() {
  return (
    <div className="pt-4">
      <BackLink href="/people/" className="text-[17px]">
        Садоводы
      </BackLink>
      <div className="mt-4">
        <RequireSession>
          <Suspense fallback={<Spinner />}>
            <PersonProfile />
          </Suspense>
        </RequireSession>
      </div>
    </div>
  );
}
