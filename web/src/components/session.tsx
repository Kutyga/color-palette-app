"use client";

/**
 * Сессия и данные: вход через Supabase, кэш запросов, контекст для компонентов.
 * Тестовый режим (данные в браузере, lib/data/demo) есть только в сборке без сервера — для
 * автотестов; на рабочем сайте его нет.
 */

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasBackend } from "@/lib/config";
import type { Backend } from "@/lib/data/repositories";
import { registerServiceWorker } from "@/lib/push";
import { supabase } from "@/lib/supabase";

// Бэкенды грузятся по требованию: тестовые данные не попадают в загрузку рабочего сайта.
async function loadDemoBackend(): Promise<Backend> {
  const { demoBackend, localDemoStorage } = await import("@/lib/data/demo");
  return demoBackend(localDemoStorage());
}

async function loadSupabaseBackend(userId: string): Promise<Backend> {
  const { supabaseBackend } = await import("@/lib/data/supabase");
  return supabaseBackend(supabase(), userId);
}

export type SessionState = { status: "loading" } | { status: "guest" } | { status: "ready"; backend: Backend; email: string | null };

interface SessionApi {
  session: SessionState;
  /** Тестовый режим без сервера — только в сборке без Supabase (автотесты). */
  startDemo(): Promise<void>;
  /** Выход из аккаунта или из тестового режима. */
  signOut(): Promise<void>;
  /** Вход по ссылке «сбросить пароль» из письма: сначала нужно задать новый пароль. */
  passwordRecovery: boolean;
  finishPasswordRecovery(): void;
}

const SessionContext = createContext<SessionApi | null>(null);
const DEMO_FLAG = "moi-sad-mode";
const DEMO_DATA = "moi-sad-demo";

function readDemoFlag() {
  try {
    return localStorage.getItem(DEMO_FLAG) === "demo";
  } catch {
    return false;
  }
}

function writeDemoFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(DEMO_FLAG, "demo");
    else localStorage.removeItem(DEMO_FLAG);
  } catch {
    // Хранилище недоступно (приватный режим) — тестовый режим проживёт до перезагрузки.
  }
}

/** Вышли из аккаунта — запомненные ссылки на фото (lib/data/supabase/shared.ts) больше не нужны. */
function forgetPhotoUrls() {
  try {
    localStorage.removeItem("photo-urls");
  } catch {
    // нечего стирать
  }
  if (typeof caches !== "undefined") void caches.delete("photos-v1").catch(() => {}); // фото, сохранённые public/sw.js
}

/** Демо-режим убран с сайта: стираем оставшиеся у посетителей флаг и данные в браузере. */
function forgetDemo() {
  try {
    localStorage.removeItem(DEMO_FLAG);
    localStorage.removeItem(DEMO_DATA);
  } catch {
    // Хранилище недоступно — стирать нечего.
  }
}

function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const apply = (next: SessionState) => {
      if (cancelled) return;
      queryClient.clear();
      setSession(next);
    };

    // Бэкенд подгружается асинхронно: применяем только результат последней смены входа.
    let generation = 0;
    const applyLater = (load: () => Promise<SessionState>) => {
      const mine = ++generation;
      void load().then((next) => mine === generation && apply(next));
    };
    const offline = () =>
      applyLater(async () => (readDemoFlag() ? { status: "ready", backend: await loadDemoBackend(), email: null } : { status: "guest" }));

    if (!hasBackend) {
      offline();
      return () => void (cancelled = true);
    }
    forgetDemo();
    registerServiceWorker();
    const db = supabase();
    let currentUser: string | null | undefined;
    // onAuthStateChange сразу сообщает текущую сессию (INITIAL_SESSION), затем входы и выходы.
    const { data } = db.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      const uid = s?.user.id ?? null;
      if (uid === currentUser) return; // обновление токена — пересоздавать ничего не нужно
      currentUser = uid;
      if (s) {
        const user = s.user;
        applyLater(async () => ({ status: "ready", backend: await loadSupabaseBackend(user.id), email: user.email ?? null }));
      } else {
        forgetPhotoUrls();
        applyLater(async () => ({ status: "guest" }));
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const startDemo = useCallback(async () => {
    if (hasBackend) return;
    writeDemoFlag(true);
    const backend = await loadDemoBackend();
    queryClient.clear();
    setSession({ status: "ready", backend, email: null });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    if (session.status === "ready" && session.backend.mode === "demo") {
      writeDemoFlag(false);
      queryClient.clear();
      setSession({ status: "guest" });
      return;
    }
    if (hasBackend) await supabase().auth.signOut();
  }, [session, queryClient]);

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);
  const api = useMemo(
    () => ({ session, startDemo, signOut, passwordRecovery, finishPasswordRecovery }),
    [session, startDemo, signOut, passwordRecovery, finishPasswordRecovery],
  );
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession вне SessionProvider");
  return ctx;
}

/** Backend текущего пользователя; вызывать только внутри RequireSession. */
export function useBackend(): Backend {
  const { session } = useSession();
  if (session.status !== "ready") throw new Error("Нет активной сессии");
  return session.backend;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
