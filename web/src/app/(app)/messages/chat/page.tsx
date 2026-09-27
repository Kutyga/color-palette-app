"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Flag, MessageCircle, MoreHorizontal, Send, ShieldOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { ReportSheet, listingHref } from "@/components/market";
import { personHref } from "@/components/people";
import { useBackend } from "@/components/session";
import { Avatar, Button, EmptyState, ErrorNote, PlantPhoto, Sheet, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { MAX_MESSAGE, type ChatMessage, type Conversation } from "@/lib/domain/market";
import { useConversations, useMessages } from "@/lib/queries";

const dayLabel = (d: Date) => d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const timeLabel = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function ChatMenu({ conv }: { conv: Conversation }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<"menu" | "block" | "report" | null>(null);
  const closeIf = (m: typeof mode) => () => setMode((cur) => (cur === m ? null : cur));
  const block = useMutation({
    mutationFn: () => backend.chat.block(conv.otherId),
    onSuccess: () => {
      toast(`${conv.otherDisplayName} заблокирован(а)`);
      setMode(null);
      qc.invalidateQueries({ queryKey: ["chat"] });
      qc.invalidateQueries({ queryKey: ["market"] });
    },
    onError: (e) => toast(e.message),
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setMode("menu")}
        aria-label="Действия с чатом"
        className="text-secondary hover:bg-muted grid size-9 shrink-0 place-items-center rounded-full"
      >
        <MoreHorizontal className="size-5" />
      </button>
      <Sheet open={mode === "menu"} onClose={closeIf("menu")} title={conv.otherDisplayName}>
        <div className="space-y-2 pb-2">
          <button
            type="button"
            onClick={() => setMode("report")}
            className="bg-muted flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-semibold"
          >
            <Flag className="size-5" aria-hidden /> Пожаловаться
          </button>
          {!conv.blocked && (
            <button
              type="button"
              onClick={() => setMode("block")}
              className="bg-muted text-alert flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-semibold"
            >
              <ShieldOff className="size-5" aria-hidden /> Заблокировать
            </button>
          )}
        </div>
      </Sheet>
      <Sheet open={mode === "block"} onClose={closeIf("block")} title="Заблокировать?">
        <p className="text-secondary">
          {conv.otherDisplayName} не сможет писать вам и видеть ваши объявления и публикации. Вы тоже не сможете писать в этот чат.
        </p>
        <div className="mt-5 flex gap-2 pb-2">
          <Button variant="secondary" className="flex-1" onClick={() => setMode(null)}>
            Отмена
          </Button>
          <Button variant="danger" className="flex-1" loading={block.isPending} onClick={() => block.mutate()}>
            Заблокировать
          </Button>
        </div>
      </Sheet>
      <ReportSheet open={mode === "report"} onClose={closeIf("report")} target={{ type: "profile", id: conv.otherId }} />
    </>
  );
}

function Bubbles({ messages }: { messages: ChatMessage[] }) {
  return (
    <ol className="space-y-1.5" aria-label="Сообщения">
      {messages.map((m, i) => {
        const day = dayLabel(m.createdAt);
        const showDay = i === 0 || day !== dayLabel(messages[i - 1].createdAt);
        return (
          <li key={m.id}>
            {showDay && <p className="text-secondary my-3 text-center text-[12px]">{day}</p>}
            <div className={cx("flex", m.mine ? "justify-end" : "justify-start")}>
              <p
                className={cx(
                  "max-w-[80%] rounded-[20px] px-3.5 py-2 text-[15px] leading-snug whitespace-pre-line",
                  m.mine ? "bg-leaf rounded-br-md text-white" : "bg-surface rounded-bl-md",
                )}
              >
                {m.body}
                <span className={cx("ml-2 inline-block translate-y-0.5 text-[11px]", m.mine ? "text-white/70" : "text-secondary")}>
                  {timeLabel(m.createdAt)}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Chat() {
  const id = useSearchParams().get("id");
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const convs = useConversations();
  const messages = useMessages(id);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const conv = convs.data?.find((c) => c.id === id) ?? null;

  const append = (m: ChatMessage) =>
    qc.setQueryData<ChatMessage[]>(["chat", "messages", id], (list = []) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  // Новые сообщения собеседника — сразу; открытый чат считается прочитанным.
  useEffect(() => {
    if (!id) return;
    void backend.chat.markRead(id).then(() => qc.invalidateQueries({ queryKey: ["chat", "list"] }));
    return backend.chat.subscribe(id, (m) => {
      qc.setQueryData<ChatMessage[]>(["chat", "messages", id], (list = []) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      if (!m.mine) void backend.chat.markRead(id).then(() => qc.invalidateQueries({ queryKey: ["chat", "list"] }));
    });
  }, [id, backend, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: (body: string) => backend.chat.send(id!, body),
    onSuccess: (m) => {
      append(m);
      setText("");
      qc.invalidateQueries({ queryKey: ["chat", "list"] });
    },
    onError: (e) => toast(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim() && !send.isPending) send.mutate(text.trim());
  }

  if (!id) return <EmptyState icon={MessageCircle} title="Чат не найден" message="Ссылка неполная." />;
  if (convs.isPending || messages.isPending) return <Spinner />;
  if (convs.error) return <ErrorNote error={convs.error} onRetry={() => convs.refetch()} />;
  if (!conv) return <EmptyState icon={MessageCircle} title="Чат не найден" message="Его нет или он недоступен." />;

  return (
    <div className="mx-auto flex max-w-xl flex-col">
      <header className="mb-3 flex items-center gap-3">
        <Link href={personHref(conv.otherName)} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={conv.otherDisplayName} size={40} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{conv.otherDisplayName}</span>
            <span className="text-secondary block truncate text-[13px]">{conv.iAmSeller ? "Покупатель" : "Продавец"}</span>
          </span>
        </Link>
        <ChatMenu conv={conv} />
      </header>
      {conv.listingId && (
        <Link href={listingHref(conv.listingId)} className="bg-surface mb-3 flex items-center gap-3 rounded-2xl p-2.5">
          <PlantPhoto src={conv.listingPhotoUrl} seed={conv.listingId} alt="" className="size-12 shrink-0 rounded-xl" iconSize={18} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{conv.listingTitle ?? "Объявление"}</span>
            <span className="text-secondary block text-[12px]">
              {conv.listingStatus === "closed"
                ? "Объявление закрыто"
                : conv.listingStatus === "reserved"
                  ? "Забронировано"
                  : "Открыть объявление"}
            </span>
          </span>
        </Link>
      )}
      <p className="bg-muted text-secondary mb-3 rounded-2xl px-4 py-2.5 text-[12px]">
        Не переводите предоплату незнакомым и не сообщайте коды из СМС. Встречайтесь в людных местах.
      </p>
      {messages.error ? (
        <ErrorNote error={messages.error} onRetry={() => messages.refetch()} />
      ) : messages.data?.length ? (
        <Bubbles messages={messages.data} />
      ) : (
        <p className="text-secondary py-6 text-center">Напишите первое сообщение — например, когда удобно забрать растение.</p>
      )}
      <div ref={endRef} />
      {conv.blocked ? (
        <p className="bg-muted text-secondary mt-4 rounded-2xl px-4 py-3 text-center">
          Переписка закрыта: один из вас заблокировал другого.
        </p>
      ) : (
        <form onSubmit={submit} className="bg-bg sticky bottom-0 mt-4 flex items-end gap-2 pt-2 pb-2">
          <textarea
            className={cx(inputClass, "max-h-40 min-h-12 resize-none")}
            rows={1}
            value={text}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение…"
            aria-label="Текст сообщения"
          />
          <button
            type="submit"
            disabled={!text.trim() || send.isPending}
            className="bg-leaf grid size-12 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
            aria-label="Отправить"
          >
            <Send className="size-5" />
          </button>
        </form>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <>
      <div className="pt-4 pb-3">
        <Link href="/messages/" className="text-leaf inline-flex items-center gap-1 text-[15px] font-medium">
          <ChevronLeft className="size-5" aria-hidden /> Сообщения
        </Link>
      </div>
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <Chat />
        </Suspense>
      </RequireSession>
    </>
  );
}
