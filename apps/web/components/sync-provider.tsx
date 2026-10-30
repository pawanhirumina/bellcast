"use client";

/* eslint-disable react-hooks/set-state-in-effect -- browser-only initialisation */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Message } from "@/lib/types";
import { useOnline } from "@/hooks/use-online";

export type SyncStatus = "connecting" | "live" | "offline" | "error";

type SyncContextValue = {
  status: SyncStatus;
  cursor: number;
  error: string | null;
  retry: () => void;
};

const SyncContext = createContext<SyncContextValue>({
  status: "connecting",
  cursor: 0,
  error: null,
  retry: () => undefined,
});

export function useSync() {
  return useContext(SyncContext);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Can't reach your instance. Check your connection and try again.";
  }
  return "Live updates stopped after an unexpected error.";
}

function showNotifications(messages: Message[]) {
  const bridge = window.__BELLCAST__;
  for (const message of messages.slice(0, 3)) {
    const title = message.title || `#${message.topic}`;
    if (bridge?.notify) {
      bridge.notify({
        id: message.id,
        title,
        body: message.body,
        topic: message.topic,
        priority: message.priority,
        click: message.click,
      });
      continue;
    }
    if (typeof Notification === "undefined") continue;
    if (Notification.permission !== "granted" || !document.hidden) continue;
    try {
      new Notification(title, {
        body: message.body || undefined,
        tag: message.id,
      });
    } catch {
      // Some browsers disallow the constructor; ignore.
    }
  }
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const online = useOnline();
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!online) {
      setStatus("offline");
      setError("This device is offline. Showing messages saved on it.");
      return;
    }

    const db = getDb();
    let stopped = false;
    let controller: AbortController | null = null;

    setStatus("connecting");
    setError(null);

    async function bootstrap() {
      const [topics, page] = await Promise.all([
        api.topics(),
        api.messages({ limit: 100 }),
      ]);
      await db.transaction("rw", db.messages, db.topics, async () => {
        await db.topics.bulkPut(topics.topics);
        if (page.messages.length > 0) {
          await db.messages.bulkPut(page.messages);
        }
      });
      const max = page.messages.reduce(
        (value, message) => Math.max(value, message.seq),
        0,
      );
      await db.meta.put({ key: "cursor", value: max });
      return max;
    }

    async function persist(messages: Message[], notify: boolean) {
      await db.transaction("rw", db.messages, db.topics, async () => {
        await db.messages.bulkPut(messages);
        for (const message of messages) {
          const existing = await db.topics.get(message.topic);
          if (!existing || message.seq > existing.last_seq) {
            await db.topics.put({
              topic: message.topic,
              last_seq: message.seq,
              last_message_at: message.created_at,
            });
          }
        }
      });
      if (notify) showNotifications(messages);
    }

    async function run() {
      try {
        const stored = await db.meta.get("cursor");
        let since =
          typeof stored?.value === "number" && Number.isFinite(stored.value)
            ? stored.value
            : 0;

        if (since <= 0) {
          since = await bootstrap();
        } else {
          api
            .topics()
            .then((result) => db.topics.bulkPut(result.topics))
            .catch(() => undefined);
        }

        if (stopped) return;
        setCursor(since);
        setStatus("live");

        while (!stopped) {
          try {
            controller = new AbortController();
            const result = await api.sync(since, controller.signal, 25);

            if (result.reset) {
              await db.transaction(
                "rw",
                db.messages,
                db.topics,
                db.meta,
                async () => {
                  await db.messages.clear();
                  await db.topics.clear();
                  await db.meta.clear();
                },
              );
              since = await bootstrap();
              setCursor(since);
              continue;
            }

            if (result.messages.length > 0) {
              await persist(result.messages, true);
              since = result.cursor ?? since;
              await db.meta.put({ key: "cursor", value: since });
              setCursor(since);
            }
            setStatus("live");
            setError(null);
          } catch (caught) {
            if (stopped) return;
            if (caught instanceof ApiError && caught.status === 401) {
              window.location.assign("/connect");
              return;
            }
            if (caught instanceof DOMException && caught.name === "AbortError") {
              return;
            }
            const reachable = window.navigator.onLine;
            setStatus(reachable ? "error" : "offline");
            setError(
              reachable
                ? describeError(caught)
                : "This device is offline. Showing messages saved on it.",
            );
            await sleep(2500);
          }
        }
      } catch (caught) {
        if (stopped) return;
        if (caught instanceof ApiError && caught.status === 401) {
          window.location.assign("/connect");
          return;
        }
        console.error("[bellcast] sync bootstrap failed", caught);
        setStatus(window.navigator.onLine ? "error" : "offline");
        setError(
          window.navigator.onLine
            ? describeError(caught)
            : "This device is offline. Showing messages saved on it.",
        );
      }
    }

    void run();

    return () => {
      stopped = true;
      controller?.abort();
    };
  }, [attempt, online]);

  const value = useMemo(
    () => ({ status, cursor, error, retry }),
    [status, cursor, error, retry],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
