"use client";

/** Вопрос из «Помощи» с ответами садоводов. */

import { MessageCircleQuestion } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireSession } from "@/components/app-shell";
import { BackLink } from "@/components/back-link";
import { Answers, QuestionHeader } from "@/components/feed";
import { PushNudge } from "@/components/notifications";
import { EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { usePost } from "@/lib/queries";

function Question() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const post = usePost(id);
  if (!id) return <EmptyState icon={MessageCircleQuestion} title="Вопрос не найден" message="Ссылка неполная." />;
  if (post.isPending) return <Spinner />;
  if (post.error) return <ErrorNote error={post.error} onRetry={() => post.refetch()} />;
  if (!post.data || post.data.kind !== "question")
    return <EmptyState icon={MessageCircleQuestion} title="Вопрос не найден" message="Его удалили или он скрыт." />;
  return (
    <div className="mx-auto max-w-xl">
      <QuestionHeader post={post.data} onDeleted={() => router.replace("/feed/?tab=help")} />
      {post.data.mine && <PushNudge className="mt-4" text="Сообщим, как только кто-то ответит на ваш вопрос." />}
      <Answers post={post.data} />
    </div>
  );
}

export default function QuestionPage() {
  return (
    <>
      <div className="pt-4">
        <BackLink href="/feed/?tab=help" className="text-[15px] font-medium">
          Помощь
        </BackLink>
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
