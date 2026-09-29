"use client";

/**
 * Подсказка «Добавьте Подоконник на экран Домой»: один раз, при первом заходе с телефона или
 * планшета. Инструкции для iPhone (Safari → «Поделиться») и Android (Chrome → меню); на Android,
 * если браузер разрешает, — кнопка «Установить». Уже установленным (открытым с экрана Домой) не показывается.
 */

import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cx, Sheet } from "@/components/ui";

const SEEN_KEY = "podokonnik-install-hint";

type Platform = "ios" | "android";

/** Событие Chrome «можно установить» — его нет в стандартных типах. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS представляется Mac-ом, но с сенсорным экраном.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "android";
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true; // хранилище недоступно — лучше не показывать каждый раз
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // приватный режим — подсказка просто не запомнится
  }
}

export function InstallHint() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // своя кнопка «Установить» вместо полоски браузера
      setInstallEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const phone = window.matchMedia("(pointer: coarse)").matches;
    let timer: number | undefined;
    if (isInstalled()) markSeen();
    // Автотесты браузера подсказку не видят (кроме теста самой подсказки).
    else if (phone && !navigator.webdriver && !seen()) {
      // Сначала пусть откроется страница.
      timer = window.setTimeout(() => {
        setPlatform(detectPlatform());
        setOpen(true);
      }, 2500);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.clearTimeout(timer);
    };
  }, []);

  function close() {
    markSeen();
    setOpen(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    close();
  }

  return (
    <Sheet open={open} onClose={close} title="Подоконник на экране Домой">
      <p className="text-secondary text-[15px]">
        Добавьте сайт на экран телефона — он откроется как приложение: на весь экран, без адресной строки, и с напоминаниями о поливе.
      </p>

      <div className="bg-muted mt-4 grid grid-cols-2 gap-1 rounded-full p-1" role="tablist" aria-label="Телефон">
        {(
          [
            ["ios", "iPhone"],
            ["android", "Android"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={platform === id}
            className={cx("min-h-10 rounded-full text-[15px] font-semibold", platform === id ? "bg-surface shadow-sm" : "text-secondary")}
            onClick={() => setPlatform(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {platform === "ios" ? (
        <ol className="mt-4 space-y-3 text-[15px]">
          <Step n={1}>Откройте сайт в Safari.</Step>
          <Step n={2}>
            Нажмите «Поделиться» <Share className="text-leaf inline size-5 align-text-bottom" aria-label="значок Поделиться" /> — внизу
            экрана (на iPad — вверху).
          </Step>
          <Step n={3}>
            Пролистайте и выберите «На экран „Домой“» <SquarePlus className="text-leaf inline size-5 align-text-bottom" aria-hidden />.
          </Step>
          <Step n={4}>Нажмите «Добавить» — значок Подоконника появится среди приложений.</Step>
        </ol>
      ) : null}
      {platform === "ios" && (
        <p className="text-secondary mt-3 text-[13px]">
          Уведомления о поливе на iPhone приходят, только когда Подоконник открыт с экрана «Домой».
        </p>
      )}
      {platform === "android" && (
        <div className="mt-4 space-y-3 text-[15px]">
          {installEvent && (
            <Button className="w-full" onClick={install}>
              Установить приложение
            </Button>
          )}
          <ol className="space-y-3">
            <Step n={1}>Откройте сайт в Chrome.</Step>
            <Step n={2}>Нажмите меню ⋮ в правом верхнем углу.</Step>
            <Step n={3}>Выберите «Добавить на главный экран» или «Установить приложение».</Step>
            <Step n={4}>Подтвердите — значок Подоконника появится на главном экране.</Step>
          </ol>
        </div>
      )}

      <Button variant="secondary" className="mt-6 w-full" onClick={close}>
        Понятно
      </Button>
    </Sheet>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="bg-leaf/15 text-leaf grid size-7 shrink-0 place-items-center rounded-full text-[14px] font-bold">{n}</span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
