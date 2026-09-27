"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Share } from "lucide-react";
import { useEffect, useState } from "react";
import { useBackend } from "./session";
import { Button, Card, Spinner, cx, inputClass, useIsClient, useToast } from "./ui";
import type { NotificationSettings } from "@/lib/data/types";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push";

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-3">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        <span className="block text-[13px] text-secondary">{hint}</span>
      </span>
      <input type="checkbox" className="size-5 shrink-0 accent-[var(--leaf)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Preferences() {
  const backend = useBackend();
  const repo = backend.notifications!;
  const qc = useQueryClient();
  const toast = useToast();
  const settings = useQuery({ queryKey: ["notify-settings"], queryFn: () => repo.settings() });
  async function save(patch: Partial<NotificationSettings>) {
    qc.setQueryData<NotificationSettings>(["notify-settings"], (s) => (s ? { ...s, ...patch } : s));
    try {
      await repo.updateSettings(patch);
    } catch (e) {
      toast(`Не сохранилось: ${e instanceof Error ? e.message : e}`);
      qc.invalidateQueries({ queryKey: ["notify-settings"] });
    }
  }
  if (!settings.data) return <Spinner />;
  const s = settings.data;
  return (
    <div className="mt-3 divide-y divide-separator">
      <div>
        <Toggle label="Напоминания об уходе" hint="Раз в день, если есть что полить или подкормить" checked={s.care} onChange={(v) => save({ care: v })} />
        {s.care && (
          <label className="flex items-center justify-between gap-3 pb-3 text-[15px]">
            <span className="text-secondary">Во сколько</span>
            <input
              type="time"
              className={cx(inputClass, "w-32 py-2 text-center")}
              value={s.reminderTime}
              onChange={(e) => e.target.value && save({ reminderTime: e.target.value })}
              aria-label="Время напоминания"
            />
          </label>
        )}
      </div>
      <Toggle label="Сообщения" hint="Новые сообщения в чатах барахолки" checked={s.messages} onChange={(v) => save({ messages: v })} />
      <Toggle label="Сообщество" hint="Ответы на ваши вопросы и комментарии к записям" checked={s.community} onChange={(v) => save({ community: v })} />
    </div>
  );
}

/** Карточка «Уведомления» в профиле. */
export function NotificationsCard() {
  const backend = useBackend();
  const toast = useToast();
  const isClient = useIsClient();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const repo = backend.notifications;

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    currentSubscription()
      .then((sub) => alive && setSubscribed(!!sub))
      .catch(() => alive && setSubscribed(false));
    return () => {
      alive = false;
    };
  }, [repo]);

  if (!isClient) return null;
  const support = pushSupport();

  async function toggle() {
    if (!repo) return;
    setBusy(true);
    try {
      if (subscribed) {
        await disablePush(repo);
        setSubscribed(false);
        toast("Уведомления на этом устройстве выключены");
      } else {
        await enablePush(repo);
        setSubscribed(true);
        toast("Уведомления включены");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <Bell className="size-6 text-leaf" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">Уведомления</p>
          <p className="text-[13px] text-secondary">О поливе, сообщениях и ответах — даже когда сайт закрыт</p>
        </div>
      </div>
      {!repo ? (
        <p className="mt-3 text-[15px] text-secondary">Уведомления работают после регистрации.</p>
      ) : support === "ios-needs-install" ? (
        <div className="mt-3 rounded-2xl bg-muted px-4 py-3 text-[15px]">
          <p className="font-medium">На iPhone уведомления приходят только от сайта на экране «Домой»:</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-secondary">
            <li>
              Откройте сайт в Safari и нажмите <Share className="inline size-4 align-text-bottom" aria-label="«Поделиться»" />
            </li>
            <li>Выберите «На экран „Домой“»</li>
            <li>Откройте «Подоконник» с экрана «Домой» и включите уведомления здесь</li>
          </ol>
        </div>
      ) : support === "unsupported" ? (
        <p className="mt-3 text-[15px] text-secondary">Этот браузер не поддерживает уведомления. Попробуйте Chrome, Safari или Firefox.</p>
      ) : subscribed === null ? (
        <Spinner />
      ) : (
        <>
          <Button variant={subscribed ? "secondary" : "primary"} className="mt-4 w-full" loading={busy} onClick={toggle}>
            {subscribed ? (
              <>
                <BellOff className="size-4" aria-hidden /> Выключить на этом устройстве
              </>
            ) : (
              <>
                <Bell className="size-4" aria-hidden /> Включить уведомления
              </>
            )}
          </Button>
          <Preferences />
        </>
      )}
    </Card>
  );
}
