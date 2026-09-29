/**
 * Конкурсы в Supabase. Участие, отмена и список участников — RPC: условия (возраст аккаунта,
 * растение со своим фото, город) проверяет база, итоги раз в 5 минут подводит pg_cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { contestFromRow, participantFromRow, sortContests, validateContest, type ContestDraft } from "../../domain/contest";
import { DAY_MS } from "../../time";
import type { ContestRepository } from "../repositories";
import { LISTING_BUCKET, type Row, check, moderated, signedUrls, uploadJpeg } from "./shared";

const CONTEST_SELECT = "*, organizer:profiles!contests_organizer_id_fkey(username, display_name), entries:contest_entries(count)";
/** Законченные розыгрыши показываем ещё две недели — с итогами и проверкой. */
const FINISHED_VISIBLE_MS = 14 * DAY_MS;

export class SupabaseContests implements ContestRepository {
  constructor(
    private db: SupabaseClient,
    private uid: string,
  ) {}

  private async hydrate(rows: Row[]) {
    const ids = rows.map((r) => r.id as string);
    const [urls, mine] = await Promise.all([
      signedUrls(
        this.db,
        LISTING_BUCKET,
        rows.map((r) => r.photo_path as string | null).filter((p): p is string => !!p),
      ),
      ids.length
        ? this.db.from("contest_entries").select("contest_id").eq("user_id", this.uid).in("contest_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const joined = new Set((check(mine) as Row[]).map((r) => r.contest_id as string));
    return rows.map((r) =>
      contestFromRow(r, r.photo_path ? (urls.get(r.photo_path as string) ?? null) : null, this.uid, joined.has(r.id as string)),
    );
  }

  async contests() {
    const since = new Date(Date.now() - FINISHED_VISIBLE_MS).toISOString();
    const rows = check(
      await this.db
        .from("contests")
        .select(CONTEST_SELECT)
        .or(`status.eq.active,and(status.eq.finished,finished_at.gte.${since})`)
        .order("ends_at")
        .limit(60),
    ) as Row[];
    return sortContests(await this.hydrate(rows));
  }

  async contest(id: string) {
    const row = check(await this.db.from("contests").select(CONTEST_SELECT).eq("id", id).maybeSingle()) as Row | null;
    return row ? (await this.hydrate([row]))[0] : null;
  }

  async participants(id: string) {
    return (check(await this.db.rpc("contest_participants", { p_contest: id })) as Row[]).map(participantFromRow);
  }

  async create(d: ContestDraft) {
    const invalid = validateContest(d);
    if (invalid) throw new Error(invalid);
    const id = crypto.randomUUID();
    let photoPath: string | null = null;
    if (d.photo) {
      photoPath = `${this.uid}/contests/${id}/${Date.now()}.jpg`;
      await uploadJpeg(this.db, LISTING_BUCKET, photoPath, d.photo);
    }
    const row = check(
      moderated(
        this.db,
        "contests",
        `${d.title} ${d.prize} ${d.description}`,
        await this.db
          .from("contests")
          .insert({
            id,
            title: d.title.trim(),
            prize: d.prize.trim(),
            description: d.description.trim(),
            city: d.city.trim(),
            delivery: d.delivery,
            winners_count: d.winnersCount,
            ends_at: new Date(Date.now() + d.days * DAY_MS).toISOString(),
            photo_path: photoPath,
          })
          .select(CONTEST_SELECT)
          .single(),
      ),
    ) as Row;
    return (await this.hydrate([row]))[0];
  }

  async join(id: string) {
    check(await this.db.rpc("join_contest", { p_contest: id }));
  }

  async leave(id: string) {
    check(await this.db.rpc("leave_contest", { p_contest: id }));
  }

  async cancel(id: string) {
    check(await this.db.rpc("cancel_contest", { p_contest: id }));
  }

  async claim(id: string) {
    check(await this.db.rpc("claim_prize", { p_contest: id }));
  }

  async decline(id: string) {
    check(await this.db.rpc("decline_prize", { p_contest: id }));
  }

  async markDelivered(id: string, userId: string) {
    check(await this.db.rpc("mark_prize_delivered", { p_contest: id, p_user: userId }));
  }
}
