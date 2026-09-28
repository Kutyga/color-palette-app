/** Страница вида из базы знаний: уход, грунт, токсичность и «Где купить». Собирается заранее для каждого вида. */

import { Droplet, Droplets, FlaskConical, PawPrint, Plus, Sun, Thermometer, Wind } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpeciesCard } from "@/components/knowledge-browser";
import { WhereToBuy, WishButton } from "@/components/shops";
import { SoilSchematic } from "@/components/soil-schematic";
import { LARGE_PHOTO, PhotoCredit, PlantPhoto } from "@/components/ui";
import { LIGHT_LEVELS, baseWaterInterval } from "@/lib/domain/care";
import { DIFFICULTY_LABELS, speciesName } from "@/lib/domain/species";
import { MONTHS_SHORT, plural } from "@/lib/format";
import { ALL_SPECIES, soilMixFor, speciesBySlug } from "@/lib/knowledge";

export function generateStaticParams() {
  return ALL_SPECIES.map((s) => ({ slug: s.slug }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: PageProps<"/plants/[slug]">): Promise<Metadata> {
  const s = speciesBySlug((await params).slug);
  if (!s) return {};
  const name = speciesName(s);
  return {
    title: `${name} — уход в домашних условиях`,
    description: `${name} (${s.latinName}): ${s.descriptionRu ?? ""} Полив, свет, влажность, температура и советы по уходу.`,
  };
}

function Fact({ icon: Icon, label, value, tone }: { icon: typeof Sun; label: string; value: string; tone?: string }) {
  return (
    <div className="bg-surface min-w-[140px] flex-1 rounded-[20px] p-4">
      <Icon className="size-5" style={{ color: tone ?? "var(--leaf)" }} aria-hidden />
      <p className="text-secondary mt-3 text-[13px]">{label}</p>
      <p className="text-[17px] leading-snug font-semibold">{value}</p>
    </div>
  );
}

export default async function SpeciesPage({ params }: PageProps<"/plants/[slug]">) {
  const s = speciesBySlug((await params).slug);
  if (!s) notFound();
  const name = speciesName(s);
  const care = s.care;
  const soil = soilMixFor(s);
  const similar = ALL_SPECIES.filter((x) => x.slug !== s.slug && x.latinName.split(" ")[0] === s.latinName.split(" ")[0])
    .concat(ALL_SPECIES.filter((x) => x.slug !== s.slug && x.plantType === s.plantType))
    .filter((x, i, arr) => arr.indexOf(x) === i)
    .slice(0, 4);

  return (
    <article className="pt-6">
      <nav className="text-secondary text-[15px]">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        / {name}
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
        <figure>
          <PlantPhoto
            src={s.image?.url}
            seed={s.slug}
            alt={name}
            className="aspect-square w-full rounded-[28px]"
            iconSize={72}
            sizes={LARGE_PHOTO}
          />
          {s.image && (
            <figcaption className="mt-2 px-1">
              <PhotoCredit image={s.image} />
            </figcaption>
          )}
        </figure>
        <div>
          <p className="text-secondary text-[17px] italic">{s.latinName}</p>
          <h1 className="mt-1 text-[40px] leading-[1.05] font-bold tracking-tight sm:text-[48px]">{name}</h1>
          {s.commonNamesRu.length > 1 && (
            <p className="text-secondary mt-2 text-[15px]">Ещё называют: {s.commonNamesRu.slice(1).join(", ")}</p>
          )}
          {s.descriptionRu && <p className="mt-4 text-[19px] leading-relaxed">{s.descriptionRu}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-medium">
            {s.difficulty != null && <span className="bg-muted rounded-full px-3 py-1">Сложность: {DIFFICULTY_LABELS[s.difficulty]}</span>}
            {s.plantType && <span className="bg-muted rounded-full px-3 py-1 first-letter:uppercase">{s.plantType}</span>}
            {s.airPurifying && <span className="bg-mist/15 text-mist rounded-full px-3 py-1">Очищает воздух</span>}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/garden/new/?species=${s.slug}`}
              className="bg-leaf inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[17px] font-semibold text-white hover:brightness-110"
            >
              <Plus className="size-5" aria-hidden /> Добавить в коллекцию
            </Link>
            <WishButton speciesId={s.id} />
          </div>
        </div>
      </div>

      <WhereToBuy speciesId={s.id} />

      {care && (
        <>
          <h2 className="mt-12 text-[28px] font-bold tracking-tight">Уход</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {care.light && <Fact icon={Sun} label="Свет" value={LIGHT_LEVELS[care.light]} tone="var(--soil)" />}
            <Fact
              icon={Droplet}
              label="Полив"
              value={`летом раз в ${care.waterIntervalSummer} дн., зимой раз в ${care.waterIntervalWinter} дн.`}
              tone="var(--water)"
            />
            {care.humidityMinPct != null && <Fact icon={Wind} label="Влажность" value={`от ${care.humidityMinPct}%`} tone="var(--mist)" />}
            {care.tempMinC != null && (
              <Fact icon={Thermometer} label="Температура" value={`${care.tempMinC}…${care.tempMaxC} °C`} tone="var(--alert)" />
            )}
            <Fact
              icon={PawPrint}
              label="Для питомцев"
              value={s.toxicToPets === false ? "Безопасно" : s.toxicToPets ? "Ядовито" : "Нет данных"}
              tone={s.toxicToPets ? "var(--alert)" : "var(--leaf)"}
            />
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <section className="bg-surface rounded-[20px] p-5">
              <h3 className="flex items-center gap-2 text-[17px] font-semibold">
                <Droplets className="text-water size-5" aria-hidden /> Полив
              </h3>
              <p className="text-secondary mt-2 text-[15px] leading-relaxed">
                {care.drynessRu && <>Поливайте, когда просохнет {care.drynessRu}. </>}В приложении стартовый интервал — примерно раз в{" "}
                {Math.round(baseWaterInterval(care.waterIntervalSummer))} дн.; летом он короче, зимой длиннее, а ещё учитывается горшок,
                освещение и то, как вы поливаете на самом деле.
              </p>
            </section>
            <section className="bg-surface rounded-[20px] p-5">
              <h3 className="flex items-center gap-2 text-[17px] font-semibold">
                <FlaskConical className="text-soil size-5" aria-hidden /> Подкормка и пересадка
              </h3>
              <p className="text-secondary mt-2 text-[15px] leading-relaxed">
                {care.fertilizeIntervalDays
                  ? `Подкармливайте раз в ${care.fertilizeIntervalDays} дн.${care.fertilizeMonths.length ? ` (${care.fertilizeMonths.map((m) => MONTHS_SHORT[m - 1]).join(", ")})` : ""}. `
                  : ""}
                {care.repotEveryYears
                  ? care.repotEveryYears === 1
                    ? "Пересаживайте каждый год."
                    : `Пересаживайте раз в ${care.repotEveryYears} ${plural(care.repotEveryYears, "год", "года", "лет")}.`
                  : ""}
                {care.propagation.length > 0 && ` Размножение: ${care.propagation.join(", ")}.`}
              </p>
            </section>
          </div>

          {soil && (
            <div id="soil" className="mt-6 scroll-mt-24">
              <SoilSchematic mix={soil} noteRu={care.soilNoteRu} />
            </div>
          )}

          {care.tipsRu.length > 0 && (
            <section className="bg-surface mt-6 rounded-[20px] p-5">
              <h3 className="text-[17px] font-semibold">Советы</h3>
              <ul className="mt-2 space-y-2">
                {care.tipsRu.map((t) => (
                  <li key={t} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="bg-leaf mt-2 size-1.5 shrink-0 rounded-full" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {(s.synonyms.length > 0 || s.commonNamesEn.length > 0) && (
        <p className="text-secondary mt-6 text-[13px]">
          {s.synonyms.length > 0 && <>Прежние латинские названия: {s.synonyms.join(", ")}. </>}
          {s.commonNamesEn.length > 0 && <>По-английски: {s.commonNamesEn.join(", ")}.</>}
        </p>
      )}

      {similar.length > 0 && (
        <>
          <h2 className="mt-12 text-[22px] font-bold tracking-tight">Похожие растения</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {similar.map((x) => (
              <SpeciesCard key={x.slug} s={x} />
            ))}
          </div>
        </>
      )}
    </article>
  );
}
