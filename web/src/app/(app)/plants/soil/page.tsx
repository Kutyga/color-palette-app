import type { Metadata } from "next";
import Link from "next/link";
import { SoilSchematic } from "@/components/soil-schematic";
import { PageHeader } from "@/components/ui";
import { SOIL_MATERIALS, SOIL_ROLES } from "@/lib/domain/soil";
import { speciesName } from "@/lib/domain/species";
import { ALL_SOIL_MIXES, speciesForMix } from "@/lib/knowledge";

export const metadata: Metadata = {
  title: "Составы грунта для комнатных растений",
  description: `${ALL_SOIL_MIXES.length} рецептов грунта: для ароидных, кактусов, орхидей, фиалок, цитрусовых и других — пропорции, кислотность, дренаж и горшок.`,
};

const PRINCIPLES: { role: keyof typeof SOIL_ROLES; text: string }[] = [
  { role: "base", text: "Торф, листовая земля или кокос — то, что держит корни и питание." },
  { role: "loosener", text: "Перлит, кора, пемза — поры с воздухом, без них корни задыхаются и гниют." },
  { role: "moisture", text: "Вермикулит и сфагнум отдают воду постепенно — для влаголюбивых." },
  { role: "drainage", text: "Керамзит на дне и отверстие в горшке уводят лишнюю воду." },
  { role: "additive", text: "Уголь и цеолит — против закисания; биогумус — мягкое питание." },
];

export default function SoilGuidePage() {
  return (
    <>
      <nav className="pt-6 text-[15px] text-secondary">
        <Link href="/plants/" className="hover:text-label">
          Знания
        </Link>{" "}
        / Грунты
      </nav>
      <PageHeader eyebrow={`${ALL_SOIL_MIXES.length} рецептов`} title="Грунты" />
      <p className="max-w-2xl text-[17px] leading-relaxed text-secondary">
        Универсальный магазинный грунт подходит далеко не всем: суккулентам в нём сыро, орхидеям — душно, азалиям — не та
        кислотность. Каждому виду в базе знаний подобран один из рецептов ниже. Проценты — по объёму: удобно мерить
        одной банкой или стаканом.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PRINCIPLES.map((p) => (
          <div key={p.role} className="rounded-[20px] bg-surface p-4">
            <p className="font-semibold first-letter:uppercase">{SOIL_ROLES[p.role]}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-secondary">{p.text}</p>
          </div>
        ))}
      </div>

      <nav className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4" aria-label="Составы">
        {ALL_SOIL_MIXES.map((m) => (
          <a key={m.slug} href={`#${m.slug}`} className="shrink-0 rounded-full bg-muted px-4 py-2 text-[13px] font-medium hover:bg-soil/15">
            {m.nameRu}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-8">
        {ALL_SOIL_MIXES.map((m) => {
          const plants = speciesForMix(m.slug);
          return (
            <div key={m.slug} id={m.slug} className="scroll-mt-24">
              <SoilSchematic mix={m} />
              {plants.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 px-1">
                  <span className="mr-1 text-[13px] text-secondary">Подходит ({plants.length}):</span>
                  {plants.map((s) => (
                    <Link key={s.slug} href={`/plants/${s.slug}/`} className="rounded-full bg-surface px-2.5 py-0.5 text-[13px] hover:text-leaf">
                      {speciesName(s)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <section className="mt-12 rounded-[20px] bg-surface p-5">
        <h2 className="text-[22px] font-bold tracking-tight">Компоненты</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(SOIL_MATERIALS).map(([id, m]) => (
            <li key={id} className="flex items-center gap-3">
              <span className="size-6 shrink-0 rounded-lg ring-1 ring-separator" style={{ background: m.color }} aria-hidden />
              <span>
                <span className="font-medium">{m.label}</span>
                <span className="block text-[13px] text-secondary">{m.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
