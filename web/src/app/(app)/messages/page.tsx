"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { RequireSession } from "@/components/app-shell";
import { chatHref } from "@/components/market";
import { Avatar, EmptyState, ErrorNote, PageHeader, PlantPhoto, Spinner, cx } from "@/components/ui";
import { LISTING_KINDS } from "@/lib/domain/market";
import { timeAgo } from "@/lib/format";
import { useConversations } from "@/lib/queries";

function Conversations() {
  const list = useConversations();
  if (list.isPending) return <Spinner />;
  if (list.error) return <ErrorNote error={list.error} onRetry={() => list.refetch()} />;
  if (!list.data.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Сообщений пока нет"
        message="Напишите продавцу из «Барахолки» — переписка появится здесь."
        action={
          <Link href="/feed/?tab=market" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
            Открыть барахолку
          </Link>
        }
      />
    );
  }
  return (
    <ul className="mx-auto max-w-xl divide-y divide-separator overflow-hidden rounded-[20px] bg-surface">
      {list.data.map((c) => (
        <li key={c.id}>
          <Link href={chatHref(c.id)} className="flex items-center gap-3 px-4 py-3 hover:bg-muted" aria-label={`Чат с ${c.otherDisplayName}${c.unread ? ", есть новые" : ""}`}>
            <div className="relative shrink-0">
              <Avatar name={c.otherDisplayName} size={48} />
              <PlantPhoto src={c.listingPhotoUrl} seed={c.listingId ?? c.id} alt="" className="absolute -right-1 -bottom-1 size-6 rounded-lg ring-2 ring-surface" iconSize={12} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className={cx("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.otherDisplayName}</span>
                <span className="ml-auto shrink-0 text-[12px] text-secondary">{c.lastMessage ? timeAgo(c.lastMessageAt) : ""}</span>
              </p>
              <p className="truncate text-[13px] text-secondary">
                {c.listingKind && `${LISTING_KINDS[c.listingKind].emoji} `}
                {c.listingTitle ?? "Объявление удалено"}
              </p>
              <p className={cx("truncate text-[15px]", c.unread ? "font-semibold text-label" : "text-secondary")}>
                {c.blocked ? "Переписка закрыта" : c.lastMessage ? `${c.lastFromMe ? "Вы: " : ""}${c.lastMessage}` : "Нет сообщений"}
              </p>
            </div>
            {c.unread && <span className="size-2.5 shrink-0 rounded-full bg-leaf" aria-hidden />}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Сообщения" />
      <RequireSession>
        <Conversations />
      </RequireSession>
    </>
  );
}
