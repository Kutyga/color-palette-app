"use client";

/** Фото товара: своё из прайса или, если его нет, фото вида из базы знаний. */

import { PlantPhoto } from "@/components/ui";
import { catalogById } from "@/lib/catalog";

/** Фото товара: своё из каталога или фото вида. */
const productPhoto = (p: { imageUrl: string | null; speciesId: string | null }) =>
  p.imageUrl ?? catalogById(p.speciesId)?.image?.url ?? null;

export function ProductPhoto({
  product,
  className,
}: {
  product: { id: string; title: string; imageUrl: string | null; speciesId: string | null };
  className?: string;
}) {
  return <PlantPhoto src={productPhoto(product)} seed={product.id} alt={product.title} className={className} iconSize={32} />;
}
