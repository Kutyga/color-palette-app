"use client";

/**
 * Фото растений, подписи к фото с Wikimedia Commons и аватары.
 */

import { Leaf } from "lucide-react";
import { useState } from "react";
import { cx } from "./cx";

const GRADIENTS = [
  ["#a8e063", "#56ab2f"],
  ["#43cea2", "#185a9d"],
  ["#f6d365", "#fda085"],
  ["#89f7fe", "#66a6ff"],
  ["#d4fc79", "#96e6a1"],
  ["#fbc2eb", "#a6c1ee"],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Фото растения или мягкий градиент с листом, если фото ещё нет. */
export function PlantPhoto({
  src,
  seed,
  alt,
  className,
  iconSize = 32,
}: {
  src: string | null | undefined;
  seed: string;
  alt: string;
  className?: string;
  iconSize?: number;
}) {
  // Не загрузилось (нет сети, ссылка устарела) — показываем заглушку вместо «битой» картинки.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    // eslint-disable-next-line @next/next/no-img-element -- подписанные ссылки Storage, data URL и Wikimedia Commons
    return <img src={src} alt={alt} className={cx("object-cover", className)} loading="lazy" onError={() => setFailed(src)} />;
  }
  const [a, b] = GRADIENTS[hash(seed) % GRADIENTS.length];
  return (
    <div
      className={cx("grid place-items-center", className)}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      role="img"
      aria-label={alt}
    >
      <Leaf size={iconSize} className="text-white/85" strokeWidth={1.6} aria-hidden />
    </div>
  );
}

/** Подпись к фото с Wikimedia Commons — CC BY / CC BY-SA требуют указать автора и лицензию. */
export function PhotoCredit({
  image,
  className,
}: {
  image: { credit: string | null; license: string | null; sourceUrl: string | null };
  className?: string;
}) {
  const text = [image.credit ? `Фото: ${image.credit}` : "Фото", image.license, "Wikimedia Commons"].filter(Boolean).join(" · ");
  return image.sourceUrl ? (
    <a
      href={image.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cx("text-secondary hover:text-label text-[12px]", className)}
    >
      {text}
    </a>
  ) : (
    <span className={cx("text-secondary text-[12px]", className)}>{text}</span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const [a, b] = GRADIENTS[hash(name) % GRADIENTS.length];
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.42 }}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
