"use client";

/** Сообщество: лента (дневники и советы), «Помощь», барахолка и новости. */

import { MessageCircleQuestion, NotebookPen, Tag, UserSearch, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { ContestPromo } from "@/components/contests";
import { CommentsSheet, DiaryCard, QuestionRow } from "@/components/feed";
import { Market } from "@/components/market";
import { News } from "@/components/news";
import { Chip, EmptyState, ErrorNote, PageHeader, Spinner, cx } from "@/components/ui";
import type { DiaryScope, HelpFilter } from "@/lib/domain/social";
import { useDiaries, useQuestions } from "@/lib/queries";

const TABS = [
  { id: "diaries", label: "Лента" },
  { id: "help", label: "Помощь" },
  { id: "market", label: "Барахолка" },
  { id: "news", label: "Новости" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HELP_FILTERS: { id: HelpFilter; label: string }[] = [
  { id: "open", label: "Ждут ответа" },
  { id: "my_species", label: "Про мои растения" },
  { id: "mine", label: "Мои вопросы" },
  { id: "all", label: "Все" },
];

/** Фильтр ленты: все, подписки или только советы (советы — из общей ленты). */
type FeedFilter = DiaryScope | "tips";

function Diaries({ onComments }: { onComments: (id: string) => void }) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const scope: DiaryScope = filter === "following" ? "following" : "all";
  const feed = useDiaries(scope);
  const posts = filter === "tips" ? feed.data?.filter((p) => p.event === "tip") : feed.data;
  return (
    <div className="mx-auto max-w-xl">
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Все садоводы
        </Chip>
        <Chip active={filter === "following"} onClick={() => setFilter("following")}>
          Мои подписки
        </Chip>
        <Chip active={filter === "tips"} onClick={() => setFilter("tips")}>
          💡 Советы
        </Chip>
      </div>
      {feed.isPending ? (
        <Spinner />
      ) : feed.error ? (
        <ErrorNote error={feed.error} onRetry={() => feed.refetch()} />
      ) : !posts?.length ? (
        <EmptyState
          icon={Users}
          title={filter === "following" ? "Здесь появятся дневники растений" : filter === "tips" ? "Советов пока нет" : "Пока тихо"}
          message={
            filter === "following"
              ? "Подпишитесь на садоводов — их новые листья, пересадки и цветения будут здесь. Или начните свой дневник."
              : filter === "tips"
                ? "Знаете лайфхак для комнатных растений? Поделитесь — он появится здесь."
                : "Станьте первым — расскажите, что нового у вашего растения."
          }
          action={
            filter === "tips" ? (
              <Link href="/feed/new/?type=tip" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
                Поделиться советом
              </Link>
            ) : (
              <Link href="/people/" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
                Найти садоводов
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
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
            <Link href="/feed/new/?type=question" className="bg-leaf rounded-full px-6 py-3 font-semibold text-white">
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

const tabOf = (param: string | null): Tab => TABS.find((t) => t.id === param)?.id ?? "diaries";

/** Кнопки в шапке: «Садоводы» и создание — записи, вопроса или объявления, по открытой вкладке. */
function HeaderActions() {
  const tab = tabOf(useSearchParams().get("tab"));
  const action =
    tab === "help"
      ? { href: "/feed/new/?type=question", label: "Спросить", icon: MessageCircleQuestion }
      : tab === "market"
        ? { href: "/market/new/", label: "Объявление", icon: Tag }
        : tab === "diaries"
          ? { href: "/feed/new/?type=diary", label: "Запись", icon: NotebookPen }
          : null;
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/people/"
        aria-label="Садоводы"
        className="bg-muted flex size-10 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold sm:size-auto sm:px-4 sm:py-2"
      >
        <UserSearch className="size-5 sm:size-4" aria-hidden /> <span className="hidden sm:inline">Садоводы</span>
      </Link>
      {action && (
        <Link
          href={action.href}
          aria-label={action.label}
          className="bg-leaf flex size-10 items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold text-white sm:size-auto sm:px-4 sm:py-2"
        >
          <action.icon className="size-5 sm:size-4" aria-hidden /> <span className="hidden sm:inline">{action.label}</span>
        </Link>
      )}
    </div>
  );
}

function FeedInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = tabOf(params.get("tab"));
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  return (
    <>
      <div className="border-separator no-scrollbar -mx-4 mb-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-5" role="tablist">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/feed/?tab=${t.id}`, { scroll: false })}
              className={cx(
                "-mb-px shrink-0 border-b-[2.5px] pt-1 pb-2.5 text-[15px] font-semibold whitespace-nowrap transition",
                tab === t.id ? "border-leaf text-label" : "text-secondary hover:text-label border-transparent",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab !== "market" && <ContestPromo compact className="mb-4" />}
      {tab === "diaries" && <Diaries onComments={setCommentsFor} />}
      {tab === "help" && <Help />}
      {tab === "market" && <Market />}
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
          <Suspense fallback={null}>
            <HeaderActions />
          </Suspense>
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
