"use client";

/**
 * «Честность»: правила, опубликованный хеш секрета и проверка итогов прямо в браузере —
 * пересчёт победителей тем же способом, что в базе.
 */

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { CONTEST_RULES, verifyDraw, type Contest, type ContestParticipant } from "@/lib/domain/contest";

function Hash({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 text-[13px]">
      <span className="text-secondary">{label}: </span>
      <code className="bg-muted rounded px-1.5 py-0.5 text-[12px] break-all">{value}</code>
    </p>
  );
}

export function FairnessCard({ contest: c, participants }: { contest: Contest; participants: ContestParticipant[] | undefined }) {
  const check = useMutation({ mutationFn: () => verifyDraw(c, participants ?? []) });
  const ok = check.data && check.data.hashOk && check.data.winnersOk;
  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-[19px] font-semibold">
        <ShieldCheck className="text-leaf size-5" aria-hidden /> Честно и прозрачно
      </h2>
      <ul className="text-secondary mt-2 list-disc space-y-1 pl-5 text-[15px]">
        <li>Участие бесплатное. Шансы у всех равны — ни приглашения, ни что-то ещё их не повышает.</li>
        <li>
          Участвовать может аккаунт старше {CONTEST_RULES.minAccountDays} дней с растением со своим фото в коллекции
          {c.delivery ? "" : `, из города ${c.city}`}.
        </li>
        <li>
          Победителя выбирает сервер, а не организатор. Секрет жеребьёвки создан вместе с розыгрышем, его отпечаток опубликован ниже —
          поменять секрет потом нельзя. После итогов секрет раскрывается, и результат может пересчитать любой.
        </li>
        <li>
          Победитель подтверждает приз за {CONTEST_RULES.claimHours} часа. Не подтвердил или отказался — приз переходит следующему по
          очереди жеребьёвки (№ у каждого участника), это тоже проверяется.
        </li>
      </ul>
      <Hash label="Отпечаток секрета (SHA-256)" value={c.seedHash} />
      {c.seed && (
        <>
          <Hash label="Секрет" value={c.seed} />
          <Button variant="secondary" className="mt-3 w-full" loading={check.isPending} onClick={() => check.mutate()}>
            Проверить итоги
          </Button>
          {check.data &&
            (ok ? (
              <p className="text-leaf mt-2 flex items-center gap-2 text-[15px] font-medium">
                <CheckCircle2 className="size-5" aria-hidden /> Проверено: секрет совпадает с отпечатком, победители посчитаны верно
              </p>
            ) : (
              <p className="text-alert mt-2 flex items-center gap-2 text-[15px] font-medium">
                <XCircle className="size-5" aria-hidden />
                {check.data.hashOk ? "Победители не совпадают с расчётом" : "Секрет не совпадает с опубликованным отпечатком"}
              </p>
            ))}
          <p className="text-secondary mt-2 text-[12px]">
            Как считается: у каждого участника число u = (первые 52 бита SHA-256(«секрет:id участника») + 0,5) / 2⁵²; побеждают наибольшие.
          </p>
        </>
      )}
    </Card>
  );
}
