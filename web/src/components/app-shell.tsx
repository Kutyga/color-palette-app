"use client";

import { BookOpen, CalendarCheck, LogIn, MessageCircle, Plus, Sprout, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { AchievementWatcher } from "./achievement-watcher";
import { useSession } from "./session";
import { Avatar, Spinner, cx } from "./ui";
import { useConversations } from "@/lib/queries";

const NAV = [
  { href: "/today/", label: "Сегодня", icon: CalendarCheck },
  { href: "/garden/", label: "Коллекция", icon: Sprout },
  { href: "/feed/", label: "Сообщество", icon: UsersRound },
  { href: "/plants/", label: "Знания", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (pathname.startsWith(href) && !(href === "/garden/" && pathname.startsWith("/garden/new")));
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("flex items-center gap-2 text-[19px] font-bold tracking-tight", className)}>
      <span className="bg-leaf grid size-8 place-items-center rounded-[10px] text-white">
        <Sprout className="size-5" aria-hidden />
      </span>
      Подоконник
    </Link>
  );
}

function ProfileButton() {
  const { session } = useSession();
  if (session.status === "loading") return <span className="size-9" />;
  if (session.status === "guest") {
    return (
      <Link href="/login/" className="bg-leaf flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-semibold text-white">
        <LogIn className="size-4" aria-hidden /> Войти
      </Link>
    );
  }
  const name = session.email ?? "Гость";
  return (
    <Link href="/profile/" aria-label="Профиль" className="ring-offset-bg hover:ring-leaf rounded-full ring-offset-2 hover:ring-2">
      <Avatar name={name} />
    </Link>
  );
}

/** Сколько чатов с непрочитанными сообщениями. */
function UnreadBadge({ className }: { className?: string }) {
  const convs = useConversations();
  const n = convs.data?.filter((c) => c.unread).length ?? 0;
  if (!n) return null;
  return (
    <span
      className={cx("bg-alert grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white", className)}
      aria-label={`Непрочитанных чатов: ${n}`}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

/** Значок «Сообщения» в шапке — только для вошедших (и демо). */
function MessagesButton() {
  const { session } = useSession();
  if (session.status !== "ready") return null;
  return (
    <Link href="/messages/" aria-label="Сообщения" className="hover:bg-muted relative grid size-9 place-items-center rounded-full">
      <MessageCircle className="size-6" aria-hidden />
      <UnreadBadge className="absolute -top-1 -right-1" />
    </Link>
  );
}

/**
 * Каркас сайта: на компьютере — боковое меню, на телефоне — полупрозрачная нижняя панель
 * с кнопкой «+» по центру, как в Instagram.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const isDemo = session.status === "ready" && session.backend.mode === "demo";
  const scrollRef = useRef<HTMLDivElement>(null);

  // Прокрутка живёт в области контента, поэтому при переходе на другой экран возвращаем её наверх сами.
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // После закрытия клавиатуры iOS может оставить окно сдвинутым — возвращаем его на место.
  useEffect(() => {
    const reset = () =>
      setTimeout(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && window.scrollY) window.scrollTo(0, 0);
      }, 100);
    document.addEventListener("focusout", reset);
    return () => document.removeEventListener("focusout", reset);
  }, []);

  return (
    // Каркас на всю высоту экрана: прокручивается только область контента, а нижнее меню — обычный
    // элемент под ней, а не position: fixed. На iOS фиксированная панель при прокрутке и после
    // клавиатуры иногда «отъезжала» от низа экрана.
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      {session.status === "ready" && <AchievementWatcher />}
      {/* Боковое меню (≥ md) */}
      <aside className="border-separator hidden h-dvh w-60 shrink-0 flex-col border-r px-4 py-6 md:flex lg:w-64">
        <Logo className="px-2" />
        <nav className="mt-8 flex flex-col gap-1" aria-label="Разделы">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] transition",
                isActive(pathname, href) ? "bg-muted font-semibold" : "text-secondary hover:bg-muted hover:text-label",
              )}
            >
              <Icon className="size-5" aria-hidden /> {label}
            </Link>
          ))}
          <Link
            href="/achievements/"
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] transition",
              isActive(pathname, "/achievements/") ? "bg-muted font-semibold" : "text-secondary hover:bg-muted hover:text-label",
            )}
          >
            <Trophy className="size-5" aria-hidden /> Достижения
          </Link>
          {session.status === "ready" && (
            <Link
              href="/messages/"
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[17px] transition",
                isActive(pathname, "/messages/") ? "bg-muted font-semibold" : "text-secondary hover:bg-muted hover:text-label",
              )}
            >
              <MessageCircle className="size-5" aria-hidden /> Сообщения
              <UnreadBadge className="ml-auto" />
            </Link>
          )}
        </nav>
        <Link
          href="/garden/new/"
          className="bg-leaf mt-6 flex items-center justify-center gap-2 rounded-full py-3 text-[15px] font-semibold text-white hover:brightness-110"
        >
          <Plus className="size-5" aria-hidden /> Добавить растение
        </Link>
        <div className="mt-auto flex items-center gap-3 px-2">
          <ProfileButton />
          {session.status === "ready" && (
            <Link href="/profile/" className="min-w-0 text-[15px]">
              <span className="block truncate font-medium">{isDemo ? "Демо-режим" : session.email}</span>
              <span className="text-secondary block text-[13px]">Профиль</span>
            </Link>
          )}
        </div>
      </aside>

      <div ref={scrollRef} data-app-scroll className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">
        {/* Верхняя панель на телефоне */}
        <header className="glass border-separator sticky top-0 z-30 flex items-center justify-between border-b px-4 py-2.5 md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <MessagesButton />
            <ProfileButton />
          </div>
        </header>
        {isDemo && (
          <div className="bg-leaf/10 text-leaf px-4 py-2 text-center text-[13px]">
            Демо-режим: данные хранятся только в этом браузере.{" "}
            <Link href="/login/" className="font-semibold underline">
              Зарегистрироваться
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6 md:pb-12">{children}</main>
      </div>

      {/* Нижняя навигация на телефоне */}
      <nav className="glass border-separator z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Разделы">
        <ul className="grid grid-cols-5 items-center">
          {[...NAV.slice(0, 2), null, ...NAV.slice(2)].map((item) =>
            item ? (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cx(
                    "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                    isActive(pathname, item.href) ? "text-leaf" : "text-secondary",
                  )}
                >
                  <item.icon className="size-6" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ) : (
              <li key="add" className="flex justify-center">
                <Link
                  href="/garden/new/"
                  aria-label="Добавить растение"
                  className="bg-leaf grid size-12 place-items-center rounded-2xl text-white shadow-md active:scale-95"
                >
                  <Plus className="size-7" aria-hidden />
                </Link>
              </li>
            ),
          )}
        </ul>
      </nav>
    </div>
  );
}

/** Страницы только для вошедших (или демо): гостя отправляем на вход. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (session.status === "guest") router.replace(`/login/?next=${encodeURIComponent(pathname)}`);
  }, [session.status, router, pathname]);
  if (session.status !== "ready") return <Spinner />;
  return <>{children}</>;
}
