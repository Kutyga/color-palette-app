/**
 * Садоводы: карточки профилей, поиск, подписчики. На сервере — представление profile_cards
 * и RPC search_people / people_followers / people_following
 * (supabase/migrations/*_people.sql), в демо-режиме — локальный список.
 */
export interface PersonCard {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  followers: number;
  following: number;
  /** Растения, которые видит текущий пользователь (свои, публичные и «для подписчиков»). */
  plants: number;
  isFollowing: boolean;
  followsMe: boolean;
  isMe: boolean;
}

/** Растение в чужой коллекции — только то, что можно показать гостю профиля. */
export interface PublicPlant {
  id: string;
  nickname: string;
  speciesSlug: string | null;
  photoUrl: string | null;
}

export interface ProfileUpdate {
  displayName: string;
  username: string;
  bio: string;
}

type Row = Record<string, unknown>;

/** Технический суффикс «_1a2b3c4d», который добавляет регистрация, в имени не показываем. */
export const prettyUsername = (username: string) => username.replace(/_[0-9a-f]{8}$/, "");

export function personFromRow(r: Row): PersonCard {
  const username = r.username as string;
  const name = ((r.display_name as string | null) ?? "").trim();
  return {
    id: r.id as string,
    username,
    displayName: name || prettyUsername(username),
    bio: (r.bio as string | null) || null,
    followers: Number(r.followers ?? 0),
    following: Number(r.following ?? 0),
    plants: Number(r.plants ?? 0),
    isFollowing: Boolean(r.is_following),
    followsMe: Boolean(r.follows_me),
    isMe: Boolean(r.is_me),
  };
}

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

/** Проверка формы профиля; null — всё в порядке, иначе текст ошибки для поля. */
export function validateProfile(p: ProfileUpdate): { field: keyof ProfileUpdate; message: string } | null {
  const name = p.displayName.trim();
  if (!name) return { field: "displayName", message: "Введите имя" };
  if (name.length > 40) return { field: "displayName", message: "Имя — до 40 символов" };
  if (!USERNAME_RE.test(p.username))
    return { field: "username", message: "3–30 символов: латинские строчные буквы, цифры и _" };
  if (p.bio.length > 500) return { field: "bio", message: "О себе — до 500 символов" };
  return null;
}

/** Нормализует ввод username: без @, строчные, пробелы и точки → «_». */
export const normalizeUsername = (raw: string) =>
  raw.trim().replace(/^@+/, "").toLowerCase().replace(/[\s.\-]+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_");
