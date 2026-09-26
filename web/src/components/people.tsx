"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Leaf, Pencil, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { normalizeUsername, validateProfile, type PersonCard, type ProfileUpdate, type PublicPlant } from "@/lib/domain/people";
import { speciesName } from "@/lib/domain/species";
import { plural } from "@/lib/format";
import { speciesBySlug } from "@/lib/knowledge";
import { useFollow, usePeopleList } from "@/lib/queries";
import { useBackend } from "./session";
import { Avatar, Button, EmptyState, ErrorNote, Field, PlantPhoto, Sheet, Spinner, cx, inputClass, useToast } from "./ui";

export const personHref = (username: string) => `/people/view/?u=${encodeURIComponent(username)}`;

/** Подписаться / отписаться. Показывает результат сразу, откатывает при ошибке. */
export function FollowButton({ person, size = "md" }: { person: PersonCard; size?: "sm" | "md" }) {
  const follow = useFollow();
  const toast = useToast();
  const [following, setFollowing] = useState(person.isFollowing);
  if (person.isMe) return null;
  const toggle = () => {
    const next = !following;
    setFollowing(next);
    follow.mutate(
      { userId: person.id, follow: next },
      {
        onSuccess: () => toast(next ? `Вы подписались на ${person.displayName}` : `Вы отписались от ${person.displayName}`),
        onError: (e) => {
          setFollowing(!next);
          toast(`Не удалось: ${e.message}`);
        },
      },
    );
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={following}
      aria-label={following ? `Отписаться от ${person.displayName}` : `Подписаться на ${person.displayName}`}
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold transition",
        size === "sm" ? "px-3.5 py-1.5 text-[13px]" : "px-5 py-2.5 text-[15px]",
        following ? "bg-muted text-label" : "bg-leaf text-white",
      )}
    >
      {following ? <Check className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
      {following ? "Вы подписаны" : person.followsMe ? "Подписаться в ответ" : "Подписаться"}
    </button>
  );
}

/** Строка садовода в поиске и списках подписчиков. */
export function PersonRow({ person, onOpen }: { person: PersonCard; onOpen?: () => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <Link href={personHref(person.username)} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.displayName} size={48} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {person.displayName}
            {person.isMe && <span className="ml-1.5 font-normal text-secondary">· вы</span>}
          </span>
          <span className="block truncate text-[13px] text-secondary">
            @{person.username} · {person.plants} {plural(person.plants, "растение", "растения", "растений")}
            {person.followsMe && !person.isMe ? " · подписан(а) на вас" : ""}
          </span>
        </span>
      </Link>
      <FollowButton person={person} size="sm" />
    </li>
  );
}

