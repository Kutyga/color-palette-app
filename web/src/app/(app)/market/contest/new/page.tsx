"use client";

/** Новый розыгрыш: приз, фото приза с камеры, город и доставка, срок и число победителей. */

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { CameraField } from "@/components/camera";
import { contestHref } from "@/components/contests";
import { useBackend } from "@/components/session";
import { Button, Chip, Field, PageHeader, inputClass, useToast } from "@/components/ui";
import { CONTEST_DURATIONS, validateContest, type ContestDraft } from "@/lib/domain/contest";
import { plural } from "@/lib/format";
import { useProfile } from "@/lib/queries";

function NewContestForm() {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const profile = useProfile();
  const [draft, setDraft] = useState<ContestDraft>({
    title: "",
    prize: "",
    description: "",
    city: "",
    delivery: false,
    winnersCount: 1,
    days: 7,
    photo: null,
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ContestDraft>) => setDraft((d) => ({ ...d, ...patch }));

  // Пока человек не ввёл город сам, подставляем город из профиля.
  const [city, setCity] = useState<string | null>(null);
  const effectiveCity = city ?? profile.data?.city ?? "";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const final = { ...draft, city: effectiveCity };
    const invalid = validateContest(final);
    if (invalid) return toast(invalid);
    setSaving(true);
    try {
      const c = await backend.contests.create(final);
      qc.invalidateQueries({ queryKey: ["contests"] });
      toast("Розыгрыш начался 🎉");
      router.replace(contestHref(c.id));
    } catch (err) {
      toast(`Не удалось создать: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <p className="bg-muted text-secondary rounded-2xl px-4 py-3 text-[13px]">
        Участие бесплатное, шансы у всех равны. Победителей выберет сервер, когда время выйдет, — вы свяжетесь с ними в сообщениях.
        Одновременно можно проводить один розыгрыш.
      </p>
      <Field label="Фото приза (необязательно)" group>
        <CameraField
          allowFiles
          aspect="aspect-[4/3]"
          photoUrl={photoUrl}
          onCapture={(blob) => {
            if (photoUrl) URL.revokeObjectURL(photoUrl);
            setPhotoUrl(URL.createObjectURL(blob));
            set({ photo: blob });
          }}
        />
      </Field>
      <Field label="Название">
        <input
          className={inputClass}
          required
          maxLength={80}
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Розыгрыш черенка монстеры"
        />
      </Field>
      <Field label="Приз">
        <input
          className={inputClass}
          required
          maxLength={120}
          value={draft.prize}
          onChange={(e) => set({ prize: e.target.value })}
          placeholder="Укоренённый черенок в горшке 9 см"
        />
      </Field>
      <Field label="Условия и подробности">
        <textarea
          className={`${inputClass} min-h-24`}
          maxLength={1000}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Как передам приз, где встретимся…"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Город">
          <input className={inputClass} required maxLength={60} value={effectiveCity} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <label className="bg-muted mt-7 flex items-center justify-between gap-3 rounded-xl px-4">
          <span className="text-[15px]">🚚 Отправлю почтой</span>
          <input type="checkbox" className="size-5" checked={draft.delivery} onChange={(e) => set({ delivery: e.target.checked })} />
        </label>
      </div>
      <Field label="Сколько идёт розыгрыш" group>
        <div className="flex flex-wrap gap-2">
          {CONTEST_DURATIONS.map((d) => (
            <Chip key={d} active={draft.days === d} onClick={() => set({ days: d })}>
              {d} {plural(d, "день", "дня", "дней")}
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Победителей" group>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Chip key={n} active={draft.winnersCount === n} onClick={() => set({ winnersCount: n })}>
              {n}
            </Chip>
          ))}
        </div>
      </Field>
      <Button type="submit" className="min-h-12 w-full text-[17px]" loading={saving}>
        Начать розыгрыш
      </Button>
    </form>
  );
}

export default function NewContestPage() {
  return (
    <>
      <PageHeader title="Новый розыгрыш" />
      <RequireSession>
        <NewContestForm />
      </RequireSession>
    </>
  );
}
