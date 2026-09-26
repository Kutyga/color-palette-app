"use client";

import { MessageCircleQuestion, NotebookPen, UserSearch, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CommentsSheet, DiaryCard, QuestionRow } from "@/components/feed";
import { Chip, EmptyState, ErrorNote, PageHeader, Spinner, cx } from "@/components/ui";
import { News } from "@/components/news";
import type { DiaryScope, HelpFilter } from "@/lib/domain/social";
import { useDiaries, useQuestions } from "@/lib/queries";

const TABS = [
  { id: "diaries", label: "Дневники" },
  { id: "help", label: "Помощь" },
  { id: "news", label: "Новости" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HELP_FILTERS: { id: HelpFilter; label: string }[] = [
  { id: "open", label: "Ждут ответа" },
  { id: "my_species", label: "Про мои растения" },
  { id: "mine", label: "Мои вопросы" },
  { id: "all", label: "Все" },
];

function Diaries({ onComments }: { onComments: (id: string) => void }) {
  const [scope, setScope] = useState<DiaryScope>("following");
  const feed = useDiaries(scope);
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex gap-2">
        <Chip active={scope === "following"} onClick={() => setScope("following")}>
          Мои подписки
        </Chip>
        <Chip active={scope === "all"} onClick={() => setScope("all")}>
          Все садоводы
        </Chip>
      </div>
      {feed.isPending ? (
        <Spinner />
      ) : feed.error ? (
        <ErrorNote error={feed.error} onRetry={() => feed.refetch()} />
      ) : !feed.data.length ? (
        <EmptyState
          icon={Users}
          title={scope === "following" ? "Здесь появятся дневники растений" : "Пока тихо"}
          message={
            scope === "following"
              ? "Подпишитесь на садоводов — их новые листья, пересадки и цветения будут здесь. Или начните свой дневник."
              : "Станьте первым — расскажите, что нового у вашего растения."
          }
          action={
            <Link href="/people/" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
              Найти садоводов
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {feed.data.map((p) => (
            <DiaryCard key={p.id} post={p} onComments={() => onComments(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Help() {
  const [filter, setFilter] = useState<HelpFilter>("open");
  const list = useQuestions(filter);
  return (
    <div className="mx-auto max-w-xl">
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {HELP_FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorNote error={list.error} onRetry={() => list.refetch()} />
      ) : !list.data.length ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={filter === "open" ? "Все вопросы решены" : "Вопросов пока нет"}
          message="Что-то не так с растением? Сфотографируйте его и спросите — ответят те, у кого растёт такое же."
          action={
            <Link href="/feed/new/?type=question" className="rounded-full bg-leaf px-6 py-3 font-semibold text-white">
              Задать вопрос
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.data.map((p) => (
            <QuestionRow key={p.id} post={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "diaries";
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const action =
    tab === "help"
      ? { href: "/feed/new/?type=question", label: "Спросить", icon: MessageCircleQuestion }
      : { href: "/feed/new/?type=diary", label: "Запись", icon: NotebookPen };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 rounded-full bg-muted p-1 sm:flex-none" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/feed/?tab=${t.id}`, { scroll: false })}
              className={cx(
                "flex-1 rounded-full px-3 py-1.5 text-[15px] font-medium transition sm:flex-none sm:px-4",
                tab === t.id ? "bg-surface shadow-sm" : "text-secondary",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== "news" && (
          <Link
            href={action.href}
            aria-label={action.label}
            className="flex size-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-leaf text-[15px] font-semibold text-white sm:size-auto sm:px-4 sm:py-2"
          >
            <action.icon className="size-5 sm:size-4" aria-hidden /> <span className="hidden sm:inline">{action.label}</span>
          </Link>
        )}
      </div>
      {tab === "diaries" && <Diaries onComments={setCommentsFor} />}
      {tab === "help" && <Help />}
      {tab === "news" && <News />}
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </>
  );
}

export default function FeedPage() {
  return (
    <>
      <PageHeader
        title="Сообщество"
        actions={
          <Link href="/people/" className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[15px] font-semibold">
            <UserSearch className="size-4" aria-hidden /> Садоводы
          </Link>
        }
      />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <FeedInner />
        </Suspense>
      </RequireSession>
    </>
  );
}
