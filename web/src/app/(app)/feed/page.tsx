"use client";

import { Newspaper, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CommentsSheet, FullPost, PostCard } from "@/components/feed";
import { EmptyState, ErrorNote, PageHeader, Spinner, cx } from "@/components/ui";
import type { NewsArticle } from "@/lib/domain/social";
import { timeAgo } from "@/lib/format";
import { useFeed, useNews } from "@/lib/queries";

const TABS = [
  { id: "following", label: "Подписки" },
  { id: "discover", label: "Интересное" },
  { id: "news", label: "Новости" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Following({ onComments }: { onComments: (id: string) => void }) {
  const feed = useFeed("following");
  if (feed.isPending) return <Spinner />;
  if (feed.error) return <ErrorNote error={feed.error} onRetry={() => feed.refetch()} />;
  if (!feed.data.length) {
    return (
      <EmptyState
        icon={Users}
        title="Здесь появятся посты"
        message="Подпишитесь на садоводов во вкладке «Интересное» или поделитесь своим растением."
      />
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-4">
      {feed.data.map((p) => (
        <PostCard key={p.id} post={p} onComments={() => onComments(p.id)} />
      ))}
    </div>
  );
}

function Discover({ onComments }: { onComments: (id: string) => void }) {
  const feed = useFeed("discover");
  if (feed.isPending) return <Spinner />;
  if (feed.error) return <ErrorNote error={feed.error} onRetry={() => feed.refetch()} />;
  if (!feed.data.length) return <EmptyState icon={Users} title="Пока тихо" message="Станьте первым, кто покажет своё растение." />;
  return (
    <div className="snap-feed no-scrollbar -mx-4 h-[calc(100dvh-20rem)] min-h-[420px] overflow-y-auto sm:mx-auto sm:max-w-md md:h-[calc(100dvh-11rem)]">
      {feed.data.map((p) => (
        <div key={p.id} className="h-full pb-3 sm:pb-4">
          <FullPost post={p} onComments={() => onComments(p.id)} />
        </div>
      ))}
    </div>
  );
}

function NewsItem({ a }: { a: NewsArticle }) {
  const internal = a.url.startsWith("/");
  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-secondary">
          {a.sourceName} · {timeAgo(a.publishedAt)}
        </p>
        <h3 className="mt-1 text-[17px] leading-snug font-semibold">{a.title}</h3>
        {a.summary && <p className="mt-1 line-clamp-2 text-[15px] text-secondary">{a.summary}</p>}
      </div>
      {a.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- картинки с сайтов-источников
        <img src={a.imageUrl} alt="" className="size-24 shrink-0 rounded-2xl object-cover" loading="lazy" referrerPolicy="no-referrer" />
      )}
    </>
  );
  const cls = "flex gap-4 rounded-[20px] bg-surface p-4 transition hover:brightness-[0.98]";
  return internal ? (
    <Link href={a.url} className={cls}>
      {body}
    </Link>
  ) : (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  );
}

function News() {
  const [onlyMine, setOnlyMine] = useState(false);
  const news = useNews(onlyMine);
  return (
    <div className="mx-auto max-w-2xl">
      <label className="mb-4 flex items-center justify-between rounded-[20px] bg-surface px-4 py-3">
        <span className="font-medium">Только про мои растения</span>
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-5 accent-[var(--leaf)]" />
      </label>
      {news.isPending ? (
        <Spinner />
      ) : news.error ? (
        <ErrorNote error={news.error} onRetry={() => news.refetch()} />
      ) : news.data.length === 0 ? (
        <EmptyState icon={Newspaper} title="Новостей пока нет" message="Сбор новостей идёт каждый час — загляните позже." />
      ) : (
        <div className="space-y-3">
          {news.data.map((a) => (
            <NewsItem key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "following") as Tab;
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-full bg-muted p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => router.replace(`/feed/?tab=${t.id}`, { scroll: false })}
              className={cx("rounded-full px-4 py-1.5 text-[15px] font-medium transition", tab === t.id ? "bg-surface shadow-sm" : "text-secondary")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link href="/feed/new/" aria-label="Новый пост" className="flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-[15px] font-semibold text-white">
          <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Пост</span>
        </Link>
      </div>
      {tab === "following" && <Following onComments={setCommentsFor} />}
      {tab === "discover" && <Discover onComments={setCommentsFor} />}
      {tab === "news" && <News />}
      <CommentsSheet postId={commentsFor} onClose={() => setCommentsFor(null)} />
    </>
  );
}

export default function FeedPage() {
  return (
    <>
      <PageHeader title="Лента" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <FeedInner />
        </Suspense>
      </RequireSession>
    </>
  );
}
