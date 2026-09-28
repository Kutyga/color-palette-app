"use client";

/** Мой профиль: данные, подписки, магазин, список «Хочу», уведомления и выход. */

import { ChevronRight, LogOut, Pencil, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { NotificationsCard } from "@/components/notifications";
import { EditProfileSheet, ProfileHeader } from "@/components/people";
import { useSession } from "@/components/session";
import { ProfileShopCard, WishlistCard } from "@/components/shops";
import { Button, Card, PageHeader, Spinner } from "@/components/ui";
import { levelFor } from "@/lib/domain/gamification";
import { plural } from "@/lib/format";
import { usePerson, useProfile, useStats } from "@/lib/queries";

function Profile() {
  const { session, signOut } = useSession();
  const profile = useProfile();
  const stats = useStats();
  const router = useRouter();
  const isDemo = session.status === "ready" && session.backend.mode === "demo";
  const me = usePerson(profile.data?.username ?? null);
  // Ссылка «Заполнить профиль» из условий розыгрыша открывает редактирование сразу (?edit=1).
  // Профиль рисуется только в браузере (после проверки входа), поэтому window здесь доступен.
  const [editing, setEditing] = useState(() => new URLSearchParams(window.location.search).get("edit") === "1");
  const lp = stats.data ? levelFor(stats.data) : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {me.data ? (
        <ProfileHeader
          person={me.data}
          action={
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="size-4" aria-hidden /> Редактировать профиль
              </Button>
              <Link href="/people/" className="bg-muted inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold">
                <Search className="size-4" aria-hidden /> Найти садоводов
              </Link>
            </>
          }
        />
      ) : (
        <Spinner />
      )}
      {session.status === "ready" && (isDemo || session.email) && (
        <p className="text-secondary px-1 text-[13px]">{isDemo ? "Демо-режим" : `Вход: ${session.email}`}</p>
      )}
      {profile.data && (
        <EditProfileSheet
          open={editing}
          onClose={() => setEditing(false)}
          initial={{
            displayName: profile.data.displayName ?? "",
            username: profile.data.username,
            bio: profile.data.bio ?? "",
            city: profile.data.city ?? "",
          }}
        />
      )}

      {stats.data && lp && (
        <Link href="/achievements/" className="bg-surface flex items-center gap-4 rounded-[20px] p-5">
          <Trophy className="text-soil size-6" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">
              Уровень {lp.level.number} · {lp.level.title}
            </p>
            <p className="text-secondary text-[15px]">
              {stats.data.plants} {plural(stats.data.plants, "растение", "растения", "растений")} · {stats.data.careEvents}{" "}
              {plural(stats.data.careEvents, "отметка", "отметки", "отметок")} ухода · {stats.data.posts}{" "}
              {plural(stats.data.posts, "публикация", "публикации", "публикаций")}
            </p>
          </div>
          <ChevronRight className="text-secondary size-5" aria-hidden />
        </Link>
      )}

      <WishlistCard />
      <NotificationsCard />
      <ProfileShopCard />

      {isDemo && (
        <Card className="p-5">
          <p className="font-semibold">Данные демо-режима хранятся только в этом браузере</p>
          <p className="text-secondary mt-1 text-[15px]">
            Зарегистрируйтесь, чтобы растения синхронизировались между телефоном и компьютером и чтобы работало распознавание по фото.
          </p>
          <Link href="/login/?mode=signup" className="bg-leaf mt-4 inline-flex rounded-full px-5 py-2.5 font-semibold text-white">
            Зарегистрироваться
          </Link>
        </Card>
      )}

      <Button
        variant="danger"
        className="bg-surface w-full"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
      >
        <LogOut className="size-4" aria-hidden /> {isDemo ? "Выйти из демо-режима" : "Выйти"}
      </Button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Профиль" />
      <RequireSession>
        <Profile />
      </RequireSession>
    </>
  );
}
