/**
 * Конкурсы в барахолке: розыгрыши призов с честной проверяемой жеребьёвкой. Шансы у всех
 * участников равны. Проводить розыгрыш может любой садовод (одновременно — один), конкурсы
 * администратора закреплены сверху. Правила и расчёт совпадают с базой: supabase/migrations/*_contests.sql.
 */
import { prettyUsername } from "./people";

/** Правила участия — те же числа проверяет база. */
export const CONTEST_RULES = {
  /** Участвовать можно через столько дней после регистрации. */
  minAccountDays: 7,
  maxDays: 30,
  maxWinners: 5,
} as const;

/** Сколько длится розыгрыш: варианты в форме. */
export const CONTEST_DURATIONS = [1, 3, 7, 14, 30] as const;

export type ContestStatus = "active" | "finished" | "cancelled";

export interface Contest {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerDisplayName: string;
  title: string;
  prize: string;
  description: string;
  photoUrl: string | null;
  city: string;
  delivery: boolean;
  winnersCount: number;
  endsAt: Date;
  /** Конкурс администратора — всегда сверху. */
  pinned: boolean;
  status: ContestStatus;
  /** SHA-256 секрета — опубликован с самого начала. */
  seedHash: string;
  /** Сам секрет — раскрывается при подведении итогов. */
  seed: string | null;
  createdAt: Date;
  participants: number;
  joined: boolean;
  mine: boolean;
}

export interface ContestParticipant {
  userId: string;
  username: string;
  displayName: string;
  /** Место победителя или null. */
  place: number | null;
}

export interface ContestDraft {
  title: string;
  prize: string;
  description: string;
  city: string;
  delivery: boolean;
  winnersCount: number;
  days: number;
  /** Фото приза с камеры (необязательно). */
  photo: Blob | null;
}

export function validateContest(d: ContestDraft): string | null {
  const title = d.title.trim();
  if (title.length < 3 || title.length > 80) return "Название — от 3 до 80 символов";
  const prize = d.prize.trim();
  if (prize.length < 2 || prize.length > 120) return "Опишите приз — до 120 символов";
  if (d.description.length > 1000) return "Условия — до 1000 символов";
  const city = d.city.trim();
  if (city.length < 2 || city.length > 60) return "Укажите город";
  if (!Number.isInteger(d.winnersCount) || d.winnersCount < 1 || d.winnersCount > CONTEST_RULES.maxWinners)
    return `Победителей — от 1 до ${CONTEST_RULES.maxWinners}`;
  if (!(d.days > 0 && d.days <= CONTEST_RULES.maxDays)) return `Розыгрыш длится до ${CONTEST_RULES.maxDays} дней`;
  return null;
}

/** Идёт, ждёт итогов (время вышло, сервер подводит их раз в 5 минут), закончен или отменён. */
export type ContestPhase = "active" | "drawing" | "finished" | "cancelled";
export function contestPhase(c: Pick<Contest, "status" | "endsAt">, now: Date): ContestPhase {
  if (c.status !== "active") return c.status;
  return c.endsAt <= now ? "drawing" : "active";
}

/** Порядок в списке: закреплённые, идущие (ближайший финиш первым), затем законченные. */
export function sortContests(list: Contest[]): Contest[] {
  const rank = (c: Contest) => (c.status === "active" ? 0 : 1);
  return [...list].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      rank(a) - rank(b) ||
      (a.status === "active" ? a.endsAt.getTime() - b.endsAt.getTime() : b.endsAt.getTime() - a.endsAt.getTime()),
  );
}

// ---------------------------------------------------------------------------
// Жеребьёвка — тот же расчёт, что private.finish_contest в базе
// ---------------------------------------------------------------------------

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Число из (0; 1): первые 52 бита sha256(seed:userId) — ровно столько точно помещается в number. */
async function drawUniform(seed: string, userId: string): Promise<number> {
  const hex = (await sha256Hex(`${seed}:${userId}`)).slice(0, 13);
  return (parseInt(hex, 16) + 0.5) / 2 ** 52;
}

/**
 * Победители: у каждого участника число u из секрета, побеждают наибольшие. Секрет неизвестен
 * до конца, поэтому шансы равны и заранее никто, включая организатора, итог не знает.
 * При равенстве — по userId.
 */
export async function drawWinners(seed: string, userIds: string[], count: number) {
  const keyed = await Promise.all(userIds.map(async (userId) => ({ userId, key: await drawUniform(seed, userId) })));
  keyed.sort((a, b) => b.key - a.key || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));
  return keyed.slice(0, count).map((k) => k.userId);
}

/** Проверка итогов в браузере: секрет совпадает с опубликованным хешем, победители — с расчётом. */
export async function verifyDraw(c: Pick<Contest, "seed" | "seedHash" | "winnersCount">, participants: ContestParticipant[]) {
  if (!c.seed) return { hashOk: false, winnersOk: false };
  const hashOk = (await sha256Hex(c.seed)) === c.seedHash;
  const expected = await drawWinners(
    c.seed,
    participants.map((p) => p.userId),
    c.winnersCount,
  );
  const actual = participants
    .filter((p) => p.place != null)
    .sort((a, b) => a.place! - b.place!)
    .map((p) => p.userId);
  return { hashOk, winnersOk: expected.length === actual.length && expected.every((id, i) => id === actual[i]) };
}

// ---------------------------------------------------------------------------
// Строки базы
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

export function contestFromRow(r: Row, photoUrl: string | null, myId: string | null, joined: boolean): Contest {
  const organizer = (r.organizer as { username?: string; display_name?: string | null } | null) ?? {};
  const username = organizer.username ?? "sadovod";
  const counted = (r.entries as { count: number }[] | null)?.[0]?.count ?? 0;
  return {
    id: r.id as string,
    organizerId: r.organizer_id as string,
    organizerName: username,
    organizerDisplayName: organizer.display_name?.trim() || prettyUsername(username),
    title: r.title as string,
    prize: r.prize as string,
    description: (r.description as string | null) ?? "",
    photoUrl,
    city: r.city as string,
    delivery: Boolean(r.delivery),
    winnersCount: Number(r.winners_count ?? 1),
    endsAt: new Date(r.ends_at as string),
    pinned: Boolean(r.pinned),
    status: r.status as ContestStatus,
    seedHash: (r.seed_hash as string) ?? "",
    seed: (r.seed as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    participants: counted,
    joined,
    mine: myId != null && r.organizer_id === myId,
  };
}

export const participantFromRow = (r: Row): ContestParticipant => ({
  userId: r.user_id as string,
  username: r.username as string,
  displayName: (r.display_name as string) || prettyUsername(r.username as string),
  place: r.place == null ? null : Number(r.place),
});
