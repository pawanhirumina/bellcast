"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Loader2,
  MessageSquare,
  RefreshCw,
  SearchX,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { absoluteTime, relativeTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { useOrigin } from "@/hooks/use-origin";
import { ConfirmDialog } from "./confirm-dialog";
import { useSearch } from "./search-provider";
import { useSync } from "./sync-provider";
import { Button, cn } from "./ui";

type SelectionState = {
  topic: string | null;
  active: boolean;
  seqs: Set<number>;
};

const NO_SELECTION: ReadonlySet<number> = new Set();

function openExternal(url: string) {
  if (window.__BELLCAST__?.openExternal) {
    window.__BELLCAST__.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function getInitials(value: string) {
  return value.slice(0, 2).toUpperCase();
}

function avatarHue(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDayDivider(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function MessageRow({
  message,
  now,
  onDelete,
  onToggleSelect,
  selecting,
  selected,
  isFirstInGroup,
  showDayDivider,
  showTopic,
}: {
  message: Message;
  now: number;
  onDelete: (message: Message) => void;
  onToggleSelect: (message: Message) => void;
  selecting: boolean;
  selected: boolean;
  isFirstInGroup: boolean;
  showDayDivider: boolean;
  showTopic: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const high = message.priority >= 4;
  const urgent = message.priority === 5;
  const hue = avatarHue(message.topic);

  async function copyMessage() {
    const text = [message.title, message.body].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard can be unavailable on insecure origins.
    }
  }

  return (
    <>
      {showDayDivider ? (
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <span className="h-px flex-1 bg-line" aria-hidden />
          <span className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-muted">
            {formatDayDivider(message.created_at)}
          </span>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>
      ) : null}

      <div
        onClick={selecting ? () => onToggleSelect(message) : undefined}
        className={cn(
          "group relative flex gap-3 px-4 py-1.5 transition-colors hover:bg-hover sm:px-6",
          high && "bg-warn-soft hover:bg-warn-soft",
          !isFirstInGroup && "py-1",
          selecting && "cursor-pointer",
          selected && "bg-accent-soft hover:bg-accent-soft",
        )}
      >
        {selecting ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={
              selected
                ? "Deselect message"
                : `Select message from #${message.topic}`
            }
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelect(message);
            }}
            className="mt-0.5 flex h-6 w-5 shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                selected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line-strong bg-surface text-transparent",
              )}
            >
              <Check className="h-3 w-3" aria-hidden />
            </span>
          </button>
        ) : null}

        <div className="w-9 shrink-0 pt-0.5">
          {isFirstInGroup ? (
            <div
              style={{ "--avatar-h": hue } as CSSProperties}
              className="flex h-9 w-9 select-none items-center justify-center rounded text-[12px] font-bold text-white"
              aria-hidden
            >
              <span
                className="flex h-full w-full items-center justify-center rounded"
                style={{ background: "hsl(var(--avatar-h) 38% 34%)" }}
              >
                {getInitials(message.topic)}
              </span>
            </div>
          ) : (
            <span className="hidden pt-1 text-[10px] leading-4 text-faint group-hover:block">
              {formatTime(message.created_at)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isFirstInGroup ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[14px] font-bold leading-5 text-ink">
                {message.title || `#${message.topic}`}
              </span>
              {showTopic ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.location.assign(
                      `/app/t/${encodeURIComponent(message.topic)}`,
                    );
                  }}
                  className="rounded bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
                >
                  #{message.topic}
                </button>
              ) : null}
              {high ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold",
                    urgent
                      ? "bg-danger-soft text-danger"
                      : "bg-warn-soft text-warn",
                  )}
                >
                  {urgent ? "Max priority" : "High priority"}
                </span>
              ) : null}
              <span
                className="text-[11px] text-muted"
                title={absoluteTime(message.created_at)}
              >
                {formatTime(message.created_at)}
              </span>
              <span className="text-[11px] text-faint">
                {relativeTime(message.created_at, now)}
              </span>
            </div>
          ) : null}

          {message.body?.trim() ? (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-6 text-ink">
              {message.body}
            </p>
          ) : null}

          {message.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-line bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {message.click || message.actions?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-line-strong pl-3">
              {message.click ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openExternal(message.click!);
                  }}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-active hover:underline"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  Open link
                </button>
              ) : null}
              {message.actions?.map((action) => (
                <button
                  key={`${action.label}-${action.url}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openExternal(action.url);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-line-strong bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-hover"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {!selecting ? (
          <div className="absolute -top-3 right-3 hidden rounded-md border border-line bg-raised p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="rounded p-1.5 text-muted transition-colors hover:bg-hover hover:text-ink"
              aria-label={copied ? "Message copied" : "Copy message"}
              title="Copy message"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => onDelete(message)}
              className="rounded p-1.5 text-muted transition-colors hover:bg-hover hover:text-danger"
              aria-label="Delete message"
              title="Delete message"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        {high ? (
          <div
            className={cn(
              "absolute left-0 top-0 h-full w-0.5",
              urgent ? "bg-danger" : "bg-warn",
            )}
            aria-hidden
          />
        ) : null}
      </div>
    </>
  );
}

function EmptyState({
  topic,
  origin,
  query,
}: {
  topic: string | null;
  origin: string;
  query: string;
}) {
  const [copied, setCopied] = useState(false);
  const command = `curl -X POST ${origin}/api/v1/publish/${topic ?? "general"} \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Title: Hello from Bellcast" \\
  -d "It works."`;

  if (query) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
        <SearchX className="h-6 w-6 text-faint" aria-hidden />
        <h2 className="mt-3 text-[15px] font-bold text-ink">
          No messages match “{query}”
        </h2>
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
          Search covers titles, message text, channels and tags on this device.
        </p>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures.
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-6">
      <div className="flex items-start gap-3 border-b border-line pb-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-raised text-muted">
          <MessageSquare className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-[17px] font-bold text-ink">
            {topic ? `#${topic} is quiet` : "No notifications yet"}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            {topic
              ? "Publish to this channel and it will appear here immediately."
              : "Publish from curl, CI or the composer below. Channels are created automatically."}
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-line bg-code">
        <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
          <span className="text-[11px] font-semibold text-muted">Bash</span>
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-semibold text-muted hover:bg-hover hover:text-ink"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" aria-hidden />
            ) : (
              <Copy className="h-3 w-3" aria-hidden />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-6 text-ink">
          {command}
        </pre>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-faint">
        Replace <code className="font-mono text-muted">YOUR_API_KEY</code> with
        the key from your instance environment.
      </p>
    </div>
  );
}

export function MessageList({ topic }: { topic: string | null }) {
  const { status, error, retry } = useSync();
  const { query } = useSearch();
  const origin = useOrigin();
  const [now, setNow] = useState(() => Date.now());
  const [paging, setPaging] = useState<{
    topic: string | null;
    hasMore: boolean;
  }>({ topic, hasMore: true });
  const hasMore = paging.topic === topic ? paging.hasMore : true;
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>(() => ({
    topic,
    active: false,
    seqs: new Set(),
  }));
  const [pendingDelete, setPendingDelete] = useState<Message[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const messages = useLiveQuery(
    async () => {
      const db = getDb();
      if (!topic) {
        return db.messages.orderBy("seq").reverse().limit(200).toArray();
      }
      return db.messages
        .where("[topic+seq]")
        .between([topic, Dexie.minKey], [topic, Dexie.maxKey])
        .reverse()
        .limit(200)
        .toArray();
    },
    [topic],
    undefined,
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const chronological = useMemo(() => {
    if (!messages) return [];
    return [...messages].reverse();
  }, [messages]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return chronological;
    return chronological.filter((message) => {
      return (
        message.title?.toLowerCase().includes(needle) ||
        message.body.toLowerCase().includes(needle) ||
        message.topic.toLowerCase().includes(needle) ||
        message.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [chronological, query]);

  // Selection belongs to the channel it was started in, so navigating away
  // automatically hides it without needing an effect.
  const selectionCurrent = selection.topic === topic;
  const selecting = selectionCurrent && selection.active;
  const selected = selectionCurrent ? selection.seqs : NO_SELECTION;

  const selectedMessages = useMemo(
    () => filtered.filter((message) => selected.has(message.seq)),
    [filtered, selected],
  );
  const allSelected =
    filtered.length > 0 && selectedMessages.length === filtered.length;

  function toggleSelect(message: Message) {
    setSelection((current) => {
      const seqs = new Set(
        current.topic === topic && current.active ? current.seqs : [],
      );
      if (seqs.has(message.seq)) {
        seqs.delete(message.seq);
      } else {
        seqs.add(message.seq);
      }
      return { topic, active: true, seqs };
    });
  }

  function toggleSelectAll() {
    setSelection({
      topic,
      active: true,
      seqs: allSelected
        ? new Set()
        : new Set(filtered.map((message) => message.seq)),
    });
  }

  function cancelSelection() {
    setSelection({ topic, active: false, seqs: new Set() });
  }

  async function loadOlder() {
    if (!messages?.length || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const oldest = messages[messages.length - 1].seq;
      const page = await api.messages({
        topic: topic ?? undefined,
        before: oldest,
        limit: 100,
      });
      if (page.messages.length === 0) {
        setPaging({ topic, hasMore: false });
      } else {
        await getDb().messages.bulkPut(page.messages);
        setPaging({ topic, hasMore: page.hasMore });
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.assign("/connect");
        return;
      }
      setLoadError(
        "Couldn't load older messages. Check your connection and try again.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || pendingDelete.length === 0 || deleting) return;
    const targets = pendingDelete;
    setDeleting(true);
    setActionError(null);

    try {
      const results = await Promise.allSettled(
        targets.map((message) => api.deleteMessage(message.id)),
      );

      if (
        results.some(
          (result) =>
            result.status === "rejected" &&
            result.reason instanceof ApiError &&
            result.reason.status === 401,
        )
      ) {
        window.location.assign("/connect");
        return;
      }

      const deleted: Message[] = [];
      let failure: string | null = null;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          deleted.push(targets[index]);
          return;
        }
        // Already gone on the server; remove it locally too.
        if (result.reason instanceof ApiError && result.reason.status === 404) {
          deleted.push(targets[index]);
          return;
        }
        failure =
          result.reason instanceof ApiError
            ? result.reason.message
            : "Couldn't delete some messages. Try again.";
      });

      if (deleted.length > 0) {
        const db = getDb();
        const topics = new Set(deleted.map((message) => message.topic));
        await db.messages.bulkDelete(deleted.map((message) => message.seq));
        for (const affected of topics) {
          const remaining = await db.messages
            .where("[topic+seq]")
            .between([affected, Dexie.minKey], [affected, Dexie.maxKey])
            .reverse()
            .first();
          if (remaining) {
            await db.topics.put({
              topic: affected,
              last_seq: remaining.seq,
              last_message_at: remaining.created_at,
            });
          } else {
            await db.topics.delete(affected);
          }
        }

        setSelection((current) => {
          if (current.topic !== topic) return current;
          const seqs = new Set(current.seqs);
          for (const message of deleted) seqs.delete(message.seq);
          return {
            topic,
            active: seqs.size > 0 ? current.active : false,
            seqs,
          };
        });
      }

      if (failure) setActionError(failure);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.assign("/connect");
        return;
      }
      setActionError(
        caught instanceof ApiError
          ? caught.message
          : "Couldn't delete the message. Try again.",
      );
    } finally {
      setPendingDelete(null);
      setDeleting(false);
    }
  }

  if (messages === undefined) {
    return (
      <div className="px-4 py-4 sm:px-6" aria-busy="true" aria-label="Loading messages">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 animate-skeleton rounded bg-raised" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-28 animate-skeleton rounded bg-raised" />
                <div className="h-3 w-full max-w-md animate-skeleton rounded bg-raised" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!messages.length && (status === "error" || status === "offline")) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
        <WifiOff className="h-6 w-6 text-danger" aria-hidden />
        <h2 className="mt-3 text-[15px] font-bold text-ink">
          {status === "offline"
            ? "This device is offline"
            : "Can't reach your instance"}
        </h2>
        <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
          {error ?? "Cached messages will appear here once the connection is back."}
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
      </div>
    );
  }

  if (!messages.length) {
    return <EmptyState topic={topic} origin={origin} query={query} />;
  }

  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="sticky top-0 z-20 bg-surface">
        {actionError ? (
          <div
            role="alert"
            className="border-b border-danger/30 bg-danger-soft px-4 py-2 text-[12px] text-danger sm:px-6"
          >
            {actionError}
          </div>
        ) : null}

        {selecting ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-1.5 sm:px-6">
            <span className="text-[12px] font-semibold text-ink">
              {selectedMessages.length} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              disabled={filtered.length === 0}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              {allSelected ? "Clear all" : "Select all"}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={cancelSelection}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPendingDelete(selectedMessages)}
                disabled={selectedMessages.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end border-b border-line px-4 py-1 sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelection({ topic, active: true, seqs: new Set() })
              }
              disabled={filtered.length === 0}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Select
            </Button>
          </div>
        )}

        {query ? (
          <div className="border-b border-line px-4 py-2 text-[12px] text-muted sm:px-6">
            {filtered.length} result{filtered.length === 1 ? "" : "s"} for “
            {query}”
          </div>
        ) : null}
      </div>

      <div className="flex-1 py-2">
        {filtered.length === 0 ? (
          <EmptyState topic={topic} origin={origin} query={query} />
        ) : (
          filtered.map((message, index) => {
            const previous = filtered[index - 1];
            const sameDay =
              previous &&
              new Date(previous.created_at).toDateString() ===
                new Date(message.created_at).toDateString();
            const sameSender =
              previous &&
              !query &&
              previous.topic === message.topic &&
              previous.title === message.title &&
              new Date(message.created_at).getTime() -
                new Date(previous.created_at).getTime() <
                1000 * 60 * 5;
            return (
              <MessageRow
                key={message.seq}
                message={message}
                now={now}
                onDelete={(target) => setPendingDelete([target])}
                onToggleSelect={toggleSelect}
                selecting={selecting}
                selected={selected.has(message.seq)}
                isFirstInGroup={!sameSender}
                showDayDivider={!sameDay}
                showTopic={!topic}
              />
            );
          })
        )}

        {hasMore && !query ? (
          <div className="flex flex-col items-center gap-2 px-4 py-6 sm:px-6">
            {loadError ? (
              <p className="text-[12px] text-danger" role="alert">
                {loadError}
              </p>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={loadOlder}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Clock className="h-3.5 w-3.5" aria-hidden />
              )}
              {loadError ? "Retry older messages" : "Load older messages"}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null && pendingDelete.length > 0}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} messages?`
            : "Delete this message?"
        }
        description={
          pendingDelete && pendingDelete.length > 1
            ? "These messages will be removed for everyone. This can't be undone."
            : "This message will be removed for everyone. This can't be undone."
        }
        confirmLabel={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length}`
            : "Delete"
        }
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
