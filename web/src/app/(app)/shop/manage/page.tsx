"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Download, FileSpreadsheet, Search, Store, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend, useSession } from "@/components/session";
import { ShopStatusPill, shopHref } from "@/components/shops";
import { Button, Card, ErrorNote, Field, PageHeader, Spinner, cx, inputClass, useToast } from "@/components/ui";
import {
  IMPORT_FIELDS,
  INN_REQUIRED,
  TEMPLATE_CSV,
  emptyShopDraft,
  guessMapping,
  parseCsv,
  productsToCsv,
  rowsToProducts,
  shopToDraft,
  speciesMatcher,
  validateShop,
  type ColumnMapping,
  type ImportField,
  type Shop,
  type ShopDraft,
  type ShopProduct,
} from "@/lib/domain/shop";
import { speciesName } from "@/lib/domain/species";
import { plural } from "@/lib/format";
import { ALL_SPECIES, speciesById } from "@/lib/knowledge";
import { useMyShop, useProfile, useShopProducts } from "@/lib/queries";

// ---------------------------------------------------------------------------
// Анкета
// ---------------------------------------------------------------------------

function ShopForm({ shop, onDone }: { shop: Shop | null; onDone?: () => void }) {
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
  const err = (f: keyof ShopDraft) => (error?.field === f ? <span className="mt-1 block text-[13px] text-alert">{error.message}</span> : null);
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Название магазина">
        <input className={inputClass} value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} autoComplete="organization" />
        {err("name")}
      </Field>
      <Field
        label={INN_REQUIRED ? "ИНН" : "ИНН (необязательно)"}
        hint={INN_REQUIRED ? "Для проверки: сверяем с ЕГРЮЛ/ЕГРИП. Показывается на витрине." : "Если укажете — покажем на витрине и ускорим проверку."}
      >
        <input className={inputClass} value={draft.inn} onChange={(e) => set({ inn: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={12} />
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
          <input className={inputClass} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" maxLength={30} autoComplete="tel" />
          {err("phone")}
        </Field>
        <Field label="Сайт">
          <input className={inputClass} value={draft.website} onChange={(e) => set({ website: e.target.value })} inputMode="url" placeholder="example.ru" maxLength={300} />
          {err("website")}
        </Field>
      </div>
      <Field label="Часы работы">
        <input className={inputClass} value={draft.hours} onChange={(e) => set({ hours: e.target.value })} placeholder="Ежедневно 10:00–21:00" maxLength={100} />
        {err("hours")}
      </Field>
      <Field label="О магазине">
        <textarea className={cx(inputClass, "min-h-24")} value={draft.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} />
        {err("description")}
      </Field>
      <label className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
        <span className="text-[15px] font-medium">Есть доставка в другие города</span>
        <input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={draft.delivery} onChange={(e) => set({ delivery: e.target.checked })} />
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

const STATUS_TEXT: Record<Shop["status"], string> = {
  pending: "Проверяем магазин. Пока витрину видите только вы — можно загрузить каталог заранее.",
  verified: "Витрина открыта всем, товары показываются в «Где купить» на страницах растений.",
  rejected: "Заявка отклонена. Исправьте анкету — она снова уйдёт на проверку.",
  suspended: "Магазин скрыт модератором. Напишите нам, если это ошибка.",
};

function StatusCard({ shop, onEdit }: { shop: Shop; onEdit: () => void }) {
  const { session } = useSession();
  const isDemo = session.status === "ready" && session.backend.mode === "demo";
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-leaf/10 text-leaf">
          {shop.status === "verified" ? <BadgeCheck className="size-6" aria-hidden /> : <Store className="size-6" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[19px] font-semibold">
            <span className="truncate">{shop.name}</span> <ShopStatusPill status={shop.status} />
          </p>
          <p className="mt-1 text-[15px] text-secondary">{STATUS_TEXT[shop.status]}</p>
          {shop.reviewNote && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-[15px]">Комментарий модератора: {shop.reviewNote}</p>}
          {isDemo && shop.status === "pending" && <p className="mt-2 text-[13px] text-secondary">В демо-режиме заявки не проверяются.</p>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={shopHref(shop.id)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-muted text-[15px] font-semibold">
          Открыть витрину
        </Link>
        <Button variant="secondary" className="flex-1" onClick={onEdit}>
          Изменить анкету
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Импорт каталога
// ---------------------------------------------------------------------------

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Excel сохраняет CSV то в UTF-8, то в Windows-1251. */
async function readTextFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1251").decode(buf);
  }
}

async function readTable(file: File): Promise<unknown[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    return (await readSheet(file)) as unknown[][];
  }
  if (/\.xls$/i.test(file.name)) throw new Error("Старый формат .xls не поддерживается — сохраните файл как .xlsx или .csv");
  return parseCsv(await readTextFile(file));
}

let matcher: ReturnType<typeof speciesMatcher> | null = null;
const matchSpecies = (text: string) => (matcher ??= speciesMatcher(ALL_SPECIES))(text);

const SPECIES_OPTIONS = [...ALL_SPECIES].sort((a, b) => speciesName(a).localeCompare(speciesName(b), "ru"));
const PREVIEW_ROWS = 50;

interface ImportState {
  fileName: string;
  header: string[];
  rows: unknown[][];
  mapping: ColumnMapping;
  /** Ручные правки вида: номер строки → id вида или null («не растение»). */
  overrides: Record<number, string | null>;
  replace: boolean;
}

function ImportPreview({ state, setState, onClose }: { state: ImportState; setState: (s: ImportState) => void; onClose: () => void }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [onlyUnmatched, setOnlyUnmatched] = useState(true);
  const parsed = useMemo(
    () =>
      rowsToProducts(state.rows, state.mapping, matchSpecies).map((r) =>
        r.line in state.overrides ? { ...r, speciesId: state.overrides[r.line] } : r,
      ),
    [state.rows, state.mapping, state.overrides],
  );
  const ok = parsed.filter((r) => !r.error);
  const errors = parsed.filter((r) => r.error);
  const matched = ok.filter((r) => r.speciesId).length;
  const shown = (onlyUnmatched ? ok.filter((r) => !r.speciesId || r.line in state.overrides) : ok).slice(0, PREVIEW_ROWS);

  const upload = useMutation({
    mutationFn: () =>
      backend.shops.importProducts(
        ok.map((r) => ({
          externalId: r.externalId,
          title: r.title,
          speciesId: r.speciesId,
          priceRub: r.priceRub,
          inStock: r.inStock,
          potCm: r.potCm,
          heightCm: r.heightCm,
          url: r.url,
          imageUrl: r.imageUrl,
        })),
        state.replace,
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["shops"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      toast(`Готово: новых ${r.inserted}, обновлено ${r.updated}${r.deleted ? `, удалено ${r.deleted}` : ""}`);
      onClose();
    },
    onError: (e) => toast(`Не загрузилось: ${e.message}`),
  });

  const setMapping = (field: ImportField, value: string) =>
    setState({ ...state, mapping: { ...state.mapping, [field]: value === "" ? null : Number(value) }, overrides: {} });

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="size-6 text-leaf" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{state.fileName}</p>
          <p className="text-[13px] text-secondary">
            {state.rows.length} {plural(state.rows.length, "строка", "строки", "строк")} без заголовка
          </p>
        </div>
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
      </div>

      <section aria-label="Колонки файла">
        <h3 className="text-[15px] font-semibold">Колонки</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((f) => (
            <label key={f} className="flex items-center gap-2 text-[15px]">
              <span className="w-28 shrink-0 text-secondary">{IMPORT_FIELDS[f].label}</span>
              <select
                className={cx(inputClass, "py-2 text-[15px]")}
                value={state.mapping[f] ?? ""}
                onChange={(e) => setMapping(f, e.target.value)}
                aria-label={`Колонка «${IMPORT_FIELDS[f].label}»`}
              >
                <option value="">— нет —</option>
                {state.header.map((h, i) => (
                  <option key={i} value={i}>
                    {h || `Колонка ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <p className="rounded-xl bg-muted px-4 py-3 text-[15px]" role="status">
        Готово к загрузке: <b>{ok.length}</b> · вид определён у <b>{matched}</b>
        {errors.length > 0 && (
          <>
            {" "}
            · с ошибками: <b className="text-alert">{errors.length}</b>
          </>
        )}
      </p>
      {errors.length > 0 && (
        <ul className="space-y-1 text-[13px] text-alert">
          {errors.slice(0, 5).map((r) => (
            <li key={r.line}>
              Строка {r.line}: {r.error}
            </li>
          ))}
          {errors.length > 5 && <li>…и ещё {errors.length - 5}</li>}
        </ul>
      )}

      <section aria-label="Сопоставление видов">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold">Виды растений</h3>
          <label className="flex items-center gap-2 text-[13px] text-secondary">
            <input type="checkbox" className="accent-[var(--leaf)]" checked={onlyUnmatched} onChange={(e) => setOnlyUnmatched(e.target.checked)} />
            Только без вида
          </label>
        </div>
        <p className="mt-1 text-[13px] text-secondary">По виду товар попадает в «Где купить» и в уведомления тем, кто добавил растение в «Хочу».</p>
        {shown.length ? (
          <ul className="mt-2 divide-y divide-separator">
            {shown.map((r) => (
              <li key={r.line} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {r.title}
                  {r.priceRub != null && <span className="text-secondary"> · {r.priceRub.toLocaleString("ru-RU")} ₽</span>}
                </span>
                <select
                  className={cx(inputClass, "py-2 text-[15px] sm:w-64")}
                  value={r.speciesId ?? ""}
                  onChange={(e) => setState({ ...state, overrides: { ...state.overrides, [r.line]: e.target.value || null } })}
                  aria-label={`Вид для «${r.title}»`}
                >
                  <option value="">— не растение / не знаю —</option>
                  {SPECIES_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {speciesName(s)} ({s.latinName})
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-secondary">Все виды определены ✓</p>
        )}
      </section>

      <label className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--leaf)]" checked={state.replace} onChange={(e) => setState({ ...state, replace: e.target.checked })} />
        <span>
          <span className="block text-[15px] font-medium">Удалить товары, которых нет в файле</span>
          <span className="block text-[13px] text-secondary">Для полного прайса. Без галочки — только добавим новые и обновим цены по артикулу.</span>
        </span>
      </label>

      <Button className="w-full" disabled={!ok.length || state.mapping.title == null} loading={upload.isPending} onClick={() => upload.mutate()}>
        <Upload className="size-4" aria-hidden /> Загрузить {ok.length} {plural(ok.length, "товар", "товара", "товаров")}
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Каталог
// ---------------------------------------------------------------------------

function ProductRow({ product: p, shopId }: { product: ShopProduct; shopId: string }) {
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const sp = speciesById(p.speciesId);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["shops"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  };
      qc.invalidateQueries({ queryKey: ["stats"] });
  // Галочка отзывается сразу (локально), затем значение уже лежит в кэше каталога — без мигания.
  const [stockUi, setStockUi] = useState<boolean | null>(null);
  const stock = useMutation({
    mutationFn: (inStock: boolean) => backend.shops.setInStock(p.id, inStock),
    onMutate: async (inStock) => {
      // Незавершённая перезагрузка каталога (после импорта) иначе вернёт старое значение.
      await qc.cancelQueries({ queryKey: ["shops", "products", shopId] });
      qc.setQueryData<ShopProduct[]>(["shops", "products", shopId], (list) => list?.map((x) => (x.id === p.id ? { ...x, inStock } : x)));
    },
    onSettled: () => {
      setStockUi(null);
      refresh();
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({ mutationFn: () => backend.shops.deleteProduct(p.id), onSettled: refresh, onError: (e) => toast(e.message) });
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{p.title}</p>
        <p className="truncate text-[13px] text-secondary">
          {p.priceRub == null ? "без цены" : `${p.priceRub.toLocaleString("ru-RU")} ₽`} · {sp ? speciesName(sp) : "вид не указан"} · арт. {p.externalId}
        </p>
      </div>
      <label className="flex shrink-0 items-center gap-1.5 text-[13px] text-secondary">
        <input type="checkbox" className="size-5 accent-[var(--leaf)]" checked={stockUi ?? p.inStock}
          onChange={(e) => {
            setStockUi(e.target.checked);
            stock.mutate(e.target.checked);
          }} aria-label={`В наличии: ${p.title}`} />
        <span className="hidden sm:inline">В наличии</span>
      </label>
      {confirm ? (
        <span className="flex shrink-0 gap-1">
          <Button variant="danger" className="min-h-9 px-3" loading={remove.isPending} onClick={() => remove.mutate()}>
            Удалить
          </Button>
          <Button variant="secondary" className="min-h-9 px-3" onClick={() => setConfirm(false)}>
            Нет
          </Button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} aria-label={`Удалить «${p.title}»`} className="grid size-9 shrink-0 place-items-center rounded-full text-secondary hover:bg-muted hover:text-alert">
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

function CatalogManager({ shop }: { shop: Shop }) {
  const products = useShopProducts(shop.id);
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState<ImportState | null>(null);
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    try {
      const table = await readTable(file);
      const [header = [], ...rows] = table;
      if (!rows.length) throw new Error("В файле нет строк с товарами");
      const headerText = header.map((h) => (h == null ? "" : String(h)));
      setImporting({ fileName: file.name, header: headerText, rows, mapping: guessMapping(headerText), overrides: {}, replace: false });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const list = products.data ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q ? list.filter((p) => p.title.toLowerCase().includes(q) || p.externalId.toLowerCase().includes(q)) : list;

  return (
    <section className="space-y-3" aria-label="Каталог магазина">
      <h2 className="px-1 text-[22px] font-bold tracking-tight">Каталог</h2>
      {importing ? (
        <ImportPreview state={importing} setState={setImporting} onClose={() => setImporting(null)} />
      ) : (
        <Card className="p-5">
          <p className="text-[15px] text-secondary">
            Загрузите прайс из Excel (.xlsx) или CSV: название, цена, наличие, артикул. Вид растения определим сами — останется проверить. Повторная загрузка обновит цены и
            наличие по артикулу.
          </p>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Файл прайса" />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={reading} onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> Загрузить прайс
            </Button>
            <Button variant="secondary" onClick={() => download("podokonnik-shablon.csv", TEMPLATE_CSV)}>
              <FileSpreadsheet className="size-4" aria-hidden /> Шаблон
            </Button>
            <Button
              variant="secondary"
              disabled={!list.length}
              onClick={() => download(`katalog-${new Date().toISOString().slice(0, 10)}.csv`, productsToCsv(list, (id) => speciesById(id)?.latinName ?? null))}
            >
              <Download className="size-4" aria-hidden /> Выгрузить
            </Button>
          </div>
        </Card>
      )}

      <Card className="px-5 py-3">
        {products.isPending ? (
          <Spinner />
        ) : products.error ? (
          <ErrorNote error={products.error} onRetry={() => products.refetch()} />
        ) : !list.length ? (
          <p className="py-6 text-center text-secondary">Товаров пока нет</p>
        ) : (
          <>
            <div className="flex items-center gap-3 py-2">
              <p className="shrink-0 text-[15px] font-semibold">
                {list.length} {plural(list.length, "товар", "товара", "товаров")}
              </p>
              <label className="relative ml-auto block w-full max-w-64">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary" aria-hidden />
                <input className={cx(inputClass, "py-2 pl-9 text-[15px]")} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или артикул" aria-label="Поиск товара" />
              </label>
            </div>
            <ul className="divide-y divide-separator" aria-label="Товары">
              {filtered.slice(0, 100).map((p) => (
                <ProductRow key={p.id} product={p} shopId={shop.id} />
              ))}
            </ul>
            {filtered.length > 100 && <p className="py-2 text-center text-[13px] text-secondary">Показаны 100 из {filtered.length} — уточните поиск</p>}
          </>
        )}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Intro() {
  return (
    <Card className="p-5">
      <p className="text-[19px] font-semibold">Магазин в «Подоконнике» — бесплатно</p>
      <ul className="mt-3 space-y-2 text-[15px] text-secondary">
        <li>🏪 Витрина с каталогом, ценами и контактами</li>
        <li>📍 Ваши товары в блоке «Где купить» на страницах растений — сначала покупателям из вашего города</li>
        <li>🔔 Уведомление тем, кто добавил растение в «Хочу», когда оно появится у вас или подешевеет</li>
        <li>📄 Каталог загружается из Excel или CSV и выгружается обратно</li>
      </ul>
      <p className="mt-3 text-[13px] text-secondary">
        Для значка ✓ проверяем магазин вручную — обычно за 1–2 дня. Деньги через приложение не проходят: покупатель переходит на ваш сайт или звонит.
      </p>
    </Card>
  );
}

function Manage() {
  const shop = useMyShop();
  const [editing, setEditing] = useState(false);
  if (shop.isPending) return <Spinner />;
  if (shop.error) return <ErrorNote error={shop.error} onRetry={() => shop.refetch()} />;
  if (!shop.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Intro />
        <Card className="p-5">
          <h2 className="mb-4 text-[19px] font-semibold">Заявка</h2>
          <ShopForm shop={null} />
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {editing ? (
        <Card className="p-5">
          <h2 className="mb-4 text-[19px] font-semibold">Анкета магазина</h2>
          <ShopForm shop={shop.data} onDone={() => setEditing(false)} />
        </Card>
      ) : (
        <StatusCard shop={shop.data} onEdit={() => setEditing(true)} />
      )}
      <CatalogManager shop={shop.data} />
    </div>
  );
}

export default function ManageShopPage() {
  return (
    <>
      <PageHeader title="Мой магазин" />
      <RequireSession>
        <Manage />
      </RequireSession>
    </>
  );
}
