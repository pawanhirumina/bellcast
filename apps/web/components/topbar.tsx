"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Menu, Plus } from "lucide-react";
import { useState } from "react";
import { getDb } from "@/lib/db";
import { useSync } from "./sync-provider";
import { Button, cn } from "./ui";

export function Topbar({
  topic,
  isSettings,
  onMenu,
  onCompose,
}: {
  topic: string | null;
  isSettings: boolean;
  onMenu: () => void;
  onCompose: () => void;
}) {
  const { status } = useSync();
  const [copied, setCopied] = useState(false);

  const count = useLiveQuery(
    async () => {
      const db = getDb();
      return topic
        ? db.messages.where("topic").equals(topic).count()
        : db.messages.count();
    },
    [topic],
    0,
  );

  async function copyCurl() {
    const target = topic ?? "general";
    const command = [
      `curl -X POST ${window.location.origin}/api/v1/publish/${target} \\`,
      `  -H "X-API-Key: YOUR_API_KEY" \\`,
      `  -H "Title: Hello from Bellcast" \\`,
      `  -d "It works."`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard can be unavailable on http:// origins
    }
  }

  const title = isSettings
    ? "Settings"
    : topic
      ? `#${topic}`
      : "All messages";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-black/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenu}
          aria-label="Open topics"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
            {title}
          </h1>
          {!isSettings ? (
            <p className="text-[11px] text-zinc-600">
              {count ?? 0} notification{count === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] sm:flex",
            {
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-300":
                status === "live",
              "border-amber-500/20 bg-amber-500/10 text-amber-300":
                status === "connecting",
              "border-red-500/20 bg-red-500/10 text-red-300": status === "error",
            },
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", {
              "bg-emerald-400": status === "live",
              "bg-amber-400": status === "connecting",
              "bg-red-400": status === "error",
            })}
          />
          {status === "live"
            ? "Connected"
            : status === "error"
              ? "Reconnecting"
              : "Connecting"}
        </div>

        {!isSettings ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyCurl}
              title="Copy a curl command"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy curl"}
              </span>
            </Button>
            <Button size="sm" onClick={onCompose}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </>
        ) : null}
      </div>
    </header>
  );
}
