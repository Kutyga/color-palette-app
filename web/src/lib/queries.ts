"use client";

/**
 * Хуки данных для экранов: запросы и изменения через TanStack Query поверх выбранного бэкенда.
 * Ключ запроса начинается с раздела («plants», «feed», «shops»…) — по нему изменения сбрасывают кэш.
 * Весь кэш сбрасывается при входе, выходе и смене демо-режима.
 */

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/components/session";
import type { CareType } from "./domain/care";
import type { GardenStats } from "./domain/gamification";
import type { ListingFilter } from "./domain/market";
import { PEOPLE_PAGE, type PeopleSort } from "./domain/people";
import type { DiaryScope, HelpFilter } from "./domain/social";
import { startOfDay } from "./time";

// ---------------------------------------------------------------------------
// Коллекция и уход
// ---------------------------------------------------------------------------

export function usePlants() {
  const b = useBackend();
  return useQuery({ queryKey: ["plants"], queryFn: () => b.garden.myPlants() });
}

export function usePlantDetails(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["plant", id], queryFn: () => b.garden.plantDetails(id!), enabled: !!id });
}

/** Задачи на неделю вперёд: экран «Сегодня» делит их на просроченные, сегодняшние и скорые. */
export function useTasks() {
  const b = useBackend();
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => {
      const d = new Date();
      return b.garden.dueTasks(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 8));
    },
  });
}

/** Что уже сделано сегодня — для колец прогресса. */
export function useDoneToday() {
  const b = useBackend();
  return useQuery({
    queryKey: ["done-today"],
    queryFn: () => b.garden.careEventsSince(startOfDay(new Date())),
  });
}

export function useLocations() {
  const b = useBackend();
  return useQuery({ queryKey: ["locations"], queryFn: () => b.garden.myLocations() });
}

/** Статистика сада плюс активность в ленте — для уровней и достижений. */
export function useStats() {
  const b = useBackend();
  return useQuery({
    queryKey: ["stats"],
    // 7 запросов разом — обновляем после своих действий (полив, пост, растение), а сами по себе — раз в 10 минут.
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<GardenStats> => {
      // Сад обязателен; остальное — дополнения: их сбой не должен ломать экран достижений.
      const soft = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
      const [stats, activity, market, wishlist, shop] = await Promise.all([
        b.garden.stats(),
        soft(b.social.myActivity(), { posts: 0, likesReceived: 0, answers: 0, bestAnswers: 0, followers: 0 }),
        soft(b.market.myStats(), { listings: 0, giveaways: 0, deals: 0 }),
        soft(b.wishlist.list(), []),
        soft(b.shops.myStats(), { hasShop: 0, shopVerified: 0, products: 0, shopSpecies: 0 }),
      ]);
      return { ...stats, ...activity, ...market, ...shop, wishlist: wishlist.length };
    },
  });
}

// ---------------------------------------------------------------------------
// Профиль и сообщество
// ---------------------------------------------------------------------------

export function useProfile() {
  const b = useBackend();
  return useQuery({ queryKey: ["profile"], queryFn: () => b.profile(), staleTime: Infinity });
}

export function useDiaries(scope: DiaryScope) {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", "diaries", scope], queryFn: () => b.social.diaries(scope) });
}

export function usePlantDiary(plantId: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", "plant", plantId], queryFn: () => b.social.plantDiary(plantId!), enabled: !!plantId });
}

export function useMyDiary() {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", "mine"], queryFn: () => b.social.myDiary() });
}

export function useQuestions(filter: HelpFilter) {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", "questions", filter], queryFn: () => b.social.questions(filter) });
}

export function usePost(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", "post", id], queryFn: () => b.social.post(id!), enabled: !!id });
}

export function useNews(onlyMine: boolean, langs: string[] = []) {
  const b = useBackend();
  return useQuery({ queryKey: ["news", onlyMine, langs], queryFn: () => b.social.news(onlyMine, langs) });
}

export function useReader(id: string | null) {
  const b = useBackend();
  return useQuery({
    queryKey: ["reader", id],
    queryFn: () => b.social.readArticle(id!),
    enabled: !!id,
    staleTime: Infinity,
    retry: false,
  });
}

export function useComments(postId: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["comments", postId], queryFn: () => b.social.comments(postId!), enabled: !!postId });
}

