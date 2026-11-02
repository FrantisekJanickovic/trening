"use client";

import { Loader2, Volume2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "sun" | "ghost" | "outline" | "danger" | "leaf";
type Size = "sm" | "md" | "lg" | "xl";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  const v = {
    primary: "bg-ink text-white hover:bg-ink-soft border-b-4 border-[#0f1640] active:border-b-2 active:translate-y-[2px]",
    sun: "bg-sun text-ink hover:brightness-105 border-b-4 border-sun-deep active:border-b-2 active:translate-y-[2px]",
    leaf: "bg-leaf text-white hover:brightness-105 border-b-4 border-[#157049] active:border-b-2 active:translate-y-[2px]",
    ghost: "bg-transparent text-ink hover:bg-ink/5",
    outline: "bg-card text-ink border-2 border-line hover:border-mist",
    danger: "bg-card text-tomato border-2 border-tomato/30 hover:bg-tomato-soft",
  }[variant];
  const sz = {
    sm: "h-9 px-3 text-sm rounded-xl",
    md: "h-11 px-4 text-base rounded-xl",
    lg: "h-14 px-6 text-lg rounded-2xl",
    xl: "h-16 px-6 text-xl rounded-2xl w-full",
  }[size];
  return cx(
    "inline-flex items-center justify-center gap-2 font-bold transition-[transform,background,filter] select-none disabled:opacity-50 disabled:pointer-events-none",
    v,
    sz,
    extra,
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-3xl bg-card border border-line", className)}>{children}</div>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-ink-soft mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate mt-1">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full h-11 rounded-xl border-2 border-line bg-card px-3 text-base font-semibold text-ink placeholder:text-mist placeholder:font-normal focus:border-sky outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-xl border-2 border-line bg-card px-3 py-2 text-base text-ink placeholder:text-mist focus:border-sky outline-none",
        className,
      )}
      {...rest}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left py-2">
      <span className={cx("mt-0.5 relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-leaf" : "bg-line")}>
        <span className={cx("absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-ink">{label}</span>
        {description && <span className="block text-sm text-slate leading-snug mt-0.5">{description}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cx("inline-flex flex-wrap gap-1 rounded-2xl bg-paper p-1 border border-line", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "px-3 h-9 rounded-xl text-sm font-bold transition-colors",
            value === o.value ? "bg-card text-ink shadow-sm border border-line" : "text-slate hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate">
      <Loader2 className="size-5 animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function SpeakButton({ onClick, size = "md", label = "Prehrať" }: { onClick: () => void; size?: "sm" | "md" | "lg"; label?: string }) {
  const s = { sm: "size-9", md: "size-11", lg: "size-14" }[size];
  const i = { sm: "size-4", md: "size-5", lg: "size-7" }[size];
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(s, "inline-flex items-center justify-center rounded-full bg-sky-soft text-sky hover:bg-sky hover:text-white transition-colors shrink-0")}
    >
      <Volume2 className={i} />
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-tomato-soft text-tomato px-3 py-2 text-sm font-semibold">{children}</div>;
}
