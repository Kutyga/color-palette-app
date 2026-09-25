"use client";

import { ChevronRight, LogOut, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireSession } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Avatar, Button, Card, PageHeader } from "@/components/ui";
import { levelFor } from "@/lib/domain/gamification";
import { plural } from "@/lib/format";
import { useProfile, useStats } from "@/lib/queries";

function Profile() {
  const { session, signOut } = useSession();
  const profile = useProfile();
  const stats = useStats();
  const router = useRouter();
  const isDemo = session.status === "ready" && session.backend.mode === "demo";
  const name = profile.data?.displayName ?? profile.data?.username ?? "…";
  const lp = stats.data ? levelFor(stats.data) : null;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Card className="flex items-center gap-4 p-5">
        <Avatar name={name} size={64} />
        <div className="min-w-0">
          <p className="truncate text-[22px] font-semibold">{name}</p>
          <p className="truncate text-secondary">
            {isDemo ? "Демо-режим" : `@${profile.data?.username ?? "…"}${session.status === "ready" && session.email ? ` · ${session.email}` : ""}`}
          </p>
        </div>
      </Card>

      {stats.data && lp && (
        <Link href="/achievements/" className="flex items-center gap-4 rounded-[20px] bg-surface p-5">
          <Trophy className="size-6 text-soil" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">
              Уровень {lp.level.number} · {lp.level.title}
            </p>
            <p className="text-[15px] text-secondary">
              {stats.data.plants} {plural(stats.data.plants, "растение", "растения", "растений")} · {stats.data.careEvents}{" "}
              {plural(stats.data.careEvents, "отметка", "отметки", "отметок")} ухода · {stats.data.posts}{" "}
              {plural(stats.data.posts, "пост", "поста", "постов")}
            </p>
          </div>
          <ChevronRight className="size-5 text-secondary" aria-hidden />
        </Link>
      )}

      {isDemo && (
        <Card className="p-5">
          <p className="font-semibold">Данные демо-режима хранятся только в этом браузере</p>
          <p className="mt-1 text-[15px] text-secondary">
            Зарегистрируйтесь, чтобы растения синхронизировались между телефоном и компьютером и чтобы работало распознавание по фото.
          </p>
          <Link href="/login/?mode=signup" className="mt-4 inline-flex rounded-full bg-leaf px-5 py-2.5 font-semibold text-white">
            Зарегистрироваться
          </Link>
        </Card>
      )}

      <Button
        variant="danger"
        className="w-full bg-surface"
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
