"use client";

/** Список «Хочу»: кнопка на странице вида и карточка списка в профиле (уведомления о появлении и скидках). */

import { Heart } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/components/session";
import { Card, Spinner, cx, useToast } from "@/components/ui";
import { catalogById } from "@/lib/catalog";
import { speciesName } from "@/lib/domain/species";
import { useSetWished, useWishlist } from "@/lib/queries";

function WishButtonInner({ speciesId }: { speciesId: string }) {
  const wishlist = useWishlist();
  const set = useSetWished();
  const toast = useToast();
  const wanted = wishlist.data?.includes(speciesId) ?? false;
  return (
    <button
      type="button"
      aria-pressed={wanted}
      disabled={wishlist.isPending}
      onClick={() =>
        set.mutate(
          { speciesId, wanted: !wanted },
          {
            onSuccess: () => toast(wanted ? "Убрано из «Хочу»" : "Добавлено в «Хочу» — сообщим, когда появится в продаже или подешевеет"),
            onError: (e) => toast(`Не сохранилось: ${e.message}`),
          },
        )
      }
      className={cx(
        "inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[17px] font-semibold transition disabled:opacity-50",
        wanted ? "bg-alert/10 text-alert" : "bg-muted text-label hover:brightness-95",
      )}
    >
      <Heart className={cx("size-5", wanted && "fill-current")} aria-hidden /> {wanted ? "Хочу" : "Хочу купить"}
    </button>
  );
}

/** «Хочу купить» на странице вида; гостю — приглашение войти. */
export function WishButton({ speciesId }: { speciesId: string }) {
  const { session } = useSession();
  if (session.status === "loading") return null;
  if (session.status === "guest") {
    return (
      <Link href="/login/" className="bg-muted inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[17px] font-semibold">
        <Heart className="size-5" aria-hidden /> Хочу купить
      </Link>
    );
  }
  return <WishButtonInner speciesId={speciesId} />;
}

/** Список «Хочу» в профиле. */
export function WishlistCard() {
  const wishlist = useWishlist();
  const species = (wishlist.data ?? []).map((id) => catalogById(id)).filter((s) => s != null);
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Heart className="text-alert size-5" aria-hidden /> Хочу купить
      </p>
      {wishlist.isPending ? (
        <Spinner />
      ) : species.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Хочу купить">
          {species.map((s) => (
            <li key={s.id}>
              <Link
                href={`/plants/${s.slug}/`}
                className="bg-muted inline-flex rounded-full px-3 py-1.5 text-[13px] font-medium hover:brightness-95"
              >
                {speciesName(s)}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary mt-1 text-[15px]">
          Отмечайте «Хочу купить» на страницах растений в{" "}
          <Link href="/plants/" className="text-leaf font-medium">
            «Знаниях»
          </Link>{" "}
          — сообщим, когда растение появится в магазинах или подешевеет.
        </p>
      )}
    </Card>
  );
}
