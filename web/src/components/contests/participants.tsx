/** Участники розыгрыша: победители сверху — список открыт всем. */

import { Trophy } from "lucide-react";
import Link from "next/link";
import { personHref } from "@/components/people";
import { Avatar } from "@/components/ui";
import type { ContestParticipant } from "@/lib/domain/contest";

export function ParticipantsList({ participants }: { participants: ContestParticipant[] }) {
  if (!participants.length) return <p className="bg-surface text-secondary rounded-[20px] p-4">Пока никто не участвует — будьте первым.</p>;
  return (
    <ul className="divide-separator bg-surface divide-y rounded-[20px]" aria-label="Участники">
      {participants.map((p) => (
        <li key={p.userId}>
          <Link href={personHref(p.username)} className="flex items-center gap-3 px-4 py-2.5">
            <Avatar name={p.displayName} size={32} />
            <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
            {p.place != null && (
              <span className="text-leaf flex items-center gap-1 text-[13px] font-semibold">
                <Trophy className="size-4" aria-hidden /> {p.place} место
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
