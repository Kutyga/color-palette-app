"use client";

/**
 * Предпросмотр загрузки прайса: колонки файла, найденные виды растений, ручные правки
 * и опция «удалить товары, которых нет в файле».
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useBackend } from "@/components/session";
import { Button, Card, cx, inputClass, useToast } from "@/components/ui";
import { IMPORT_FIELDS, rowsToProducts, speciesMatcher, type ColumnMapping, type ImportField } from "@/lib/domain/price-list";
import { speciesName } from "@/lib/domain/species";
import { plural } from "@/lib/format";
import { ALL_SPECIES } from "@/lib/knowledge";

let matcher: ReturnType<typeof speciesMatcher> | null = null;
const matchSpecies = (text: string) => (matcher ??= speciesMatcher(ALL_SPECIES))(text);

const SPECIES_OPTIONS = [...ALL_SPECIES].sort((a, b) => speciesName(a).localeCompare(speciesName(b), "ru"));
const PREVIEW_ROWS = 50;

export interface ImportState {
  fileName: string;
  header: string[];
  rows: unknown[][];
  mapping: ColumnMapping;
  /** Ручные правки вида: номер строки → id вида или null («не растение»). */
  overrides: Record<number, string | null>;
  replace: boolean;
}

export function ImportPreview({
  state,
  setState,
  onClose,
}: {
  state: ImportState;
  setState: (s: ImportState) => void;
  onClose: () => void;
}) {
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
        <FileSpreadsheet className="text-leaf size-6" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{state.fileName}</p>
          <p className="text-secondary text-[13px]">
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
              <span className="text-secondary w-28 shrink-0">{IMPORT_FIELDS[f].label}</span>
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

      <p className="bg-muted rounded-xl px-4 py-3 text-[15px]" role="status">
        Готово к загрузке: <b>{ok.length}</b> · вид определён у <b>{matched}</b>
        {errors.length > 0 && (
          <>
            {" "}
            · с ошибками: <b className="text-alert">{errors.length}</b>
          </>
        )}
      </p>
      {errors.length > 0 && (
        <ul className="text-alert space-y-1 text-[13px]">
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
          <label className="text-secondary flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              className="accent-[var(--leaf)]"
              checked={onlyUnmatched}
              onChange={(e) => setOnlyUnmatched(e.target.checked)}
            />
            Только без вида
          </label>
        </div>
        <p className="text-secondary mt-1 text-[13px]">
          По виду товар попадает в «Где купить» и в уведомления тем, кто добавил растение в «Хочу».
        </p>
        {shown.length ? (
          <ul className="divide-separator mt-2 divide-y">
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
          <p className="text-secondary mt-2 text-[15px]">Все виды определены ✓</p>
        )}
      </section>

      <label className="bg-muted flex items-start gap-3 rounded-xl px-4 py-3">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[var(--leaf)]"
          checked={state.replace}
          onChange={(e) => setState({ ...state, replace: e.target.checked })}
        />
        <span>
          <span className="block text-[15px] font-medium">Удалить товары, которых нет в файле</span>
          <span className="text-secondary block text-[13px]">
            Для полного прайса. Без галочки — только добавим новые и обновим цены по артикулу.
          </span>
        </span>
      </label>

      <Button
        className="w-full"
        disabled={!ok.length || state.mapping.title == null}
        loading={upload.isPending}
        onClick={() => upload.mutate()}
      >
        <Upload className="size-4" aria-hidden /> Загрузить {ok.length} {plural(ok.length, "товар", "товара", "товаров")}
      </Button>
    </Card>
  );
}
