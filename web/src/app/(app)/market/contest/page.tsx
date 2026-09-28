"use client";

/** Розыгрыш: приз, условия, участие, итоги с проверкой честности и список участников. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Gift, MapPin, Pin, Trophy, Truck, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireSession } from "@/components/app-shell";
import { FairnessCard, ParticipantsList, PhaseLabel, WinnerPanel, WinnersCard } from "@/components/contests";
import { personHref } from "@/components/people";
import { useBackend } from "@/components/session";
import { Button, Card, EmptyState, ErrorNote, PlantPhoto, SectionTitle, Spinner, useToast } from "@/components/ui";
import { contestPhase, type Contest } from "@/lib/domain/contest";
import { plural } from "@/lib/format";
import { useContest, useContestParticipants, useProfile } from "@/lib/queries";

/** Участвовать, выйти, отменить — в зависимости от роли и этапа. */
function Actions({ contest: c }: { contest: Contest }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const act = useMutation({
    mutationFn: (action: "join" | "leave" | "cancel") => backend.contests[action](c.id),
    onSuccess: (_d, action) => {
      qc.invalidateQueries({ queryKey: ["contests"] });
      toast(action === "join" ? "Вы участвуете — удачи! 🍀" : action === "leave" ? "Вы больше не участвуете" : "Розыгрыш отменён");
    },
    onError: (e) => toast(e.message),
  });
  const phase = contestPhase(c, new Date());

  if (phase !== "active") return null;
  const canCancel = profile.data?.isAdmin || (c.mine && c.participants === 0);
  return (
    <div className="mt-4 space-y-2">
      {!c.mine &&
        (c.joined ? (
          <Button variant="secondary" className="w-full" loading={act.isPending} onClick={() => act.mutate("leave")}>
            Не участвовать
          </Button>
        ) : (
          <Button className="min-h-12 w-full text-[17px]" loading={act.isPending} onClick={() => act.mutate("join")}>
            <Gift className="size-5" aria-hidden /> Участвую
          </Button>
        ))}
      {c.mine && (
        <p className="text-secondary text-center text-[13px]">Это ваш розыгрыш — победителей выберет сервер, когда время выйдет.</p>
      )}
      {canCancel && (
        <Button variant="danger" className="w-full" loading={act.isPending} onClick={() => act.mutate("cancel")}>
          Отменить розыгрыш
        </Button>
      )}
    </div>
  );
}

function ContestView({ id }: { id: string }) {
  const contest = useContest(id);
  const participants = useContestParticipants(id);
  const profile = useProfile();
  if (contest.isPending) return <Spinner />;
  if (contest.error) return <ErrorNote error={contest.error} onRetry={() => contest.refetch()} />;
  const c = contest.data;
  if (!c) return <EmptyState icon={Gift} title="Розыгрыш не найден" message="Возможно, его отменили." />;
  const me = c.status === "finished" ? participants.data?.find((p) => p.username === profile.data?.username) : undefined;

  return (
    <div className="mx-auto max-w-2xl space-y-4 pt-4">
      <Link href="/feed/?tab=market" className="text-leaf inline-flex items-center gap-1 text-[17px]">
        <ChevronLeft className="size-5" aria-hidden /> Барахолка
      </Link>

      <Card className="overflow-hidden">
        {c.photoUrl && <PlantPhoto src={c.photoUrl} seed={c.id} alt={c.prize} className="aspect-[4/3] w-full" iconSize={48} />}
        <div className="p-5">
          <p className="text-secondary flex items-center gap-1 text-[13px] font-medium">
            {c.pinned && <Pin className="text-leaf size-4" aria-label="Закреплено" />}
            <PhaseLabel contest={c} />
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight">{c.title}</h1>
          <p className="mt-2 flex items-start gap-2 text-[17px] font-semibold">
            <Gift className="text-leaf mt-0.5 size-5 shrink-0" aria-hidden /> {c.prize}
          </p>
          {c.description && <p className="text-secondary mt-2 text-[15px] whitespace-pre-line">{c.description}</p>}
          <p className="text-secondary mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {c.city}
            </span>
            {c.delivery && (
              <span className="flex items-center gap-1">
                <Truck className="size-4" aria-hidden /> Доставка
              </span>
            )}
            <span className="flex items-center gap-1">
              <Trophy className="size-4" aria-hidden /> {c.winnersCount} {plural(c.winnersCount, "победитель", "победителя", "победителей")}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-4" aria-hidden /> {c.participants}
            </span>
          </p>
          <p className="text-secondary mt-3 text-[13px]">
            Проводит{" "}
            {c.pinned ? (
              "команда «Подоконника»"
            ) : (
              <Link href={personHref(c.organizerName)} className="text-leaf font-medium">
                {c.organizerDisplayName}
              </Link>
            )}
          </p>
          <Actions contest={c} />
        </div>
      </Card>

      {me && <WinnerPanel contest={c} me={me} />}
      {c.status === "finished" && participants.data && <WinnersCard contest={c} participants={participants.data} />}

      <FairnessCard contest={c} participants={participants.data} />

      <SectionTitle>Участники</SectionTitle>
      {participants.isPending ? <Spinner /> : <ParticipantsList participants={participants.data ?? []} />}
    </div>
  );
}

function ContestPageInner() {
  const id = useSearchParams().get("id");
  if (!id) return <ErrorNote error="Розыгрыш не найден" />;
  return <ContestView id={id} />;
}

export default function ContestPage() {
  return (
    <RequireSession>
      <Suspense fallback={<Spinner />}>
        <ContestPageInner />
      </Suspense>
    </RequireSession>
  );
}
