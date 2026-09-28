// Проверка PHP API тем же клиентом, что у сайта (supabase-js), и теми же запросами, что в
// web/src/lib/data/supabase/*. Данные — из дымового теста базы (Алиса, Боб, Кэрол; пароль test-password).
// Запуск: spaceweb/api/test/run.sh
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../../web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const API = process.env.API_URL;
const ALICE = "00000000-0000-0000-0000-00000000000a";
const BOB = "00000000-0000-0000-0000-00000000000b";
const PLANT_SELECT =
  "*, species(slug, latin_name, common_names), locations(name, light_level), care_schedules(type, next_due_at), " +
  "cover:plant_photos!plants_cover_photo_fk(storage_path)";
const POST_SELECT = "*, author:profiles!posts_author_id_fkey(username, display_name), plant:plants(nickname)";
const CONTEST_SELECT =
  "*, organizer:profiles!contests_organizer_id_fkey(username, display_name), entries:contest_entries(count)";

const client = () => createClient(API, "podokonnik-public-key", { auth: { persistSession: false, autoRefreshToken: false } });

async function signedIn(email) {
  const db = client();
  const { data, error } = await db.auth.signInWithPassword({ email, password: "test-password" });
  assert.equal(error, null, `вход ${email}: ${error?.message}`);
  assert.ok(data.session.access_token);
  return db;
}

const ok = ({ data, error }) => {
  assert.equal(error, null, error?.message);
  return data;
};

test("аноним: справочник открыт, закрытое — нет", async () => {
  const db = client();
  const species = ok(await db.from("species").select("id, slug").limit(3));
  assert.equal(species.length, 3);
  const plants = ok(await db.from("plants").select("id, visibility").neq("visibility", "public"));
  assert.equal(plants.length, 0);
  const { error } = await db.from("plants").insert({ nickname: "аноним" });
  assert.ok(error, "аноним не может добавить растение");
});

test("вход: неверный пароль и пользователь", async () => {
  const db = client();
  const { error } = await db.auth.signInWithPassword({ email: "alice@example.com", password: "nope" });
  assert.match(error.message, /invalid login credentials/i);
  const a = await signedIn("alice@example.com");
  const { data } = await a.auth.getUser();
  assert.equal(data.user.id, ALICE);
});

test("растения Алисы с вложенными видом, местом, графиками и обложкой", async () => {
  const db = await signedIn("alice@example.com");
  const rows = ok(await db.from("plants").select(PLANT_SELECT).eq("owner_id", ALICE).is("deleted_at", null).order("created_at"));
  assert.ok(rows.length > 0);
  const p = rows.find((r) => r.species);
  assert.ok(p, "есть растение с видом");
  assert.equal(typeof p.species.slug, "string", "вид — объект (многие-к-одному)");
  assert.ok(Array.isArray(p.care_schedules), "графики — массив (один-ко-многим)");
  assert.ok("cover" in p, "обложка по подсказке внешнего ключа");

  const one = ok(await db.from("plants").select(PLANT_SELECT).eq("id", p.id).single());
  assert.equal(one.id, p.id, ".single() — объект");
  const { error } = await db.from("plants").select("id").eq("id", "00000000-0000-0000-0000-0000000000ee").single();
  assert.equal(error.code, "PGRST116");
  const none = ok(await db.from("plants").select("id").eq("id", "00000000-0000-0000-0000-0000000000ee").maybeSingle());
  assert.equal(none, null, ".maybeSingle() без строк — null");
});

test("один к одному: у вида карточка ухода — объект", async () => {
  const sp = ok(await client().from("species").select("id, care_profiles(*)").eq("slug", "monstera-deliciosa").maybeSingle());
  assert.equal(Array.isArray(sp.care_profiles), false);
  assert.equal(sp.care_profiles.species_id, sp.id);
});

test("фильтр по вложенной таблице (!inner) и подсчёт без строк", async () => {
  const db = await signedIn("alice@example.com");
  const events = ok(
    await db.from("care_events").select("*, plants!inner(owner_id)").eq("plants.owner_id", ALICE).gte("performed_at", "2000-01-01"),
  );
  assert.ok(events.every((e) => e.plants.owner_id === ALICE));
  const { count, error } = await db.from("plants").select("id", { count: "exact", head: true }).eq("owner_id", ALICE);
  assert.equal(error, null);
  assert.ok(count > 0, "count из Content-Range");
  const answers = ok(
    await db.from("comments").select("id, post:posts!comments_post_id_fkey!inner(kind, solved_comment_id)").eq("post.kind", "question"),
  );
  assert.ok(answers.every((a) => a.post.kind === "question"));
});

