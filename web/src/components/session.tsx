"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasBackend } from "@/lib/config";
import { demoBackend, localDemoStorage } from "@/lib/data/demo-backend";
import { supabaseBackend } from "@/lib/data/supabase-backend";
import type { Backend } from "@/lib/data/types";
import { supabase } from "@/lib/supabase";

export type SessionState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "ready"; backend: Backend; email: string | null };

interface SessionApi {
  session: SessionState;
  startDemo(): Promise<void>;
  /** Выход из аккаунта или из демо-режима. */
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);
const DEMO_FLAG = "moi-sad-mode";

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
    // Хранилище недоступно (приватный режим) — демо проживёт до перезагрузки.
  }
}

function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const apply = (next: SessionState) => {
      if (cancelled) return;
      queryClient.clear();
      setSession(next);
    };

    const offline = async () =>
      readDemoFlag()
        ? apply({ status: "ready", backend: await demoBackend(localDemoStorage()), email: null })
        : apply({ status: "guest" });

    if (!hasBackend) {
      void offline();
      return () => void (cancelled = true);
    }
    const db = supabase();
    let currentUser: string | null | undefined;
    // onAuthStateChange сразу сообщает текущую сессию (INITIAL_SESSION), затем входы и выходы.
    const { data } = db.auth.onAuthStateChange((_event, s) => {
      const uid = s?.user.id ?? null;
      if (uid === currentUser) return; // обновление токена — пересоздавать ничего не нужно
      currentUser = uid;
      if (s) {
        writeDemoFlag(false); // вошли в настоящий аккаунт — демо больше не нужно
        apply({ status: "ready", backend: supabaseBackend(db, s.user.id), email: s.user.email ?? null });
      } else {
        void offline();
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const startDemo = useCallback(async () => {
    writeDemoFlag(true);
    const backend = await demoBackend(localDemoStorage());
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

  const api = useMemo(() => ({ session, startDemo, signOut }), [session, startDemo, signOut]);
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
