"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  BellRing,
  ChevronDown,
  Hash,
  Inbox,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDb } from "@/lib/db";
import { useSync } from "./sync-provider";
import { ThemeMenu } from "./theme-switcher";
import { cn } from "./ui";

export function Sidebar({
  onCompose,
  onNavigate,
}: {
  onCompose: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { status, retry } = useSync();

  const topics = useLiveQuery(
    () => getDb().topics.orderBy("last_seq").reverse().toArray(),
    [],
    [],
  );

  const activeTopic = pathname.startsWith("/app/t/")
    ? decodeURIComponent(pathname.split("/")[3] ?? "")
    : null;

  const statusLabel =
    status === "live"
      ? "Connected"
      : status === "error"
        ? "Connection lost"
        : status === "offline"
          ? "Offline"
          : "Connecting";

  return (
    <aside className="flex h-full w-full flex-col border-r border-line bg-sidebar">
      <div className="flex h-14 items-center border-b border-line px-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded px-1 py-1 transition-colors hover:bg-hover"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-accent-ink">
            <BellRing className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-tight text-ink">
              Bellcast
            </span>
            <span className="block truncate text-[11px] leading-tight text-muted">
              self-hosted
            </span>
          </span>
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted" aria-hidden />
        </Link>
      </div>

      <div className="px-3 pb-2 pt-3">
        <button
          type="button"
          onClick={onCompose}
          className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-accent text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New notification
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded px-2 py-1.5 text-[14px] transition-colors",
            pathname === "/app"
              ? "bg-active text-active-ink"
              : "text-muted hover:bg-hover hover:text-ink",
          )}
        >
          <Inbox className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">Activity</span>
        </Link>

        <div className="mt-4 flex items-center justify-between px-2 pb-1">
          <span className="text-[12px] font-semibold text-muted">Channels</span>
          <button
            type="button"
            onClick={onCompose}
            aria-label="Create a channel by publishing a notification"
            className="rounded p-0.5 text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="space-y-px">
          {topics.length === 0 ? (
            <p className="px-2 py-2 text-[12px] leading-5 text-faint">
              Channels appear after the first notification lands.
            </p>
          ) : (
            topics.map((topic) => {
              const active = activeTopic === topic.topic;
              return (
                <Link
                  key={topic.topic}
                  href={`/app/t/${encodeURIComponent(topic.topic)}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-[14px] transition-colors",
                    active
                      ? "bg-active text-active-ink"
                      : "text-muted hover:bg-hover hover:text-ink",
                  )}
                >
                  <Hash
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active ? "opacity-90" : "opacity-60",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{topic.topic}</span>
                </Link>
              );
            })
          )}
        </div>
      </nav>

      <div className="border-t border-line p-2">
        <div className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", {
              "bg-success": status === "live",
              "bg-warn": status === "connecting" || status === "offline",
              "bg-danger": status === "error",
            })}
            aria-hidden
          />
          <span className="truncate">{statusLabel}</span>
          {status === "error" ? (
            <button
              type="button"
              onClick={retry}
              className="ml-auto inline-flex items-center gap-1 rounded px-1 py-0.5 font-semibold text-ink hover:bg-hover"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          ) : null}
        </div>

        <div className="mt-1 flex items-center justify-between gap-1">
          <Link
            href="/app/settings"
            onClick={onNavigate}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors",
              pathname === "/app/settings"
                ? "bg-active text-active-ink"
                : "text-muted hover:bg-hover hover:text-ink",
            )}
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">Preferences</span>
          </Link>
          <ThemeMenu />
        </div>

        <div className="mt-1 flex items-center gap-2 rounded px-2 py-1.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-raised text-[11px] font-bold text-ink">
            P
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">
              Owner
            </span>
            <span className="block truncate text-[10px] text-faint">
              API key session
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