test("Боб не видит закрытое и не меняет чужое", async () => {
  const bob = await signedIn("bob@example.com");
  const privateOfAlice = ok(await bob.from("plants").select("id").eq("owner_id", ALICE).eq("visibility", "private"));
  assert.equal(privateOfAlice.length, 0);
  const changed = ok(await bob.from("plants").update({ nickname: "угнано" }).eq("owner_id", ALICE).select("id"));
  assert.equal(changed.length, 0, "RLS не даёт изменить чужие растения");
  const { error } = await bob.from("plants").insert({ owner_id: ALICE, nickname: "подкидыш" });
  assert.ok(error, "нельзя записать растение от имени Алисы");
});

test("запись: вставка, изменение, удаление, upsert и права на колонки", async () => {
  const db = await signedIn("alice@example.com");
  const loc = ok(await db.from("locations").insert({ id: crypto.randomUUID(), name: "Кухня", light_level: "bright_indirect" }).select().single());
  assert.equal(loc.name, "Кухня");
  const upd = ok(await db.from("locations").update({ name: "Кухня у окна" }).eq("id", loc.id).select().single());
  assert.equal(upd.name, "Кухня у окна");
  const del = ok(await db.from("locations").delete().eq("id", loc.id).select("id"));
  assert.equal(del.length, 1);

  const post = ok(await db.from("posts").select("id").limit(1))[0];
  ok(await db.from("likes").upsert({ user_id: ALICE, post_id: post.id }, { ignoreDuplicates: true }));
  ok(await db.from("likes").upsert({ user_id: ALICE, post_id: post.id }, { ignoreDuplicates: true }));

  ok(await db.from("profiles").update({ bio: "Люблю монстеры" }).eq("id", ALICE));
  const { error } = await db.from("profiles").update({ is_admin: true }).eq("id", ALICE);
  assert.ok(error, "is_admin менять нельзя — нет права на колонку");
});

test("функции: таблица, значение, записи с вложениями, ошибки по-русски", async () => {
  const bob = await signedIn("bob@example.com");
  const people = ok(await bob.rpc("search_people", { q: "alice", lim: 5 }));
  assert.ok(Array.isArray(people) && people.length >= 1);
  const stats = ok(await bob.rpc("my_garden_stats"));
  assert.equal(typeof stats, "object");
  const feed = ok(await bob.rpc("feed_diaries", { scope: "all", lim: 30 }).select(POST_SELECT));
  assert.ok(Array.isArray(feed));
  if (feed.length) assert.equal(typeof feed[0].author.username, "string", "вложение у результата функции");
  const contests = ok(
    await bob
      .from("contests")
      .select(CONTEST_SELECT)
      .or(`status.eq.active,and(status.eq.finished,finished_at.gte.2000-01-01T00:00:00.000Z)`)
      .order("ends_at"),
  );
  for (const c of contests) assert.equal(typeof c.entries[0].count, "number");
  const { error } = await bob.rpc("join_contest", { p_contest: "00000000-0000-0000-0000-0000000000ee" });
  assert.ok(error);
  assert.match(error.message, /[а-яё]/i, "сообщение из raise exception");
  const inList = ok(await bob.from("profile_cards").select("id").in("id", [ALICE, BOB]));
  assert.ok(inList.length >= 1);
});

test("продление и выход", async () => {
  const db = await signedIn("alice@example.com");
  const { data, error } = await db.auth.refreshSession();
  assert.equal(error, null, error?.message);
  assert.ok(data.session.refresh_token);
  ok(await db.from("plants").select("id").limit(1));
  assert.equal((await db.auth.signOut()).error, null);
});

test("регистрация с письмом и вход по ссылке", async () => {
  const db = client();
  const email = `new${Date.now()}@example.com`;
  const { data, error } = await db.auth.signUp({ email, password: "secret-1", options: { data: { username: "novichok" } } });
  assert.equal(error, null, error?.message);
  assert.equal(data.session, null, "до подтверждения сессии нет");
  const early = await db.auth.signInWithPassword({ email, password: "secret-1" });
  assert.match(early.error.message, /email not confirmed/i);

  const link = readFileSync(process.env.MAIL_LOG, "utf8").match(/https?:\/\/\S+verify\S+/g).at(-1);
  const res = await fetch(link, { redirect: "manual" });
  assert.equal(res.status, 303);
  const hash = new URLSearchParams(new URL(res.headers.get("location")).hash.slice(1));
  assert.ok(hash.get("access_token"), "токены во фрагменте ссылки");

  const me = await signedInWith(email, "secret-1");
  const { data: who } = await me.auth.getUser();
  const profile = ok(await me.from("profiles").select("username").eq("id", who.user.id).single());
  assert.match(profile.username, /^novichok_/, "профиль создан триггером регистрации");
  const again = await client().auth.signUp({ email, password: "secret-1" });
  assert.match(again.error.message, /already registered/i);
});

async function signedInWith(email, password) {
  const db = client();
  const { error } = await db.auth.signInWithPassword({ email, password });
  assert.equal(error, null, error?.message);
  return db;
}
