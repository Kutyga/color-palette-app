"use client";

/** Новое растение: обязательное фото, распознавание вида, место, горшок и последний полив. */

import { useQueryClient } from "@tanstack/react-query";
import { ScanSearch } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/app-shell";
import { CameraField } from "@/components/camera";
import {
  IdentifyResults,
  LastWateredPicker,
  LocationField,
  SpeciesPicker,
  wateredAt,
  type DaysAgo,
  type LocationChoice,
} from "@/components/new-plant";
import { useBackend } from "@/components/session";
import { Button, Field, PageHeader, Sheet, Spinner, inputClass, useToast } from "@/components/ui";
import { POT_MATERIALS, type PotMaterial } from "@/lib/domain/care";
import { capitalizeLatin, matchSpecies, type IdentificationCandidate } from "@/lib/domain/identification";
import { VISIBILITIES, type Visibility } from "@/lib/domain/plant";
import { speciesName, type Species } from "@/lib/domain/species";
import { toJpeg } from "@/lib/image";
import { ALL_SPECIES, speciesBySlug } from "@/lib/knowledge";

function NewPlantForm() {
  const params = useSearchParams();
  const backend = useBackend();
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const [species, setSpecies] = useState<Species | null>(() => speciesBySlug(params.get("species")));
  const [nickname, setNickname] = useState(() => (species ? speciesName(species) : ""));
  const [location, setLocation] = useState<LocationChoice>({ id: null });
  const [pot, setPot] = useState<PotMaterial | "">("");
  const [visibility, setVisibility] = useState<Visibility>("followers");
  const [lastWatered, setLastWatered] = useState<DaysAgo>(3);
  const [inWater, setInWater] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
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
      const predictions = await backend.identifier.identify(await toJpeg(photo.blob, 1280));
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
    // Фото обязательно: в коллекции только свои растения, снятые дома.
    if (!photo) {
      toast("Сначала сфотографируйте растение");
      return;
    }
    setSaving(true);
    try {
      const locationId =
        "id" in location
          ? location.id
          : location.name.trim()
            ? (await backend.garden.addLocation(location.name.trim(), location.light)).id
            : null;
      const plant = await backend.garden.addPlant({
        nickname: nickname.trim(),
        speciesSlug: species?.slug ?? null,
        locationId,
        potMaterial: pot || null,
        visibility,
        lastWateredAt: inWater ? null : wateredAt(lastWatered),
        inWater,
      });
      try {
        await backend.garden.setPlantPhoto(plant.id, photo.blob);
      } catch (err) {
        toast(`Растение добавлено, но фото не загрузилось: ${err instanceof Error ? err.message : err}`);
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
        <CameraField
          photoUrl={photo?.url ?? null}
          onCapture={(blob) => {
            if (photo) URL.revokeObjectURL(photo.url);
            setPhoto({ blob, url: URL.createObjectURL(blob) });
            setCandidates(null);
          }}
        />
        {photo && backend.identifier && (
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={identify} loading={identifying}>
            <ScanSearch className="text-leaf size-5" aria-hidden /> {identifying ? "Распознаём…" : "Распознать растение"}
          </Button>
        )}
        {photo && !backend.identifier && (
          <p className="text-secondary mt-3 text-center text-[13px]">Распознавание по фото доступно после регистрации.</p>
        )}
      </div>

      <div className="space-y-5">
        <Field label="Вид" group>
          <SpeciesPicker value={species} onChange={pickSpecies} />
        </Field>
        <Field label="Имя">
          <input
            className={inputClass}
            required
            maxLength={60}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Например, Монстера Мося"
          />
        </Field>
        <Field label="Где стоит" group>
          <LocationField value={location} onChange={setLocation} />
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
        <label className="bg-muted flex items-center justify-between gap-3 rounded-xl px-4 py-3">
          <span>
            <span className="block text-[17px]">💧 Растёт в воде</span>
            <span className="text-secondary block text-[13px]">Черенок в стакане или гидропоника — полив не нужен</span>
          </span>
          <input
            type="checkbox"
            className="size-5 shrink-0 accent-[var(--water)]"
            checked={inWater}
            onChange={(e) => setInWater(e.target.checked)}
          />
        </label>
        {!inWater && (
          <Field label="Последний полив" group>
            <LastWateredPicker value={lastWatered} onChange={setLastWatered} />
          </Field>
        )}
        <Button type="submit" className="min-h-12 w-full text-[17px]" loading={saving} disabled={!nickname.trim() || !photo}>
          Добавить в коллекцию
        </Button>
        {!photo && <p className="text-secondary text-center text-[13px]">Чтобы добавить растение, сфотографируйте его у себя дома.</p>}
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
