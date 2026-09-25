"use client";

import { BookOpen, CalendarCheck, Clapperboard, LogIn, Plus, Sprout, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AchievementWatcher } from "./achievement-watcher";
import { useSession } from "./session";
import { Avatar, Spinner, cx } from "./ui";

const NAV = [
  { href: "/today/", label: "Сегодня", icon: CalendarCheck },
  { href: "/garden/", label: "Коллекция", icon: Sprout },
  { href: "/feed/", label: "Лента", icon: Clapperboard },
  { href: "/plants/", label: "Знания", icon: BookOpen },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (pathname.startsWith(href) && !(href === "/garden/" && pathname.startsWith("/garden/new")));
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("flex items-center gap-2 text-[19px] font-bold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-leaf text-white">
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
      <Link href="/login/" className="flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-[15px] font-semibold text-white">
        <LogIn className="size-4" aria-hidden /> Войти
      </Link>
    );
  }
  const name = session.email ?? "Гость";
  return (
    <Link href="/profile/" aria-label="Профиль" className="rounded-full ring-offset-2 ring-offset-bg hover:ring-2 hover:ring-leaf">
      <Avatar name={name} />
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

  return (
    <div className="min-h-dvh md:flex">
      {session.status === "ready" && <AchievementWatcher />}
      {/* Боковое меню (≥ md) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-separator px-4 py-6 md:flex lg:w-64">
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
        </nav>
        <Link
          href="/garden/new/"
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-leaf py-3 text-[15px] font-semibold text-white hover:brightness-110"
        >
          <Plus className="size-5" aria-hidden /> Добавить растение
        </Link>
        <div className="mt-auto flex items-center gap-3 px-2">
          <ProfileButton />
          {session.status === "ready" && (
            <Link href="/profile/" className="min-w-0 text-[15px]">
              <span className="block truncate font-medium">{isDemo ? "Демо-режим" : session.email}</span>
              <span className="block text-[13px] text-secondary">Профиль</span>
            </Link>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Верхняя панель на телефоне */}
        <header className="glass sticky top-0 z-30 flex items-center justify-between border-b border-separator px-4 py-2.5 md:hidden">
          <Logo />
          <ProfileButton />
        </header>
        {isDemo && (
          <div className="bg-leaf/10 px-4 py-2 text-center text-[13px] text-leaf">
            Демо-режим: данные хранятся только в этом браузере.{" "}
            <Link href="/login/" className="font-semibold underline">
              Зарегистрироваться
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 sm:px-6 md:pb-12">{children}</main>
      </div>

      {/* Нижняя навигация на телефоне */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-separator pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Разделы">
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
                  className="grid size-12 place-items-center rounded-2xl bg-leaf text-white shadow-md active:scale-95"
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

