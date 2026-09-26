"use client";

import { ChevronLeft, Lock, Sprout, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { RequireSession } from "@/components/app-shell";
import { FollowButton, ProfileHeader, PublicPlantsGrid } from "@/components/people";
import { EmptyState, ErrorNote, SectionTitle, Spinner } from "@/components/ui";
import { usePerson, usePlantsOf } from "@/lib/queries";

function PersonProfile() {
  const params = useSearchParams();
  const router = useRouter();
  const username = params.get("u");
  const person = usePerson(username);
  const plants = usePlantsOf(person.data?.id ?? null);

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
      <ProfileHeader person={p} action={<FollowButton person={p} />} />
      <SectionTitle>Растения</SectionTitle>
      {plants.isPending ? (
        <Spinner />
      ) : plants.error ? (
        <ErrorNote error={plants.error} onRetry={() => plants.refetch()} />
      ) : plants.data.length > 0 ? (
        <PublicPlantsGrid plants={plants.data} />
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
      <Link href="/people/" className="inline-flex items-center gap-1 text-[17px] text-leaf">
        <ChevronLeft className="size-5" aria-hidden /> Садоводы
      </Link>
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
