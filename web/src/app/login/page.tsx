"use client";

/**
 * Вход и регистрация по email и паролю; новый аккаунт подтверждается по ссылке из письма.
 * Забытый пароль: письмо со ссылкой ведёт сюда же, и после входа по ней задаётся новый пароль.
 */

import { KeyRound, MailCheck } from "lucide-react";
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
  if (/rate limit|for security purposes/i.test(m)) return "Слишком много попыток, подождите минуту.";
  if (/different from the old password/i.test(m)) return "Новый пароль должен отличаться от старого.";
  if (/database error saving new user/i.test(m)) return "Это имя уже занято — выберите другое.";
  return m;
}

function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { session, startDemo, passwordRecovery, finishPasswordRecovery } = useSession();
  const next = params.get("next") ?? "/today/";
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const isLive = session.status === "ready" && session.backend.mode === "live";
  useEffect(() => {
    if (isLive && !passwordRecovery) router.replace(next);
  }, [isLive, passwordRecovery, next, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const auth = supabase().auth;
      if (mode === "forgot") {
        const { error } = await auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}${BASE_PATH}/login/`,
        });
        if (error) throw error;
        setResetSentTo(email.trim());
      } else if (mode === "signin") {
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

  if (passwordRecovery && isLive) {
    return (
      <NewPasswordForm
        onDone={() => {
          finishPasswordRecovery();
          router.replace(next);
        }}
      />
    );
  }

  if (resetSentTo) {
    return (
      <div className="text-center">
        <MailCheck className="text-leaf mx-auto size-12" aria-hidden />
        <h1 className="mt-4 text-[28px] font-bold">Проверьте почту</h1>
        <p className="text-secondary mt-2">
          Если на <b className="text-label">{resetSentTo}</b> есть аккаунт, туда пришло письмо со ссылкой. Откройте её — и задайте новый
          пароль. Письма нет несколько минут — загляните в «Спам».
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setResetSentTo(null);
            setMode("signin");
          }}
        >
          Вернуться ко входу
        </Button>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <MailCheck className="text-leaf mx-auto size-12" aria-hidden />
        <h1 className="mt-4 text-[28px] font-bold">Проверьте почту</h1>
        <p className="text-secondary mt-2">
          Мы отправили письмо на <b className="text-label">{sentTo}</b>. Откройте ссылку из письма — и вы сразу окажетесь в своём саду.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSentTo(null);
            setMode("signin");
          }}
        >
          Уже подтвердил — войти
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-center text-[28px] font-bold tracking-tight">
        {mode === "signin" ? "С возвращением" : mode === "signup" ? "Создать аккаунт" : "Восстановить пароль"}
      </h1>
      <p className="text-secondary mt-1 text-center">
        {mode === "signin"
          ? "Войдите, чтобы увидеть свой сад"
          : mode === "signup"
            ? "Растения синхронизируются между устройствами"
            : "Пришлём на почту ссылку для нового пароля"}
      </p>

      {hasBackend ? (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <Field label="Почта">
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {mode !== "forgot" && (
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
          )}
          {mode === "signin" && (
            <button
              type="button"
              className="text-secondary -mt-2 block text-[14px] underline"
              onClick={() => {
                setMode("forgot");
                setError(null);
              }}
            >
              Забыли пароль?
            </button>
          )}
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
            <p className="bg-alert/10 text-alert rounded-xl px-4 py-3 text-[15px]" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} className="w-full">
            {mode === "signin" ? "Войти" : mode === "signup" ? "Зарегистрироваться" : "Прислать ссылку"}
          </Button>
          <button
            type="button"
            className="text-leaf w-full py-2 text-[15px] font-medium"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Впервые здесь? Регистрация" : mode === "signup" ? "Уже есть аккаунт? Войти" : "Вспомнили? Войти"}
          </button>
        </form>
      ) : (
        <p className="bg-muted text-secondary mt-8 rounded-xl px-4 py-3 text-[15px]">
          Сервер не подключён в этой сборке — доступен демо-режим.
        </p>
      )}

      <div className="text-secondary mt-6 flex items-center gap-3 text-[13px]">
        <span className="bg-separator h-px flex-1" /> или <span className="bg-separator h-px flex-1" />
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

/** Новый пароль после входа по ссылке из письма «Восстановить пароль». */
function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== repeat) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase().auth.updateUser({ password });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <KeyRound className="text-leaf mx-auto size-12" aria-hidden />
      <h1 className="mt-4 text-center text-[28px] font-bold tracking-tight">Новый пароль</h1>
      <p className="text-secondary mt-1 text-center">Придумайте пароль — им вы будете входить дальше</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Новый пароль" hint="Минимум 6 символов">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Ещё раз">
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </Field>
        {error && (
          <p className="bg-alert/10 text-alert rounded-xl px-4 py-3 text-[15px]" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          Сохранить пароль
        </Button>
      </form>
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
        <p className="text-secondary mt-8 text-center text-[13px]">
          <Link href="/plants/" className="underline">
            Посмотреть базу знаний
          </Link>{" "}
          без входа
        </p>
      </div>
    </div>
  );
}
