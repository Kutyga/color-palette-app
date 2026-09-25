"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Logo } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Button, Field, inputClass } from "@/components/ui";
import { BASE_PATH, hasBackend } from "@/lib/config";
import { supabase } from "@/lib/supabase";

/** Понятные сообщения вместо английских ошибок Supabase Auth. */
function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(m)) return "Неверная почта или пароль.";
  if (/email not confirmed/i.test(m)) return "Почта ещё не подтверждена — откройте ссылку из письма.";
  if (/already registered/i.test(m)) return "Такой пользователь уже есть — войдите.";
  if (/password should be at least/i.test(m)) return "Пароль — минимум 6 символов.";
  if (/rate limit/i.test(m)) return "Слишком много попыток, подождите минуту.";
  if (/database error saving new user/i.test(m)) return "Это имя уже занято — выберите другое.";
  return m;
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { session, startDemo } = useSession();
  const next = params.get("next") ?? "/today/";
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const isLive = session.status === "ready" && session.backend.mode === "live";
  useEffect(() => {
    if (isLive) router.replace(next);
  }, [isLive, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = supabase().auth;
      if (mode === "signin") {
        const { error } = await auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: username ? { username: username.trim().toLowerCase() } : undefined,
            emailRedirectTo: `${window.location.origin}${BASE_PATH}/login/`,
          },
        });
        if (error) throw error;
        if (!data.session) setSentTo(email.trim());
      }
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto size-12 text-leaf" aria-hidden />
        <h1 className="mt-4 text-[28px] font-bold">Проверьте почту</h1>
        <p className="mt-2 text-secondary">
          Мы отправили письмо на <b className="text-label">{sentTo}</b>. Откройте ссылку из письма — и вы сразу окажетесь в своём
          саду.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => { setSentTo(null); setMode("signin"); }}>
          Уже подтвердил — войти
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-center text-[28px] font-bold tracking-tight">{mode === "signin" ? "С возвращением" : "Создать аккаунт"}</h1>
      <p className="mt-1 text-center text-secondary">
        {mode === "signin" ? "Войдите, чтобы увидеть свой сад" : "Растения синхронизируются между устройствами"}
      </p>

      {hasBackend ? (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Почта">
            <input className={inputClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Пароль" hint={mode === "signup" ? "Минимум 6 символов" : undefined}>
            <input
              className={inputClass}
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {mode === "signup" && (
            <Field label="Имя в ленте (необязательно)" hint="Латиница, цифры и _, от 3 до 30 символов">
              <input
                className={inputClass}
                pattern="[a-zA-Z0-9_]{3,30}"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="anna_green"
              />
            </Field>
          )}
          {error && (
            <p className="rounded-xl bg-alert/10 px-4 py-3 text-[15px] text-alert" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            {mode === "signin" ? "Войти" : "Зарегистрироваться"}
          </Button>
          <button
            type="button"
            className="w-full py-2 text-[15px] font-medium text-leaf"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          >
            {mode === "signin" ? "Впервые здесь? Регистрация" : "Уже есть аккаунт? Войти"}
          </button>
        </form>
      ) : (
        <p className="mt-8 rounded-xl bg-muted px-4 py-3 text-[15px] text-secondary">
          Сервер не подключён в этой сборке — доступен демо-режим.
        </p>
      )}

      <div className="mt-6 flex items-center gap-3 text-[13px] text-secondary">
        <span className="h-px flex-1 bg-separator" /> или <span className="h-px flex-1 bg-separator" />
      </div>
      <Button
        variant="secondary"
        className="mt-6 w-full"
        onClick={async () => {
          await startDemo();
          router.push("/today/");
        }}
      >
        Попробовать без регистрации
      </Button>
    </>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center">
          <Logo />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-8 text-center text-[13px] text-secondary">
          <Link href="/plants/" className="underline">
            Посмотреть базу знаний
          </Link>{" "}
          без входа
        </p>
      </div>
    </div>
  );
}
