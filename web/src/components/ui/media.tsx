"use client";

/**
 * Фото растений, подписи к фото с Wikimedia Commons и аватары.
 */

import { Leaf } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "./cx";
import { PhotoViewer } from "./photo-viewer";

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

/** sizes для крупного фото во всю ширину карточки (страница растения, объявления, розыгрыша). */
export const LARGE_PHOTO = "(max-width: 720px) 100vw, 720px";

/** Стандартные ширины миниатюр Wikimedia Commons (другие ширины сервер отдаёт медленнее). */
const WIKIMEDIA_WIDTHS = [250, 500, 960];
const WIKIMEDIA_THUMB = /^(https:\/\/[a-z]+\.wikimedia\.org\/.+\/thumb\/.+\/)\d+px-([^/]+)$/;
/** Ссылка на оригинал файла (без /thumb/) — у небольших фото с Commons другой миниатюры нет. */
const WIKIMEDIA_ORIGINAL = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)([0-9a-f]\/[0-9a-f]{2}\/)([^/]+)$/;

/** Для фото с Wikimedia — набор копий разной ширины, чтобы в списках не грузить большие картинки. */
function wikimediaSrcSet(src: string): string | undefined {
  const m = WIKIMEDIA_THUMB.exec(src);
  if (m) return WIKIMEDIA_WIDTHS.map((w) => `${m[1]}${w}px-${m[2]} ${w}w`).join(", ");
  const o = WIKIMEDIA_ORIGINAL.exec(src);
  // Самую большую копию не просим: оригинал может быть уже 960 px — тогда берём его самого.
  return o ? [`${o[1]}thumb/${o[2]}${o[3]}/250px-${o[3]} 250w`, `${src} 960w`].join(", ") : undefined;
}

/** Фото, которое открывается на весь экран по нажатию (с приближением и листанием gallery). */
function Zoomable({
  src,
  gallery,
  alt,
  className,
  children,
}: {
  src: string;
  gallery?: string[];
  alt: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const urls = gallery?.length ? gallery : [src];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Открыть фото: ${alt}`}
        className={cx("block cursor-zoom-in", className)}
      >
        {children}
      </button>
      {open && <PhotoViewer urls={urls} start={Math.max(0, urls.indexOf(src))} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Фото растения или мягкий градиент с листом, если фото ещё нет. В списках фото заполняет
 * рамку (края обрезаются); с whole — показывается целиком, свободное место — размытая копия.
 * Крупное фото (whole) или с zoom открывается на весь экран по нажатию.
 */
export function PlantPhoto({
  src,
  seed,
  alt,
  className,
  iconSize = 32,
  sizes = "240px",
  whole = false,
  zoom = whole,
  gallery,
}: {
  src: string | null | undefined;
  seed: string;
  alt: string;
  className?: string;
  iconSize?: number;
  /** Ширина картинки на экране (атрибут sizes): по ней браузер выбирает копию нужного размера. */
  sizes?: string;
  /** Показать фото целиком, без обрезки (крупные фото: карточка растения, объявление, пост). */
  whole?: boolean;
  /** Открывать на весь экран по нажатию (по умолчанию — у крупных фото, whole). */
  zoom?: boolean;
  /** Все фото записи — в полноэкранном просмотре их можно листать. */
  gallery?: string[];
}) {
  // Не загрузилось (нет сети, ссылка устарела) — показываем заглушку вместо «битой» картинки.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    const srcSet = wikimediaSrcSet(src);
    if (whole) {
      const photo = (
        <div className={cx("bg-muted relative overflow-hidden", zoom ? "size-full" : className)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- фон из той же картинки (браузер берёт её из кэша) */}
          <img
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full scale-110 object-cover opacity-50 blur-2xl"
            loading="lazy"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- подписанные ссылки Storage, data URL и Wikimedia Commons */}
          <img
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            alt={alt}
            className="relative size-full object-contain"
            loading="lazy"
            decoding="async"
            onError={() => setFailed(src)}
          />
        </div>
      );
      return zoom ? (
        <Zoomable src={src} gallery={gallery} alt={alt} className={className}>
          {photo}
        </Zoomable>
      ) : (
        photo
      );
    }
    const img = (
      // eslint-disable-next-line @next/next/no-img-element -- подписанные ссылки Storage, data URL и Wikimedia Commons
      <img
        src={src}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        className={cx("object-cover", zoom ? "size-full" : className)}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(src)}
      />
    );
    return zoom ? (
      <Zoomable src={src} gallery={gallery} alt={alt} className={cx("overflow-hidden", className)}>
        {img}
      </Zoomable>
    ) : (
      img
    );
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