/** Отметка ухода. id создаётся заранее — повторная отправка не создаст дубль. */
export function useLogCare() {
  const b = useBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantId, type }: { plantId: string; type: CareType }) => b.garden.logCare(plantId, type, { id: crypto.randomUUID() }),
    onSuccess: (_d, { plantId }) => {
      for (const key of [["tasks"], ["done-today"], ["plants"], ["plant", plantId], ["stats"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

// ---------------------------------------------------------------------------
// Люди
// ---------------------------------------------------------------------------

/** Поиск садоводов порциями: fetchNextPage — «Показать ещё». */
export function usePeopleSearch(query: string, sort: PeopleSort = "popular") {
  const b = useBackend();
  return useInfiniteQuery({
    queryKey: ["people", "search", query.trim(), sort],
    queryFn: ({ pageParam }) => b.people.search(query, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length < PEOPLE_PAGE ? undefined : all.length * PEOPLE_PAGE),
    placeholderData: (prev) => prev,
  });
}

export function usePerson(username: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["people", "card", username], queryFn: () => b.people.byUsername(username!), enabled: !!username });
}

export function usePeopleList(kind: "followers" | "following", userId: string | null) {
  const b = useBackend();
  return useQuery({
    queryKey: ["people", kind, userId],
    queryFn: () => (kind === "followers" ? b.people.followers(userId!) : b.people.following(userId!)),
    enabled: !!userId,
  });
}

export function usePlantProfile(plantId: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["people", "plant", plantId], queryFn: () => b.people.plant(plantId!), enabled: !!plantId });
}

export function usePlantsOf(userId: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["people", "plants", userId], queryFn: () => b.people.plantsOf(userId!), enabled: !!userId });
}

/** Подписка на садовода: сбрасывает карточки людей и ленту. */
export function useFollow() {
  const b = useBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, follow }: { userId: string; follow: boolean }) => b.social.setFollowing(userId, follow),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Барахолка и сообщения
// ---------------------------------------------------------------------------

export function useListings(filter: ListingFilter) {
  const b = useBackend();
  return useQuery({ queryKey: ["market", "list", filter], queryFn: () => b.market.listings(filter) });
}

export function useMyListings() {
  const b = useBackend();
  return useQuery({ queryKey: ["market", "mine"], queryFn: () => b.market.myListings() });
}

export function useListing(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["market", "one", id], queryFn: () => b.market.listing(id!), enabled: !!id });
}

/** Список чатов; обновляется раз в 30 секунд — для значка непрочитанных. */
export function useConversations() {
  const b = useBackend();
  // Непрочитанные — раз в минуту (и только пока приложение открыто); в открытом чате сообщения приходят сразу.
  return useQuery({ queryKey: ["chat", "list"], queryFn: () => b.chat.conversations(), refetchInterval: 60_000, staleTime: 30_000 });
}

export function useMessages(conversationId: string | null) {
  const b = useBackend();
  return useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => b.chat.messages(conversationId!),
    enabled: !!conversationId,
  });
}

// ---------------------------------------------------------------------------
// Магазины и «Хочу»
// ---------------------------------------------------------------------------

export function useMyShop() {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "mine"], queryFn: () => b.shops.myShop() });
}

export function useShop(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "one", id], queryFn: () => b.shops.shop(id!), enabled: !!id });
}

export function useShops(city: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "list", city], queryFn: () => b.shops.shops(city) });
}

export function useShopProducts(shopId: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "products", shopId], queryFn: () => b.shops.products(shopId!), enabled: !!shopId });
}

export function useWhereToBuy(speciesId: string, city: string | null, enabled = true) {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "offers", speciesId, city], queryFn: () => b.shops.whereToBuy(speciesId, city), enabled });
}

export function useReviewQueue(enabled: boolean) {
  const b = useBackend();
  return useQuery({ queryKey: ["shops", "review"], queryFn: () => b.shops.reviewQueue(), enabled });
}

export function useWishlist() {
  const b = useBackend();
  return useQuery({ queryKey: ["wishlist"], queryFn: () => b.wishlist.list() });
}

/** «Хочу» / «Не хочу» — сразу меняет список на экране. */
export function useSetWished() {
  const b = useBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ speciesId, wanted }: { speciesId: string; wanted: boolean }) => b.wishlist.set(speciesId, wanted),
    onMutate: ({ speciesId, wanted }) => {
      const prev = qc.getQueryData<string[]>(["wishlist"]);
      qc.setQueryData<string[]>(["wishlist"], (l = []) =>
        wanted ? [speciesId, ...l.filter((x) => x !== speciesId)] : l.filter((x) => x !== speciesId),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => qc.setQueryData(["wishlist"], ctx?.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Конкурсы
// ---------------------------------------------------------------------------

export function useContests() {
  const b = useBackend();
  return useQuery({ queryKey: ["contests", "list"], queryFn: () => b.contests.contests() });
}

export function useContest(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["contests", "one", id], queryFn: () => b.contests.contest(id!), enabled: !!id });
}

export function useContestParticipants(id: string | null) {
  const b = useBackend();
  return useQuery({ queryKey: ["contests", "participants", id], queryFn: () => b.contests.participants(id!), enabled: !!id });
}
