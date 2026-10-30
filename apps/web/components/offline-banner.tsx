"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { useSync } from "./sync-provider";

export function OfflineBanner() {
  const online = useOnline();
  const { status, error, retry } = useSync();

  if (online && (status === "live" || status === "connecting")) return null;
  if (!online) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warn/30 bg-warn-soft px-4 py-2 text-[12px] text-warn sm:px-6"
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-semibold">You&apos;re offline.</span>
        <span className="text-ink/80">
          Messages already on this device stay readable. New messages can&apos;t
          be sent until the connection returns.
        </span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-danger/30 bg-danger-soft px-4 py-2 text-[12px] text-danger sm:px-6"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="font-semibold">Can&apos;t reach your instance.</span>
      <span className="min-w-0 flex-1 truncate text-ink/80">
        {error ?? "Live updates are paused. Cached messages are still available."}
      </span>
      <button
        type="button"
        onClick={retry}
        className="inline-flex items-center gap-1 rounded border border-danger/40 px-2 py-0.5 font-semibold transition-colors hover:bg-danger/10"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Retry
      </button>
    </div>
  );
}
