"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Message } from "@/lib/types";

type SyncStatus = "connecting" | "live" | "error";

type SyncContextValue = {
  status: SyncStatus;
  cursor: number;
};

const SyncContext = createContext<SyncContextValue>({
  status: "connecting",
  cursor: 0,
});

export function useSync() {
  return useContext(SyncContext);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const db = getDb();
    let stopped = false;
    let controller: AbortController | null = null;

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
          } catch (error) {
            if (stopped) return;
            if (error instanceof ApiError && error.status === 401) {
              window.location.assign("/connect");
              return;
            }
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            setStatus("error");
            await sleep(2000);
          }
        }
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiError && error.status === 401) {
          window.location.assign("/connect");
          return;
        }
        console.error("[bellcast] sync bootstrap failed", error);
        setStatus("error");
      }
    }

    void run();

    return () => {
      stopped = true;
      controller?.abort();
    };
  }, []);

  const value = useMemo(() => ({ status, cursor }), [status, cursor]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
