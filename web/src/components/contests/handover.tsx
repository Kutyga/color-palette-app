"use client";

/**
 * Вручение приза: победитель подтверждает «Забираю приз» или отказывается, организатор отмечает
 * «Приз передан». Не подтвердил за 72 часа — место переходит следующему по очереди жеребьёвки.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useBackend } from "@/components/session";
import { Button, Card, cx, useToast } from "@/components/ui";
import { CONTEST_RULES, prizeStatus, type Contest, type ContestParticipant, type PrizeStatus } from "@/lib/domain/contest";
import { formatShortDate } from "@/lib/format";

const STATUS: Record<PrizeStatus, { label: (p: ContestParticipant) => string; tone: string }> = {
  waiting: {
    label: (p) =>
      `ждём ответа до ${formatShortDate(p.claimDeadline!)}, ${p.claimDeadline!.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
    tone: "bg-muted text-secondary",
  },
  claimed: { label: () => "забирает приз", tone: "bg-leaf/10 text-leaf" },
  delivered: { label: () => "приз вручён 🎁", tone: "bg-leaf/15 text-leaf" },
  forfeited: { label: () => "не подтвердил — приз передан дальше", tone: "bg-muted text-secondary" },
};

export function PrizeStatusChip({ participant: p }: { participant: ContestParticipant }) {
  const status = prizeStatus(p);
  if (!status) return null;
  return <span className={cx("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", STATUS[status].tone)}>{STATUS[status].label(p)}</span>;
}

function useHandover(contestId: string) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (a: { action: "claim" | "decline" } | { action: "deliver"; userId: string }) =>
      a.action === "deliver" ? backend.contests.markDelivered(contestId, a.userId) : backend.contests[a.action](contestId),
    onSuccess: (_d, a) => {
      qc.invalidateQueries({ queryKey: ["contests"] });
      toast(
        a.action === "claim"
          ? "Отлично! Договоритесь с организатором о передаче"
          : a.action === "decline"
            ? "Приз передан следующему участнику"
            : "Отмечено: приз вручён",
      );
    },
    onError: (e) => toast(e.message),
  });
}

const chatLink = (label: string) => (
  <Link href="/messages/" className="bg-leaf flex min-h-12 items-center justify-center gap-2 rounded-full font-semibold text-white">
    <MessageCircle className="size-5" aria-hidden /> {label}
  </Link>
);

/** Панель победителя: подтвердить за 72 часа или отказаться. */
export function WinnerPanel({ contest: c, me }: { contest: Contest; me: ContestParticipant }) {
  const act = useHandover(c.id);
  const status = prizeStatus(me);
  if (status === "forfeited")
    return (
      <p className="bg-muted text-secondary rounded-2xl px-4 py-3 text-[15px]">
        Приз не подтвердили вовремя — он перешёл следующему участнику.
      </p>
    );
  if (!status) return null;
  return (
    <Card className="bg-leaf/10 space-y-3 p-5">
      <h2 className="text-[19px] font-semibold">🎉 Вы выиграли: {c.prize}</h2>
      {status === "waiting" && (
        <>
          <p className="text-[15px]">
            Подтвердите, что забираете приз, — у вас {CONTEST_RULES.claimHours} часа. Иначе он перейдёт следующему по жеребьёвке.{" "}
            <PrizeStatusChip participant={me} />
          </p>
          <Button className="min-h-12 w-full text-[17px]" loading={act.isPending} onClick={() => act.mutate({ action: "claim" })}>
            Забираю приз
          </Button>
          <Button variant="secondary" className="w-full" loading={act.isPending} onClick={() => act.mutate({ action: "decline" })}>
            Отказаться — пусть достанется другому
          </Button>
        </>
      )}
      {status === "claimed" && chatLink("Договориться с организатором")}
      {status === "delivered" && <p className="text-[15px]">Организатор отметил, что приз вручён. Пусть растёт на радость! 🌿</p>}
    </Card>
  );
}

/** Победители со статусом вручения; организатор отмечает «Приз передан». */
export function WinnersCard({ contest: c, participants }: { contest: Contest; participants: ContestParticipant[] }) {
  const act = useHandover(c.id);
  const winners = participants.filter((p) => p.place != null).sort((a, b) => a.place! - b.place!);
  return (
    <Card className="p-5">
      <h2 className="text-[19px] font-semibold">Победители</h2>
      {winners.length ? (
        <ol className="mt-2 space-y-3">
          {winners.map((w) => (
            <li key={w.userId} className="flex flex-wrap items-center gap-2">
              <span className="text-[17px]">
                🏆 {w.place}. {w.displayName}
              </span>
              <PrizeStatusChip participant={w} />
              {c.mine && prizeStatus(w) === "claimed" && (
                <Button
                  variant="secondary"
                  className="ml-auto"
                  loading={act.isPending}
                  onClick={() => act.mutate({ action: "deliver", userId: w.userId })}
                >
                  Приз передан
                </Button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-secondary mt-1">{participants.length ? "Все отказались — место свободно." : "Никто не участвовал."}</p>
      )}
      {c.mine && winners.length > 0 && <div className="mt-4">{chatLink("Сообщения с победителями")}</div>}
    </Card>
  );
}
