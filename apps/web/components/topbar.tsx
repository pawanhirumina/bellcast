"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Menu, Plus, Search, X } from "lucide-react";
import { useEffect } from "react";
import { getDb } from "@/lib/db";
import { useSearch } from "./search-provider";
import { Button } from "./ui";

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
  const { query, setQuery } = useSearch();

  useEffect(() => {
    setQuery("");
  }, [topic, isSettings, setQuery]);

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

  const title = isSettings
    ? "Preferences"
    : topic
      ? `#${topic}`
      : "Activity";
  const subtitle = isSettings
    ? "Workspace, notifications and local cache"
    : topic
      ? "Everything published to this channel"
      : "Every notification across your channels";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenu}
        aria-label="Open channels"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </Button>

      <div className="min-w-0 shrink">
        <h1 className="truncate text-[15px] font-bold leading-tight text-ink">
          {topic ? <span className="text-muted">#</span> : null}
          {topic ?? title}
        </h1>
        <p className="hidden truncate text-[11px] leading-tight text-muted sm:block">
          {subtitle}
          {!isSettings ? (
            <span className="text-faint">
              {" "}
              · {count ?? 0} message{count === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>
      </div>

      {!isSettings ? (
        <div className="relative ml-auto hidden w-full max-w-xs items-center md:flex">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
            className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-8 text-[13px] text-ink placeholder:text-faint focus:border-focus focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1 rounded p-1 text-muted hover:bg-hover hover:text-ink"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="ml-auto" />
      )}

      <div className="flex items-center gap-1">
        {!isSettings ? (
          <Button size="sm" onClick={onCompose}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">New</span>
          </Button>
        ) : null}
      </div>

      {!isSettings ? (
        <div className="relative flex w-full items-center md:hidden">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search messages"
            className="h-8 w-full rounded-md border border-line-strong bg-surface pl-8 pr-3 text-[13px] text-ink placeholder:text-faint focus:border-focus focus:outline-none"
          />
        </div>
      ) : null}
    </header>
  );
}
