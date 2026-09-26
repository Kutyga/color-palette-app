"use client";

import { ChevronLeft, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireSession } from "@/components/app-shell";
import { Answers, QuestionHeader } from "@/components/feed";
import { EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { usePost } from "@/lib/queries";

function Question() {
  const id = useSearchParams().get("id");
  const post = usePost(id);
  if (!id) return <EmptyState icon={MessageCircleQuestion} title="Вопрос не найден" message="Ссылка неполная." />;
  if (post.isPending) return <Spinner />;
  if (post.error) return <ErrorNote error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data || post.data.kind !== "question")
    return <EmptyState icon={MessageCircleQuestion} title="Вопрос не найден" message="Его удалили или он скрыт." />;
  return (
    <div className="mx-auto max-w-xl">
      <QuestionHeader post={post.data} />
      <Answers post={post.data} />
    </div>
  );
}

export default function QuestionPage() {
  return (
    <>
      <div className="pt-4">
        <Link href="/feed/?tab=help" className="inline-flex items-center gap-1 text-[15px] font-medium text-leaf">
          <ChevronLeft className="size-5" aria-hidden /> Помощь
        </Link>
      </div>
      <h1 className="sr-only">Вопрос</h1>
      <div className="pt-3">
        <RequireSession>
          <Suspense fallback={<Spinner />}>
            <Question />
          </Suspense>
        </RequireSession>
      </div>
    </>
  );
}
