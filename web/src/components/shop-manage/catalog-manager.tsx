"use client";

/**
 * Каталог в кабинете магазина: загрузка прайса, шаблон и выгрузка, наличие и удаление товаров.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useBackend } from "@/components/session";
import { Button, Card, ErrorNote, Spinner, cx, inputClass, useToast } from "@/components/ui";
import { TEMPLATE_CSV, guessMapping, productsToCsv } from "@/lib/domain/price-list";
import type { Shop, ShopProduct } from "@/lib/domain/shop";
import { speciesName } from "@/lib/domain/species";
import { download, readTable } from "@/lib/files";
import { plural } from "@/lib/format";
import { speciesById } from "@/lib/knowledge";
import { useShopProducts } from "@/lib/queries";
import { ImportPreview, type ImportState } from "./import-preview";

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
        <p className="text-secondary truncate text-[13px]">
          {p.priceRub == null ? "без цены" : `${p.priceRub.toLocaleString("ru-RU")} ₽`} · {sp ? speciesName(sp) : "вид не указан"} · арт.{" "}
          {p.externalId}
        </p>
      </div>
      <label className="text-secondary flex shrink-0 items-center gap-1.5 text-[13px]">
        <input
          type="checkbox"
          className="size-5 accent-[var(--leaf)]"
          checked={stockUi ?? p.inStock}
          onChange={(e) => {
            setStockUi(e.target.checked);
            stock.mutate(e.target.checked);
          }}
          aria-label={`В наличии: ${p.title}`}
        />
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
        <button
          type="button"
          onClick={() => setConfirm(true)}
          aria-label={`Удалить «${p.title}»`}
          className="text-secondary hover:bg-muted hover:text-alert grid size-9 shrink-0 place-items-center rounded-full"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

export function CatalogManager({ shop }: { shop: Shop }) {
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
          <p className="text-secondary text-[15px]">
            Загрузите прайс из Excel (.xlsx) или CSV: название, цена, наличие, артикул. Вид растения определим сами — останется проверить.
            Повторная загрузка обновит цены и наличие по артикулу.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label="Файл прайса"
          />
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
              onClick={() =>
                download(
                  `katalog-${new Date().toISOString().slice(0, 10)}.csv`,
                  productsToCsv(list, (id) => speciesById(id)?.latinName ?? null),
                )
              }
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
          <p className="text-secondary py-6 text-center">Товаров пока нет</p>
        ) : (
          <>
            <div className="flex items-center gap-3 py-2">
              <p className="shrink-0 text-[15px] font-semibold">
                {list.length} {plural(list.length, "товар", "товара", "товаров")}
              </p>
              <label className="relative ml-auto block w-full max-w-64">
                <Search className="text-secondary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                <input
                  className={cx(inputClass, "py-2 pl-9 text-[15px]")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Название или артикул"
                  aria-label="Поиск товара"
                />
              </label>
            </div>
            <ul className="divide-separator divide-y" aria-label="Товары">
              {filtered.slice(0, 100).map((p) => (
                <ProductRow key={p.id} product={p} shopId={shop.id} />
              ))}
            </ul>
            {filtered.length > 100 && (
              <p className="text-secondary py-2 text-center text-[13px]">Показаны 100 из {filtered.length} — уточните поиск</p>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
