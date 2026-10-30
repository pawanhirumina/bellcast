"use client";

import { Check, Palette } from "lucide-react";
import { useEffect, useRef } from "react";
import { THEME_OPTIONS, type ThemeChoice } from "@/lib/theme";
import { useTheme } from "./theme-provider";
import { cn } from "./ui";

function Swatch({
  option,
}: {
  option: (typeof THEME_OPTIONS)[number];
}) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-9 shrink-0 overflow-hidden rounded-[4px] border border-line"
    >
      <span
        className="flex h-full w-1/2 items-end p-1"
        style={{ background: option.swatch.canvas }}
      >
        <span
          className="h-1.5 w-full rounded-full"
          style={{ background: option.swatch.accent }}
        />
      </span>
      <span
        className="h-full w-1/2"
        style={{ background: option.swatch.panel }}
      />
    </span>
  );
}

export function ThemeGrid({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme();

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {THEME_OPTIONS.map((option) => {
        const active = choice === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => setChoice(option.id)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
              active
                ? "border-active bg-mention"
                : "border-line hover:bg-hover",
            )}
          >
            <Swatch option={option} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">
                {option.label}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {option.note}
              </span>
            </span>
            {active ? (
              <Check className="h-4 w-4 shrink-0 text-active" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeMenu({ align = "left" }: { align?: "left" | "right" }) {
  const { choice, setChoice } = useTheme();
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!details.current?.open) return;
      if (details.current.contains(event.target as Node)) return;
      details.current.open = false;
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function pick(id: ThemeChoice) {
    setChoice(id);
    if (details.current) details.current.open = false;
  }

  return (
    <details ref={details} className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink [&::-webkit-details-marker]:hidden">
        <Palette className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Theme</span>
      </summary>
      <div
        className={cn(
          "absolute bottom-full z-50 mb-2 w-64 rounded-lg border border-line bg-raised p-1.5 shadow-xl",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-faint">
          Appearance
        </p>
        {THEME_OPTIONS.map((option) => {
          const active = choice === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => pick(option.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-[13px] transition-colors",
                active
                  ? "bg-active text-active-ink"
                  : "text-ink hover:bg-hover",
              )}
            >
              <Swatch option={option} />
              <span className="flex-1">{option.label}</span>
              {active ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
