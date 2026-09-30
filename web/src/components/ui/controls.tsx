"use client";

/**
 * Кнопки, карточки, чипы и поля ввода.
 */

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

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
    // type приходит в rest: submit у кнопок формы, button — у остальных.
    // eslint-disable-next-line react/button-has-type
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
  return <div className={cx("bg-surface rounded-[20px]", className)}>{children}</div>;
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition",
        active ? "bg-leaf text-white" : "bg-muted text-label hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}

/** Подпись поля. group — для набора кнопок или составного поля: <label> вокруг них ломает их названия. */
export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className="block" {...(group ? { role: "group", "aria-label": label } : {})}>
      <span className="text-secondary mb-1.5 block text-[13px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-secondary mt-1 block text-[13px]">{hint}</span>}
    </Tag>
  );
}

export const inputClass =
  "w-full rounded-xl bg-muted px-4 py-3 text-[17px] text-label outline-none placeholder:text-secondary focus:ring-2 focus:ring-leaf";
