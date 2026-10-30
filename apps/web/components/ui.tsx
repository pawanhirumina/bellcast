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
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50",
        {
          "bg-accent text-accent-ink hover:opacity-90": variant === "primary",
          "border border-line-strong bg-surface text-ink hover:bg-hover":
            variant === "secondary",
          "text-muted hover:bg-hover hover:text-ink": variant === "ghost",
          "border border-danger/40 bg-danger-soft text-danger hover:bg-danger/15":
            variant === "danger",
          "h-8 px-3 text-[12px]": size === "sm",
          "h-9 px-3.5 text-[13px]": size === "md",
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
        "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-[13px] text-ink placeholder:text-faint transition-colors focus:border-focus focus:outline-none",
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
        "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-[14px] leading-6 text-ink placeholder:text-faint transition-colors focus:border-focus focus:outline-none",
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
      className={cn("mb-1.5 block text-[12px] font-medium text-muted", className)}
      {...props}
    >
      {children}
    </label>
  );
}
