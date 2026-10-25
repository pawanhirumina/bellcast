"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUpRight,
  BellOff,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  absoluteTime,
  priorityColor,
  priorityLabel,
  priorityTextColor,
  relativeTime,
} from "@/lib/format";
import type { Message } from "@/lib/types";
import { Button, cn } from "./ui";

function openExternal(url: string) {
  if (window.__BELLCAST__?.openExternal) {
    window.__BELLCAST__.openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function MessageCard({
  message,
  now,
  onDelete,
}: {
  message: Message;
  now: number;
  onDelete: (message: Message) => void;
}) {
  const high = message.priority >= 4;
  const label = priorityLabel(message.priority);
  const isEmptyBody = !message.body.trim();

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4 transition-colors hover:border-white/[0.16]">
      <span
        className={cn(
          "absolute inset-y-4 left-0 w-[2px] rounded-full",
          priorityColor(message.priority),
        )}
      />

      <div className="flex items-start justify-between gap-3 pl-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {message.title ? (
              <h3
                className={cn(
                  "text-sm font-medium text-zinc-100",
                  high && "text-white",
                )}
              >
                {message.title}
              </h3>
            ) : (
              <h3 className="font-mono text-xs text-zinc-500">
                #{message.topic}
              </h3>
            )}
            {label ? (
              <span
                className={cn(
                  "rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  priorityTextColor(message.priority),
                )}
              >
                {label}
              </span>
            ) : null}
          </div>

          {!isEmptyBody ? (
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">
              {message.body}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {message.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-500"
              >
                {tag}
              </span>
            ))}

            {message.click ? (
              <button
                type="button"
                onClick={() => openExternal(message.click!)}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                Open link
                <ArrowUpRight className="h-3 w-3" />
              </button>
            ) : null}

            {message.actions?.map((action) => (
              <button
                key={`${action.label}-${action.url}`}
                type="button"
                onClick={() => openExternal(action.url)}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                {action.label}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <time
            dateTime={message.created_at}
            title={absoluteTime(message.created_at)}
            className="whitespace-nowrap text-[11px] text-zinc-600"
          >
            {relativeTime(message.created_at, now)}
          </time>
          <button
            type="button"
            onClick={() => onDelete(message)}
            className="rounded-md p-1.5 text-zinc-700 opacity-0 transition hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
            aria-label="Delete notification"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function MessageList({ topic }: { topic: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const [origin, setOrigin] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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
    setHasMore(true);
  }, [topic]);

  useEffect(() => {
    setOrigin(window.location.origin);
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function loadOlder() {
    if (!messages || messages.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1].seq;
      const page = await api.messages({
        topic: topic ?? undefined,
        before: oldest,
        limit: 100,
      });
      if (page.messages.length === 0) {
        setHasMore(false);
      } else {
        await getDb().messages.bulkPut(page.messages);
        setHasMore(page.hasMore);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign("/connect");
      }
    } finally {
      setLoadingMore(false);
    }
  }

  async function deleteMessage(message: Message) {
    if (!window.confirm("Delete this notification?")) return;
    try {
      await api.deleteMessage(message.id);
      const db = getDb();
      await db.messages.delete(message.seq);
      const remaining = await db.messages
        .where("[topic+seq]")
        .between(
          [message.topic, Dexie.minKey],
          [message.topic, Dexie.maxKey],
        )
        .reverse()
        .first();
      if (remaining) {
        await db.topics.put({
          topic: message.topic,
          last_seq: remaining.seq,
          last_message_at: remaining.created_at,
        });
      } else {
        await db.topics.delete(message.topic);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign("/connect");
      }
    }
  }

  if (messages === undefined) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-600">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
          <BellOff className="h-5 w-5 text-zinc-500" strokeWidth={1.7} />
        </div>
        <h2 className="mt-4 text-sm font-medium text-zinc-200">
          No notifications yet
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
          Publish with curl, the compose button, or any script. Everything shows
          up here instantly.
        </p>
        <pre className="mt-5 w-full overflow-x-auto rounded-xl border border-white/[0.08] bg-zinc-950 p-4 text-left text-[11px] leading-5 text-zinc-400">
          {`curl -X POST ${origin}/api/v1/publish/general \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Title: Hello from Bellcast" \\
  -d "It works."`}
        </pre>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <div className="space-y-2.5">
        {messages.map((message) => (
          <MessageCard
            key={message.seq}
            message={message}
            now={now}
            onDelete={deleteMessage}
          />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadOlder}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Clock className="h-3.5 w-3.5" />
            )}
            Load older
          </Button>
        </div>
      ) : null}
    </div>
  );
}
