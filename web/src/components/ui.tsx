"use client";

import {
  Bug,
  Droplet,
  FlaskConical,
  Leaf,
  Loader2,
  RotateCw,
  Scissors,
  Shovel,
  Sparkles,
  SprayCan,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import type { CareType } from "@/lib/domain/care";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const CARE_ICONS: Record<CareType, LucideIcon> = {
  water: Droplet,
  fertilize: FlaskConical,
  mist: SprayCan,
  repot: Shovel,
  prune: Scissors,
  rotate: RotateCw,
  clean_leaves: Sparkles,
  treat_pests: Bug,
};

/** Цвет вида ухода: полив — вода, подкормка и пересадка — почва, опрыскивание — туман. */
export const CARE_COLORS: Record<CareType, string> = {
  water: "var(--water)",
  fertilize: "var(--soil)",
  mist: "var(--mist)",
  repot: "var(--soil)",
  prune: "var(--leaf)",
  rotate: "var(--leaf)",
  clean_leaves: "var(--mist)",
  treat_pests: "var(--alert)",
};

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const styles: Record<Variant, string> = {
    primary: "bg-leaf text-white hover:brightness-110",
    secondary: "bg-muted text-label hover:brightness-95",
    ghost: "text-leaf hover:bg-muted",
    danger: "text-alert hover:bg-muted",
  };
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.97] disabled:opacity-50",
        styles[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-[20px] bg-surface", className)}>{children}</div>;
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition",
        active ? "bg-label text-bg" : "bg-muted text-label hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}

/** Кольцо прогресса как в Apple Fitness. */
export function ProgressRing({
  progress,
  color = "var(--leaf)",
  size = 64,
  stroke = 8,
  children,
  label,
}: {
  progress: number;
  color?: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

/**
 * Несколько колец одно в другом (как «Активность» в iOS). Все рисуются в одном SVG от одного
 * центра, поэтому всегда строго концентричны и одной толщины.
 */
export function ActivityRings({
  rings,
  size = 88,
  stroke = 10,
  gap = 3,
}: {
  rings: { progress: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  gap?: number;
}) {
  const center = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="block shrink-0"
      role="img"
      aria-label={rings.map((r) => `${r.label}: ${Math.round(Math.max(0, Math.min(1, r.progress)) * 100)}%`).join(", ")}
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        {rings.map((ring, i) => {
          const r = center - stroke / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(1, ring.progress));
          return (
            <g key={ring.label}>
              <circle cx={center} cy={center} r={r} fill="none" stroke={ring.color} strokeOpacity={0.18} strokeWidth={stroke} />
              <circle
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - p)}
                style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

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
    <div className={cx("grid place-items-center", className)} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} role="img" aria-label={alt}>
      <Leaf size={iconSize} className="text-white/85" strokeWidth={1.6} aria-hidden />
    </div>
  );
}

/** Подпись к фото с Wikimedia Commons — CC BY / CC BY-SA требуют указать автора и лицензию. */
export function PhotoCredit({ image, className }: { image: { credit: string | null; license: string | null; sourceUrl: string | null }; className?: string }) {
  const text = [image.credit ? `Фото: ${image.credit}` : "Фото", image.license, "Wikimedia Commons"].filter(Boolean).join(" · ");
  return image.sourceUrl ? (
    <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className={cx("text-[12px] text-secondary hover:text-label", className)}>
      {text}
    </a>
  ) : (
    <span className={cx("text-[12px] text-secondary", className)}>{text}</span>
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

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-20 place-items-center rounded-full bg-muted">
        <Icon className="size-9 text-leaf" strokeWidth={1.6} aria-hidden />
      </div>
      <h2 className="text-[20px] font-semibold">{title}</h2>
      {message && <p className="mt-2 max-w-sm text-[15px] text-secondary">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className="grid place-items-center py-16 text-secondary" role="status">
      <Loader2 className="size-7 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="mx-auto my-10 max-w-md rounded-[20px] bg-surface p-6 text-center" role="alert">
      <p className="font-semibold">Не удалось загрузить</p>
      <p className="mt-1 text-[15px] text-secondary">{error instanceof Error ? error.message : String(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pt-6 pb-4">
      <div>
        {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-wide text-secondary first-letter:uppercase">{eyebrow}</p>}
        <h1 className="large-title">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between">
      <h2 className="text-[20px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Модальное окно: снизу на телефоне (как лист iOS), по центру на компьютере. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-label backdrop:bg-black/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-[28px]"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col animate-slide-up">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="text-[20px] font-semibold">{title}</h2>
            <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-muted" aria-label="Закрыть">
              <X className="size-4" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 pb-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}

interface Toast {
  id: number;
  text: string;
}
const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-slide-up rounded-full bg-label px-5 py-3 text-[15px] font-medium text-bg shadow-lg">
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Подпись поля. group — для набора кнопок или составного поля: <label> вокруг них ломает их названия. */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="mb-1.5 block text-[13px] font-medium text-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-secondary">{hint}</span>}
    </Tag>
  );
}

export const inputClass =
  "w-full rounded-xl bg-muted px-4 py-3 text-[17px] text-label outline-none placeholder:text-secondary focus:ring-2 focus:ring-leaf";

const noopSubscribe = () => () => {};

/** true только в браузере: даты и «сейчас» не должны попадать в заранее собранный HTML. */
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
