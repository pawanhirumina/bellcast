"use client";

import { Loader2, Send, SlidersHorizontal, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOnline } from "@/hooks/use-online";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { TOPIC_RE } from "@/lib/validation";
import { Button } from "./ui";

export function ChannelComposer({
  topic,
  onAdvanced,
}: {
  topic: string | null;
  onAdvanced: () => void;
}) {
  const online = useOnline();
  const [topicInput, setTopicInput] = useState("general");
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const target = (topic ?? topicInput).trim().toLowerCase();

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [value]);

  async function send() {
    if (sending || !value.trim()) return;
    if (!online) {
      setError("You're offline. Reconnect before sending a message.");
      return;
    }
    if (!TOPIC_RE.test(target)) {
      setError("Topics use lowercase letters, numbers, - or _.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const { message } = await api.publish(target, {
        body: value.trim(),
        priority: 3,
        tags: [],
      });
      const db = getDb();
      await db.messages.put(message);
      const existing = await db.topics.get(target);
      if (!existing || message.seq > existing.last_seq) {
        await db.topics.put({
          topic: target,
          last_seq: message.seq,
          last_message_at: message.created_at,
        });
      }
      setValue("");
      setSending(false);
      textarea.current?.focus();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.assign("/connect");
        return;
      }
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not send the message. Check your connection and try again.",
      );
      setSending(false);
    }
  }

  return (
    <div className="shrink-0 border-t border-line bg-surface px-3 pb-3 pt-2 sm:px-4">
      {error ? (
        <div
          role="alert"
          className="mb-2 flex items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-[12px] text-danger"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="rounded p-0.5 hover:bg-danger/10"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}

      <div
        className="rounded-md bg-raised transition-colors"
      >
        <textarea
          ref={textarea}
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          disabled={!online}
          placeholder={
            online
              ? `Message ${topic ? `#${topic}` : `#${target || "general"}`}`
              : "You're offline — reconnecting before you can send"
          }
          aria-label="Message"
          className="block max-h-40 w-full resize-none bg-transparent px-3 py-2.5 text-[14px] leading-6 text-ink placeholder:text-faint focus:outline-none disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-1 border-t border-line px-2 py-1.5">
          <button
            type="button"
            onClick={onAdvanced}
            className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            More options
          </button>

          {!topic ? (
            <label className="ml-1 inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[12px] text-muted">
              <span aria-hidden>#</span>
              <input
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                aria-label="Channel to publish to"
                spellCheck={false}
                className="w-24 bg-transparent text-ink focus:outline-none"
              />
            </label>
          ) : null}

          <span className="ml-auto hidden text-[11px] text-faint sm:block">
            Enter to send · Shift + Enter for a new line
          </span>
          <Button
            size="sm"
            onClick={() => void send()}
            disabled={sending || !value.trim() || !online}
            aria-label="Send message"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
