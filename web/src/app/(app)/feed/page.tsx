"use client";

import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { RequireSession } from "@/components/app-shell";
import { CommentsSheet, FullPost, PostCard } from "@/components/feed";
import { EmptyState, ErrorNote, PageHeader, Spinner, cx } from "@/components/ui";
import { News } from "@/components/news";
import { useFeed } from "@/lib/queries";

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
