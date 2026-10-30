"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button } from "./ui";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => {
          if (!busy) onCancel();
        }}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="animate-in relative w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={
              tone === "danger"
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
            }
          >
            <TriangleAlert className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-[14px] font-bold text-ink"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-description"
              className="mt-1 text-[13px] leading-5 text-muted"
            >
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-4 py-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            autoFocus
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
