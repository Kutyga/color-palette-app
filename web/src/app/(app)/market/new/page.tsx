"use client";

/** Новое объявление барахолки: продать, отдать или обменять растение. */

import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { CameraField } from "@/components/camera";
import { listingHref } from "@/components/market";
import { useBackend } from "@/components/session";
import { Button, Chip, Field, PageHeader, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { CATALOG, catalogById, catalogBySlug } from "@/lib/catalog";
import { LISTING_KINDS, validateListing, type Listing, type ListingDraft, type ListingKind } from "@/lib/domain/market";
import { searchLocal, speciesName } from "@/lib/domain/species";
import { useListing, usePlants, useProfile } from "@/lib/queries";

/** Выбор вида из базы знаний: поле поиска с подсказками. */
function SpeciesPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [query, setQuery] = useState("");
  const selected = catalogById(value);
  if (selected) {
    return (
      <div className="bg-muted flex items-center gap-2 rounded-xl px-4 py-3">
        <span className="flex-1 text-[17px]">{speciesName(selected)}</span>
        <button type="button" onClick={() => onChange(null)} aria-label="Убрать вид" className="text-secondary">
          <X className="size-5" />
        </button>
      </div>
    );
  }
  const hits = query.trim().length >= 2 ? searchLocal(CATALOG, query).slice(0, 6) : [];
  return (
    <div>
      <input
        className={inputClass}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Монстера, хойя…"
        aria-label="Вид растения"
      />
      {hits.length > 0 && (
        <ul className="bg-muted mt-2 overflow-hidden rounded-xl">
          {hits.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onChange(s.id)} className="hover:bg-surface w-full px-4 py-2.5 text-left text-[15px]">
                {speciesName(s)} <span className="text-secondary italic">{s.latinName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ListingForm({ existing, defaults }: { existing: Listing | null; defaults: Pick<ListingDraft, "city" | "speciesId" | "title"> }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<Omit<ListingDraft, "photo">>(() => ({
    kind: existing?.kind ?? "sell",
    title: existing?.title ?? defaults.title,
    description: existing?.description ?? "",
    speciesId: existing?.speciesId ?? defaults.speciesId,
    priceRub: existing?.priceRub ?? null,
    swapFor: existing?.swapFor ?? "",
    city: existing?.city ?? defaults.city,
    delivery: existing?.delivery ?? false,
  }));
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<{ field: keyof ListingDraft | null; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ListingDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => () => void (photo && URL.revokeObjectURL(photo.url)), [photo]);

  const hasPhoto = !!photo || (existing?.photoUrls.length ?? 0) > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateListing(draft, hasPhoto);
    if (invalid) return setError(invalid);
    setSaving(true);
    try {
      const full = { ...draft, photo: photo?.blob ?? null };
      const saved = existing ? await backend.market.updateListing(existing.id, full) : await backend.market.createListing(full);
      qc.invalidateQueries({ queryKey: ["market"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast(existing ? "Объявление обновлено" : "Объявление опубликовано");
      router.replace(listingHref(saved.id));
    } catch (err) {
      setError({ field: null, message: err instanceof Error ? err.message : String(err) });
      setSaving(false);
    }
  }

  const fieldError = (f: keyof ListingDraft) =>
    error?.field === f ? <span className="text-alert mt-1 block text-[13px]">{error.message}</span> : null;
  const wanted = draft.kind === "wanted";

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <fieldset>
        <legend className="text-secondary mb-2 text-[13px] font-medium">Тип объявления</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LISTING_KINDS) as ListingKind[]).map((k) => (
            <Chip key={k} active={draft.kind === k} onClick={() => set({ kind: k })}>
              {LISTING_KINDS[k].emoji} {LISTING_KINDS[k].label}
            </Chip>
          ))}
        </div>
      </fieldset>
      <div>
        {existing?.photoUrls[0] && !photo ? (
          <div className="relative overflow-hidden rounded-[28px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- фото объявления по подписанной ссылке */}
            <img src={existing.photoUrls[0]} alt="Текущее фото" className="aspect-[4/3] w-full object-cover" />
          </div>
        ) : null}
        <div className={cx(existing?.photoUrls[0] && !photo && "mt-2")}>
          <CameraField
            allowFiles
            aspect="aspect-[4/3]"
            photoUrl={photo?.url ?? null}
            onCapture={(blob) => setPhoto({ blob, url: URL.createObjectURL(blob) })}
          />
        </div>
        <p className="text-secondary mt-2 text-center text-[13px]">
          {wanted
            ? "Фото не обязательно — можно показать, какое растение ищете."
            : "Только снимок с камеры: покупатель видит настоящее растение, а не картинку из интернета."}
        </p>
        {fieldError("photo")}
      </div>
      <Field label="Название">
        <input
          className={inputClass}
          value={draft.title}
          maxLength={80}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={wanted ? "Ищу хойю керри" : "Укоренённая детка монстеры"}
        />
        {fieldError("title")}
      </Field>
      <Field label="Вид растения" group>
        <SpeciesPicker value={draft.speciesId} onChange={(id) => set({ speciesId: id })} />
      </Field>
      {draft.kind === "sell" && (
        <Field label="Цена, ₽">
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.priceRub ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
              set({ priceRub: digits ? Number(digits) : null });
            }}
            placeholder="500"
          />
          {fieldError("priceRub")}
        </Field>
      )}
      {draft.kind === "swap" && (
        <Field label="Меняю на">
          <input
            className={inputClass}
            value={draft.swapFor}
            maxLength={200}
            onChange={(e) => set({ swapFor: e.target.value })}
            placeholder="Любую бегонию или строманту"
          />
          {fieldError("swapFor")}
        </Field>
      )}
      <Field label="Описание">
        <textarea
          className={cx(inputClass, "min-h-28 resize-y")}
          value={draft.description}
          maxLength={2000}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Размер, горшок, состояние корней, как забрать"
        />
        {fieldError("description")}
      </Field>
      <Field label="Город" hint="Только город — адрес обсудите в личных сообщениях.">
        <input
          className={inputClass}
          value={draft.city}
          maxLength={60}
          onChange={(e) => set({ city: e.target.value })}
          placeholder="Казань"
          autoComplete="address-level2"
        />
        {fieldError("city")}
      </Field>
      <label className="bg-muted flex items-center justify-between gap-3 rounded-xl px-4 py-3">
        <span className="text-[17px]">Могу отправить доставкой</span>
        <input
          type="checkbox"
          className="size-5 accent-[var(--leaf)]"
          checked={draft.delivery}
          onChange={(e) => set({ delivery: e.target.checked })}
        />
      </label>
      {error?.field === null && <p className="text-alert text-[15px]">{error.message}</p>}
      <Button type="submit" className="min-h-12 w-full" loading={saving}>
        {existing ? "Сохранить" : "Опубликовать"}
      </Button>
    </form>
  );
}

/** Ждём объявление (при правке), профиль и растения — из них подставляются город, вид и название. */
function ListingEditor() {
  const params = useSearchParams();
  const id = params.get("id");
  const listing = useListing(id);
  const profile = useProfile();
  const plants = usePlants();
  if ((id && listing.isPending) || profile.isPending || plants.isPending) return <Spinner />;
  const fromPlant = plants.data?.find((p) => p.id === params.get("plant"));
  const sp = catalogBySlug(fromPlant?.speciesSlug);
  const defaults = {
    city: profile.data?.city ?? "",
    speciesId: sp?.id ?? null,
    title: sp ? speciesName(sp) : (fromPlant?.nickname ?? ""),
  };
  return <ListingForm key={listing.data?.id ?? "new"} existing={listing.data?.mine ? listing.data : null} defaults={defaults} />;
}

export default function NewListingPage() {
  return (
    <>
      <PageHeader title="Объявление" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <ListingEditor />
        </Suspense>
      </RequireSession>
    </>
  );
}
