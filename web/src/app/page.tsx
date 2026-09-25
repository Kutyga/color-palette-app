import { BookOpen, CalendarCheck, Camera, Clapperboard, Sprout, Trophy } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/app-shell";
import { HomeActions, RedirectSignedIn } from "@/components/home-actions";
import { PlantPhoto } from "@/components/ui";
import { speciesName } from "@/lib/domain/species";
import { ALL_SPECIES } from "@/lib/knowledge";

const FEATURES = [
  { icon: CalendarCheck, title: "Сегодня", text: "Открыли — и за 10 секунд видно, кого полить. Кольца дня, как в Apple Fitness." },
  { icon: Sprout, title: "Коллекция", text: "Все растения сеткой, как профиль в Instagram. Статус полива — цветной точкой." },
  { icon: BookOpen, title: "База знаний", text: `${ALL_SPECIES.length} комнатных растений: свет, полив летом и зимой, влажность, токсичность для питомцев.` },
  { icon: Camera, title: "Распознавание", text: "Сфотографируйте лист — Pl@ntNet подскажет вид и подставит карточку ухода." },
  { icon: Clapperboard, title: "Лента", text: "Подписки, «Интересное» и свежие новости о растениях со всего интернета." },
  { icon: Trophy, title: "Достижения", text: "24 награды на четырёх уровнях — от «Ростка» до «Баобаба» — и серии дней ухода." },
];

const SHOWCASE = ["monstera-deliciosa", "goeppertia-orbifolia", "ficus-lyrata", "streptocarpus-ionanthus", "hoya-carnosa", "zamioculcas-zamiifolia"];

export default function Home() {
  const showcase = SHOWCASE.map((slug) => ALL_SPECIES.find((s) => s.slug === slug)!).filter(Boolean);
  return (
    <div className="min-h-dvh">
      <RedirectSignedIn />
      <header className="glass sticky top-0 z-30 border-b border-separator">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Logo />
          <nav className="flex items-center gap-5 text-[15px]">
            <Link href="/plants/" className="hidden text-secondary hover:text-label sm:inline">
              База знаний
            </Link>
            <Link href="/login/" className="font-semibold text-leaf">
              Войти
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 pt-16 pb-12 text-center sm:pt-24">
        <p className="text-[17px] font-semibold text-leaf">Подоконник</p>
        <h1 className="mx-auto mt-3 max-w-3xl text-[44px] leading-[1.05] font-bold tracking-tight sm:text-[64px]">
          Растения, которые живут долго.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[19px] text-secondary sm:text-[21px]">
          Напоминания о поливе, которые подстраиваются под сезон, горшок и ваши привычки. Советы по уходу и сообщество
          садоводов.
        </p>
        <HomeActions />
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-[20px] bg-surface p-6">
            <Icon className="size-7 text-leaf" aria-hidden />
            <h2 className="mt-4 text-[20px] font-semibold">{title}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-secondary">{text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-[28px] font-bold tracking-tight">Из базы знаний</h2>
          <Link href="/plants/" className="text-[15px] font-semibold text-leaf">
            Все {ALL_SPECIES.length} растений →
          </Link>
        </div>
        <div className="no-scrollbar mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
          {showcase.map((s) => (
            <Link key={s.slug} href={`/plants/${s.slug}/`} className="w-44 shrink-0 snap-start">
              <PlantPhoto src={s.image?.url} seed={s.slug} alt="" className="aspect-[4/5] w-full rounded-[20px]" iconSize={40} />
              <p className="mt-2 font-semibold">{speciesName(s)}</p>
              <p className="text-[13px] text-secondary italic">{s.latinName}</p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-separator py-8 text-center text-[13px] text-secondary">
        Подоконник · данные о растениях — открытые источники, распознавание — Pl@ntNet
      </footer>
    </div>
  );
}
