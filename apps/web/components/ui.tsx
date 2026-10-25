import clsx, { type ClassValue } from "clsx";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function cn(...values: ClassValue[]) {
  return clsx(values);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-white text-black hover:bg-zinc-200": variant === "primary",
          "border border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20 hover:bg-white/[0.06]":
            variant === "secondary",
          "text-zinc-400 hover:bg-white/5 hover:text-white": variant === "ghost",
          "border border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20":
            variant === "danger",
          "h-8 px-3 text-xs": size === "sm",
          "h-9 px-4 text-sm": size === "md",
          "h-9 w-9": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-white/10 bg-black px-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/10",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/10",
        className,
      )}
      {...props}
    />
  );
}

export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-xs font-medium text-zinc-400", className)}
      {...props}
    >
      {children}
    </label>
  );
}
