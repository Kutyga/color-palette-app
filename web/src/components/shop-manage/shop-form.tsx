"use client";

/**
 * Анкета магазина: создание заявки и правка реквизитов.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useBackend } from "@/components/session";
import { Button, Field, cx, inputClass, useToast } from "@/components/ui";
import { INN_REQUIRED, emptyShopDraft, shopToDraft, validateShop, type Shop, type ShopDraft } from "@/lib/domain/shop";
import { useProfile } from "@/lib/queries";

export function ShopForm({ shop, onDone }: { shop: Shop | null; onDone?: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const profile = useProfile();
  const [draft, setDraft] = useState<ShopDraft>(() => (shop ? shopToDraft(shop) : emptyShopDraft(profile.data?.city ?? "")));
  const [error, setError] = useState<{ field: keyof ShopDraft; message: string } | null>(null);
  const set = (patch: Partial<ShopDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };
  const save = useMutation({
    mutationFn: () => backend.shops.saveShop(draft),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      if (!shop) toast("Заявка отправлена — проверим и сообщим");
      else if (shop.status === "verified" && saved.status === "pending") toast("Название или ИНН изменились — магазин снова на проверке");
      else toast("Сохранено");
      onDone?.();
    },
    onError: (e) => toast(`Не сохранилось: ${e.message}`),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateShop(draft);
    if (invalid) return setError(invalid);
    save.mutate();
  }
  const err = (f: keyof ShopDraft) =>
    error?.field === f ? <span className="text-alert mt-1 block text-[13px]">{error.message}</span> : null;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Название магазина">
        <input
          className={inputClass}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          maxLength={80}
          autoComplete="organization"
        />
        {err("name")}
      </Field>
      <Field
        label={INN_REQUIRED ? "ИНН" : "ИНН (необязательно)"}
        hint={
          INN_REQUIRED
            ? "Для проверки: сверяем с ЕГРЮЛ/ЕГРИП. Показывается на витрине."
            : "Если укажете — покажем на витрине и ускорим проверку."
        }
      >
        <input
          className={inputClass}
          value={draft.inn}
          onChange={(e) => set({ inn: e.target.value.replace(/\D/g, "") })}
          inputMode="numeric"
          maxLength={12}
        />
        {err("inn")}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Город">
          <input className={inputClass} value={draft.city} onChange={(e) => set({ city: e.target.value })} maxLength={60} />
          {err("city")}
        </Field>
        <Field label="Адрес (если есть точка)">
          <input className={inputClass} value={draft.address} onChange={(e) => set({ address: e.target.value })} maxLength={200} />
          {err("address")}
        </Field>
        <Field label="Телефон">
          <input
            className={inputClass}
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
            inputMode="tel"
            maxLength={30}
            autoComplete="tel"
          />
          {err("phone")}
        </Field>
        <Field label="Сайт">
          <input
            className={inputClass}
            value={draft.website}
            onChange={(e) => set({ website: e.target.value })}
            inputMode="url"
            placeholder="example.ru"
            maxLength={300}
          />
          {err("website")}
        </Field>
      </div>
      <Field label="Часы работы">
        <input
          className={inputClass}
          value={draft.hours}
          onChange={(e) => set({ hours: e.target.value })}
          placeholder="Ежедневно 10:00–21:00"
          maxLength={100}
        />
        {err("hours")}
      </Field>
      <Field label="О магазине">
        <textarea
          className={cx(inputClass, "min-h-24")}
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={1000}
        />
        {err("description")}
      </Field>
      <label className="bg-muted flex items-center justify-between gap-3 rounded-xl px-4 py-3">
        <span className="text-[15px] font-medium">Есть доставка в другие города</span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--leaf)]"
          checked={draft.delivery}
          onChange={(e) => set({ delivery: e.target.checked })}
        />
      </label>
      <div className="flex gap-2">
        {onDone && shop && (
          <Button type="button" variant="secondary" className="flex-1" onClick={onDone}>
            Отмена
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={save.isPending}>
          {shop ? "Сохранить" : "Отправить на проверку"}
        </Button>
      </div>
    </form>
  );
}
