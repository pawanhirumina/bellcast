"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  BellRing,
  Hash,
  Inbox,
  Plus,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDb } from "@/lib/db";
import { useSync } from "./sync-provider";
import { Button, cn } from "./ui";

export function Sidebar({
  onCompose,
  onNavigate,
}: {
  onCompose: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { status } = useSync();

  const topics = useLiveQuery(
    () => getDb().topics.orderBy("last_seq").reverse().toArray(),
    [],
    [],
  );

  const activeTopic = pathname.startsWith("/app/t/")
    ? decodeURIComponent(pathname.split("/")[3] ?? "")
    : null;

  const statusLabel =
    status === "live" ? "Live" : status === "error" ? "Offline" : "Connecting";

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.08] bg-black">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
        <Link
          href="/app"
          onClick={onNavigate}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
            <BellRing className="h-4 w-4 text-white" strokeWidth={1.8} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            Bellcast
          </span>
        </Link>
      </div>

      <div className="p-3">
        <Button onClick={onCompose} className="w-full">
          <Plus className="h-4 w-4" />
          New notification
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <Link
          href="/app"
          onClick={onNavigate}
          className={cn(
            "mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/app"
              ? "bg-white/[0.07] text-white"
              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
          )}
        >
          <Inbox className="h-4 w-4" />
          All messages
        </Link>

        <div className="mt-5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          Topics
        </div>

        <div className="mt-1.5 space-y-0.5">
          {topics.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-5 text-zinc-600">
              Topics appear after the first notification.
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
                    "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-white/[0.07] text-white"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
                  )}
                >
                  <Hash
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      active ? "text-zinc-300" : "text-zinc-600",
                    )}
                  />
                  <span className="truncate">{topic.topic}</span>
                </Link>
              );
            })
          )}
        </div>
      </nav>

      <div className="border-t border-white/[0.06] p-2">
        <Link
          href="/app/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/app/settings"
              ? "bg-white/[0.07] text-white"
              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-600">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", {
              "bg-emerald-400": status === "live",
              "bg-amber-400": status === "connecting",
              "bg-red-400": status === "error",
            })}
          />
          {statusLabel}
        </div>
      </div>
    </aside>
  );
}
