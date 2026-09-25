"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronRight, ScanSearch, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { useBackend } from "@/components/session";
import { Button, Field, PageHeader, PlantPhoto, ProgressRing, Sheet, Spinner, inputClass, useToast } from "@/components/ui";
import { LIGHT_LEVELS, POT_MATERIALS, type LightLevel, type PotMaterial } from "@/lib/domain/care";
import { capitalizeLatin, matchSpecies, type IdentificationCandidate } from "@/lib/domain/identification";
import { VISIBILITIES, type Visibility } from "@/lib/domain/plant";
import { speciesName, type Species } from "@/lib/domain/species";
import { toJpeg } from "@/lib/image";
import { ALL_SPECIES, searchSpecies, speciesBySlug } from "@/lib/knowledge";
import { useLocations } from "@/lib/queries";

const LAST_WATERED = [
  { label: "Сегодня", days: 0 },
  { label: "Вчера", days: 1 },
  { label: "3 дня назад", days: 3 },
  { label: "Неделю назад", days: 7 },
  { label: "Давно / не помню", days: null },
] as const;

function SpeciesPicker({ value, onChange }: { value: Species | null; onChange: (s: Species | null) => void }) {
  const [query, setQuery] = useState("");
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
        <PlantPhoto src={null} seed={value.slug} alt="" className="size-12 rounded-xl" iconSize={20} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{speciesName(value)}</p>
          <p className="truncate text-[13px] text-secondary italic">{value.latinName}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="grid size-9 place-items-center rounded-full bg-surface" aria-label="Сменить вид">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  const results = query.trim() ? searchSpecies(query).slice(0, 6) : [];
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-secondary" aria-hidden />
        <input
          className={`${inputClass} pl-12`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название: монстера, фикус…"
          aria-label="Вид растения"
        />
      </div>
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-separator overflow-hidden rounded-2xl bg-muted">
          {results.map((s) => (
            <li key={s.slug}>
              <button type="button" onClick={() => onChange(s)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface">
                <span className="flex-1">
                  <span className="block font-medium">{speciesName(s)}</span>
                  <span className="block text-[13px] text-secondary italic">{s.latinName}</span>
                </span>
                <ChevronRight className="size-4 text-secondary" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && results.length === 0 && (
        <p className="mt-2 text-[15px] text-secondary">Такого вида нет в базе — растение можно добавить и без вида.</p>
      )}
    </div>
  );
}

function IdentifyResults({ candidates, onPick }: { candidates: IdentificationCandidate[]; onPick: (c: IdentificationCandidate) => void }) {
  if (!candidates.length) {
    return <p className="text-secondary">Не удалось узнать растение. Снимите лист или цветок крупно при хорошем свете — или выберите вид вручную.</p>;
  }
  return (
    <>
      <p className="text-[13px] text-secondary">По данным Pl@ntNet. Проверьте по фото в базе знаний.</p>
      <ul className="mt-3 space-y-1">
        {candidates.map((c) => {
          const exact = c.species && !c.genusOnly;
          return (
            <li key={c.latinName}>
              <button type="button" onClick={() => onPick(c)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-muted">
                <ProgressRing progress={c.score} color={exact ? "var(--leaf)" : "var(--water)"} size={44} stroke={5}>
                  <span className="text-[11px] font-semibold">{c.percent}%</span>
                </ProgressRing>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{exact ? speciesName(c.species!) : (c.commonName ?? capitalizeLatin(c.latinName))}</span>
                  <span className="block truncate text-[13px] text-secondary italic">
                    {!c.species
                      ? `${c.commonName ? `${capitalizeLatin(c.latinName)} · ` : ""}нет в базе знаний — добавим с этим названием`
                      : c.genusOnly
                        ? `Род ${c.species.latinName.split(" ")[0]} — уточните вид`
                        : capitalizeLatin(c.latinName)}
                  </span>
                </span>
                <ChevronRight className="size-4 text-secondary" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function NewPlantForm() {
  const params = useSearchParams();
  const backend = useBackend();
  const locations = useLocations();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const [species, setSpecies] = useState<Species | null>(() => speciesBySlug(params.get("species")));
  const [nickname, setNickname] = useState(() => (species ? speciesName(species) : ""));
  const [locationId, setLocationId] = useState<string>("");
  const [newLocation, setNewLocation] = useState<{ name: string; light: LightLevel } | null>(null);
  const [pot, setPot] = useState<PotMaterial | "">("");
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [lastWatered, setLastWatered] = useState<number | null>(3);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [candidates, setCandidates] = useState<IdentificationCandidate[] | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [saving, setSaving] = useState(false);

  function pickSpecies(s: Species | null) {
    // Имя подставляем, только если пользователь его ещё не придумал сам.
    if (s && (!nickname || nickname === (species ? speciesName(species) : ""))) setNickname(speciesName(s));
    setSpecies(s);
  }

  async function identify() {
    if (!photo || !backend.identifier) return;
    setIdentifying(true);
    try {
      const predictions = await backend.identifier.identify(await toJpeg(photo.file, 1280));
      setCandidates(predictions.slice(0, 5).map((p) => matchSpecies(p, ALL_SPECIES)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Распознавание не удалось");
    } finally {
      setIdentifying(false);
    }
  }

  function pickCandidate(c: IdentificationCandidate) {
    setCandidates(null);
    if (c.species && !c.genusOnly) {
      pickSpecies(c.species);
    } else {
      setSpecies(null);
      if (!nickname) setNickname(c.commonName ?? capitalizeLatin(c.latinName));
      if (c.genusOnly && c.species) toast(`Похоже на род ${c.species.latinName.split(" ")[0]} — выберите вид в списке`);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let location = locationId || null;
      if (newLocation?.name.trim()) location = (await backend.garden.addLocation(newLocation.name.trim(), newLocation.light)).id;
      const today = new Date();
      const plant = await backend.garden.addPlant({
        nickname: nickname.trim(),
        speciesSlug: species?.slug ?? null,
        locationId: location,
        potMaterial: pot || null,
        visibility,
        lastWateredAt: lastWatered == null ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() - lastWatered, 10),
      });
      if (photo) {
        try {
          await backend.garden.setPlantPhoto(plant.id, await toJpeg(photo.file));
        } catch (err) {
          toast(`Растение добавлено, но фото не загрузилось: ${err instanceof Error ? err.message : err}`);
        }
      }
      for (const key of ["plants", "tasks", "stats", "locations"]) qc.invalidateQueries({ queryKey: [key] });
      toast(`${plant.nickname} теперь в вашем саду`);
      router.push(`/garden/plant/?id=${plant.id}`);
    } catch (err) {
      toast(`Не удалось сохранить: ${err instanceof Error ? err.message : err}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div>
        <label className="relative block cursor-pointer overflow-hidden rounded-[28px]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- локальный предпросмотр
            <img src={photo.url} alt="Фото растения" className="aspect-square w-full object-cover" />
          ) : (
            <span className="grid aspect-square w-full place-items-center bg-muted text-secondary">
              <span className="flex flex-col items-center gap-2">
                <Camera className="size-10" strokeWidth={1.5} aria-hidden />
                <span className="font-medium">Добавить фото</span>
              </span>
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhoto({ file, url: URL.createObjectURL(file) });
            }}
          />
        </label>
        {photo && backend.identifier && (
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={identify} loading={identifying}>
            <ScanSearch className="size-5 text-leaf" aria-hidden /> {identifying ? "Распознаём…" : "Распознать растение"}
          </Button>
        )}
        {photo && !backend.identifier && (
          <p className="mt-3 text-center text-[13px] text-secondary">Распознавание по фото доступно после регистрации.</p>
        )}
      </div>

      <div className="space-y-5">
        <Field label="Вид" group>
          <SpeciesPicker value={species} onChange={pickSpecies} />
        </Field>
        <Field label="Имя">
          <input className={inputClass} required maxLength={60} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Например, Монстера Мося" />
        </Field>
        <Field label="Где стоит" group>
          {newLocation ? (
            <div className="flex gap-2">
              <input
                className={inputClass}
                autoFocus
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="Гостиная, южное окно"
                aria-label="Название места"
              />
              <select
                className={`${inputClass} w-auto`}
                value={newLocation.light}
                onChange={(e) => setNewLocation({ ...newLocation, light: e.target.value as LightLevel })}
                aria-label="Освещение"
              >
                {Object.entries(LIGHT_LEVELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <select
              className={inputClass}
              aria-label="Где стоит"
              value={locationId}
              onChange={(e) => (e.target.value === "__new" ? setNewLocation({ name: "", light: "bright_indirect" }) : setLocationId(e.target.value))}
            >
              <option value="">Не указано</option>
              {locations.data?.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.lightLevel ? ` · ${LIGHT_LEVELS[l.lightLevel].toLowerCase()}` : ""}
                </option>
              ))}
              <option value="__new">+ Новое место…</option>
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Горшок">
            <select className={inputClass} value={pot} onChange={(e) => setPot(e.target.value as PotMaterial | "")}>
              <option value="">Не указан</option>
              {Object.entries(POT_MATERIALS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Кто видит">
            <select className={inputClass} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
              {Object.entries(VISIBILITIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Последний полив" group>
          <div className="flex flex-wrap gap-2">
            {LAST_WATERED.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setLastWatered(o.days)}
                aria-pressed={lastWatered === o.days}
                className={`rounded-full px-4 py-2 text-[15px] ${lastWatered === o.days ? "bg-label text-bg" : "bg-muted"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
        <Button type="submit" className="w-full min-h-12 text-[17px]" loading={saving} disabled={!nickname.trim()}>
          Добавить в коллекцию
        </Button>
      </div>

      <Sheet open={candidates !== null} onClose={() => setCandidates(null)} title="Похоже на">
        {candidates && <IdentifyResults candidates={candidates} onPick={pickCandidate} />}
      </Sheet>
    </form>
  );
}

export default function NewPlantPage() {
  return (
    <>
      <PageHeader title="Новое растение" />
      <RequireSession>
        <Suspense fallback={<Spinner />}>
          <NewPlantForm />
        </Suspense>
      </RequireSession>
    </>
  );
}