/** Список подписчиков или подписок в шторке. */
export function PeopleListSheet({
  kind,
  person,
  onClose,
}: {
  kind: "followers" | "following" | null;
  person: PersonCard;
  onClose: () => void;
}) {
  const list = usePeopleList(kind ?? "followers", kind ? person.id : null);
  const title = kind === "following" ? "Подписки" : "Подписчики";
  return (
    <Sheet open={kind !== null} onClose={onClose} title={title}>
      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorNote error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title={kind === "following" ? "Пока ни на кого не подписаны" : "Пока нет подписчиков"}
          message={person.isMe ? "Найдите садоводов в поиске и подпишитесь — их растения появятся в ленте." : ""}
        />
      ) : (
        <ul className="divide-y divide-separator">
          {list.data.map((p) => (
            <PersonRow key={p.id} person={p} onOpen={onClose} />
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** Шапка профиля: аватар, имя, счётчики (подписчики и подписки открывают списки). */
export function ProfileHeader({ person, action }: { person: PersonCard; action?: React.ReactNode }) {
  const [list, setList] = useState<"followers" | "following" | null>(null);
  const stat = (value: number, label: string, onClick?: () => void) => {
    const body = (
      <>
        <span className="block text-[20px] font-bold tabular-nums">{value.toLocaleString("ru-RU")}</span>
        <span className="block text-[13px] text-secondary">{label}</span>
      </>
    );
    return onClick ? (
      <button type="button" onClick={onClick} className="flex-1 rounded-2xl py-2 hover:bg-muted">
        {body}
      </button>
    ) : (
      <div className="flex-1 py-2">{body}</div>
    );
  };
  return (
    <section className="rounded-[20px] bg-surface p-5">
      <div className="flex items-center gap-4">
        <Avatar name={person.displayName} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[24px] leading-tight font-bold">{person.displayName}</h1>
          <p className="truncate text-secondary">@{person.username}</p>
        </div>
      </div>
      {person.bio && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line">{person.bio}</p>}
      <div className="mt-4 flex text-center">
        {stat(person.plants, plural(person.plants, "растение", "растения", "растений"))}
        {stat(person.followers, plural(person.followers, "подписчик", "подписчика", "подписчиков"), () => setList("followers"))}
        {stat(person.following, plural(person.following, "подписка", "подписки", "подписок"), () => setList("following"))}
      </div>
      {action && <div className="mt-4 flex flex-wrap gap-2">{action}</div>}
      <PeopleListSheet kind={list} person={person} onClose={() => setList(null)} />
    </section>
  );
}

/** Сетка растений садовода; вид ведёт в базу знаний. */
export function PublicPlantsGrid({ plants }: { plants: PublicPlant[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {plants.map((p) => {
        const sp = speciesBySlug(p.speciesSlug);
        return (
          <li key={p.id} className="overflow-hidden rounded-[20px] bg-surface">
            <PlantPhoto src={p.photoUrl ?? sp?.image?.url} seed={p.id} alt={p.nickname} className="aspect-square w-full" iconSize={36} />
            <div className="p-3">
              <p className="truncate font-semibold">{p.nickname}</p>
              {sp ? (
                <Link href={`/plants/${sp.slug}/`} className="flex items-center gap-1 truncate text-[13px] text-secondary hover:text-leaf">
                  <Leaf className="size-3.5 shrink-0" aria-hidden /> {speciesName(sp)}
                </Link>
              ) : (
                <p className="text-[13px] text-secondary">Вид не указан</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Редактирование своего профиля: имя, @username, «О себе». */
export function EditProfileSheet({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: ProfileUpdate;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Редактировать профиль">
      {open && <EditProfileForm initial={initial} onDone={onClose} />}
    </Sheet>
  );
}

function EditProfileForm({ initial, onDone }: { initial: ProfileUpdate; onDone: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<{ field: keyof ProfileUpdate | null; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateProfile(form);
    if (invalid) return setError(invalid);
    setSaving(true);
    try {
      await backend.people.updateProfile(form);
      await Promise.all([qc.invalidateQueries({ queryKey: ["profile"] }), qc.invalidateQueries({ queryKey: ["people"] })]);
      toast("Профиль сохранён");
      onDone();
    } catch (err) {
      setError({ field: /username|занято/i.test(String(err)) ? "username" : null, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (f: keyof ProfileUpdate) =>
    error?.field === f ? <span className="mt-1 block text-[13px] text-alert">{error.message}</span> : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Имя">
        <input
          className={inputClass}
          value={form.displayName}
          maxLength={40}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="Как вас называть"
          autoComplete="name"
        />
        {fieldError("displayName")}
      </Field>
      <Field label="Имя пользователя" hint="По нему вас найдут в поиске. Латинские буквы, цифры и _.">
        <div className="flex items-center rounded-xl bg-muted focus-within:ring-2 focus-within:ring-leaf">
          <span className="pl-4 text-[17px] text-secondary">@</span>
          <input
            className="w-full bg-transparent px-1 py-3 text-[17px] outline-none"
            value={form.username}
            maxLength={30}
            onChange={(e) => setForm({ ...form, username: normalizeUsername(e.target.value) })}
            aria-label="Имя пользователя"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {fieldError("username")}
      </Field>
      <Field label="О себе">
        <textarea
          className={cx(inputClass, "min-h-24 resize-y")}
          value={form.bio}
          maxLength={500}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Что растёт на вашем подоконнике?"
        />
        {fieldError("bio")}
      </Field>
      {error && error.field === null && <p className="text-[15px] text-alert">{error.message}</p>}
      <Button type="submit" className="w-full" loading={saving}>
        <Pencil className="size-4" aria-hidden /> Сохранить
      </Button>
    </form>
  );
}
