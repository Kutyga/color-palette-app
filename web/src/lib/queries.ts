"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBackend } from "@/components/session";
import type { CareType } from "./domain/care";
import type { FeedTab } from "./domain/social";

/** Все запросы данных сайта. Кэш сбрасывается при входе, выходе и смене демо-режима. */

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

export function useDoneToday() {
  const b = useBackend();
  return useQuery({
    queryKey: ["done-today"],
    queryFn: () => {
      const d = new Date();
      return b.garden.careEventsSince(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    },
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
    queryFn: async () => {
      const [stats, activity] = await Promise.all([b.garden.stats(), b.social.myActivity()]);
      return { ...stats, ...activity };
    },
  });
}

export function useProfile() {
  const b = useBackend();
  return useQuery({ queryKey: ["profile"], queryFn: () => b.profile(), staleTime: Infinity });
}

export function useFeed(tab: FeedTab) {
  const b = useBackend();
  return useQuery({ queryKey: ["feed", tab], queryFn: () => b.social.feed(tab) });
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
    mutationFn: ({ plantId, type }: { plantId: string; type: CareType }) =>
      b.garden.logCare(plantId, type, { id: crypto.randomUUID() }),
    onSuccess: (_d, { plantId }) => {
      for (const key of [["tasks"], ["done-today"], ["plants"], ["plant", plantId], ["stats"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

// ---------------------------------------------------------------------------
// Люди
// ---------------------------------------------------------------------------

export function usePeopleSearch(query: string) {
  const b = useBackend();
  return useQuery({ queryKey: ["people", "search", query.trim()], queryFn: () => b.people.search(query), placeholderData: (prev) => prev });
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
