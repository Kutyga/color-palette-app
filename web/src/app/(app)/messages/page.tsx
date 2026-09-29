"use client";

/** Сообщения: личные переписки садоводов и чаты по объявлениям и розыгрышам. */

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
        message="Напишите садоводу из его профиля или продавцу из «Барахолки» — переписка появится здесь."
        action={
          <Link href="/feed/?tab=market" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
            Открыть барахолку
          </Link>
        }
      />
    );
  }
  return (
    <ul className="divide-separator bg-surface mx-auto max-w-xl divide-y overflow-hidden rounded-[20px]">
      {list.data.map((c) => (
        <li key={c.id}>
          <Link
            href={chatHref(c.id)}
            className="hover:bg-muted flex items-center gap-3 px-4 py-3"
            aria-label={`Чат с ${c.otherDisplayName}${c.unread ? ", есть новые" : ""}`}
          >
            <div className="relative shrink-0">
              <Avatar name={c.otherDisplayName} size={48} />
              {!c.direct && (
                <PlantPhoto
                  src={c.listingPhotoUrl}
                  seed={c.listingId ?? c.id}
                  alt=""
                  className="ring-surface absolute -right-1 -bottom-1 size-6 rounded-lg ring-2"
                  iconSize={12}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className={cx("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.otherDisplayName}</span>
                <span className="text-secondary ml-auto shrink-0 text-[12px]">{c.lastMessage ? timeAgo(c.lastMessageAt) : ""}</span>
              </p>
              <p className="text-secondary truncate text-[13px]">
                {c.direct ? (
                  "Личная переписка"
                ) : (
                  <>
                    {c.listingKind && `${LISTING_KINDS[c.listingKind].emoji} `}
                    {c.listingTitle ?? "Объявление удалено"}
                  </>
                )}
              </p>
              <p className={cx("truncate text-[15px]", c.unread ? "text-label font-semibold" : "text-secondary")}>
                {c.blocked ? "Переписка закрыта" : c.lastMessage ? `${c.lastFromMe ? "Вы: " : ""}${c.lastMessage}` : "Нет сообщений"}
              </p>
            </div>
            {c.unread && <span className="bg-leaf size-2.5 shrink-0 rounded-full" aria-hidden />}
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
