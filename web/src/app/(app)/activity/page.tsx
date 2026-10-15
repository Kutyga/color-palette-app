"use client";

/**
 * «Активность»: кто прокомментировал мои записи, ответил на мои комментарии, нажал «Полить»
 * и подписался — как уведомления в Instagram. Не нужно листать дневники в поисках новых комментариев.
 * При открытии всё отмечается просмотренным; новые с прошлого раза подсвечены.
 */

import { useQueryClient } from "@tanstack/react-query";
import { Droplets, Heart, MessageCircle, Reply, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend } from "@/components/session";
import { Avatar, EmptyState, ErrorNote, PageHeader, Spinner, cx } from "@/components/ui";
import { activityHref, type ActivityItem } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useActivity } from "@/lib/queries";

const KIND: Record<ActivityItem["kind"], { icon: typeof Heart; color: string }> = {
  comment: { icon: MessageCircle, color: "var(--leaf)" },
  reply: { icon: Reply, color: "var(--leaf)" },
  like: { icon: Droplets, color: "var(--water)" },
  follow: { icon: UserPlus, color: "var(--leaf)" },
};

/** «комментарий к записи о «Монстере»» — что произошло; без глаголов в роде, пол автора неизвестен. */
function what(a: ActivityItem): string {
  const about = a.plantName ? `записи о «${a.plantName}»` : "вашей записи";
  switch (a.kind) {
    case "comment":
      return a.postKind === "question" ? "ответ на ваш вопрос" : `комментарий к ${about}`;
    case "reply":
      return "ответ на ваш комментарий";
    case "like":
      return a.postKind === "question" ? "«Поддержать» на вашем вопросе" : `«Полить» к ${about}`;
    case "follow":
      return "новый подписчик";
  }
}

function Row({ a }: { a: ActivityItem }) {
  const { icon: Icon, color } = KIND[a.kind];
  return (
    <li>
      <Link href={activityHref(a)} className={cx("flex items-start gap-3 px-4 py-3 transition", a.unread && "bg-leaf/8")}>
        <span className="relative shrink-0">
          <Avatar name={a.actorDisplayName} />
          <span
            className="bg-surface absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full"
            style={{ color }}
            aria-hidden
          >
            <Icon className="size-3.5" />
          </span>
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-snug">
          <span className="font-semibold">{a.actorDisplayName}</span> — {what(a)}
          {a.text && <span className="text-secondary mt-0.5 line-clamp-2 block">«{a.text}»</span>}
          <span className="text-secondary mt-0.5 block text-[13px]">{timeAgo(a.createdAt)}</span>
        </span>
        {a.unread && <span className="bg-alert mt-2 size-2.5 shrink-0 rounded-full" aria-label="новое" />}
      </Link>
    </li>
  );
}

function ActivityList() {
  const list = useActivity();
  const backend = useBackend();
  const qc = useQueryClient();
  const marked = useRef(false);

  // Открыли — значит, видели: значок в шапке гаснет, а подсветка новых остаётся до следующего раза.
  useEffect(() => {
    if (!list.data || marked.current) return;
    marked.current = true;
    if (!list.data.some((a) => a.unread)) return;
    backend.social
      .markActivitySeen()
      .then(() => qc.setQueryData(["activity", "unread"], 0))
      .catch(() => {});
  }, [list.data, backend, qc]);

  if (list.isPending) return <Spinner />;
  if (list.error) return <ErrorNote error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data.length) {
    return (
      <EmptyState
        icon={Heart}
        title="Пока тихо"
        message="Здесь появятся комментарии к вашим записям, ответы на ваши комментарии, «Полить» и новые подписчики."
      />
    );
  }
  return (
    <ul className="bg-surface divide-separator divide-y overflow-hidden rounded-[20px]">
      {list.data.map((a) => (
        <Row key={a.id} a={a} />
      ))}
    </ul>
  );
}

export default function ActivityPage() {
  return (
    <>
      <PageHeader title="Активность" />
      <RequireSession>
        <ActivityList />
      </RequireSession>
    </>
  );
}
