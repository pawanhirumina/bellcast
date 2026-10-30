"use client";

import { Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOnline } from "@/hooks/use-online";
import { api, ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Priority } from "@/lib/types";
import { Button, Input, Label, Textarea } from "./ui";

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 1, label: "Min" },
  { value: 2, label: "Low" },
  { value: 3, label: "Default" },
  { value: 4, label: "High" },
  { value: 5, label: "Max" },
];

export function Composer({
  defaultTopic,
  onClose,
}: {
  defaultTopic: string;
  onClose: () => void;
}) {
  const online = useOnline();
  const [topic, setTopic] = useState(defaultTopic);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>(3);
  const [tags, setTags] = useState("");
  const [click, setClick] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send() {
    if (loading) return;
    if (!online) {
      setError("You're offline. Reconnect before publishing.");
      return;
    }
    if (!body.trim() && !title.trim()) {
      setError("Add a message or a title.");
      return;
    }

    const normalizedTopic = topic.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalizedTopic)) {
      setError("Topic must use lowercase letters, numbers, - or _.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { message } = await api.publish(normalizedTopic, {
        title: title.trim() || undefined,
        body: body.trim(),
        priority,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        click: click.trim() || undefined,
      });

      const db = getDb();
      await db.messages.put(message);
      const existing = await db.topics.get(normalizedTopic);
      if (!existing || message.seq > existing.last_seq) {
        await db.topics.put({
          topic: normalizedTopic,
          last_seq: message.seq,
          last_message_at: message.created_at,
        });
      }
      onClose();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 401) {
        window.location.assign("/connect");
        return;
      }
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Could not send the notification. Check your connection.",
      );
      setLoading(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    void send();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
        className="animate-in relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2
              id="composer-title"
              className="text-[14px] font-bold text-ink"
            >
              New notification
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Publish to any channel. New channels are created automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-3.5 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="topic">Channel</Label>
              <Input
                id="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="alerts"
                className="font-mono text-[12px]"
                spellCheck={false}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(Number(event.target.value) as Priority)
                }
                className="h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-[13px] text-ink focus:border-focus focus:outline-none"
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Backup completed"
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Backup completed successfully."
              rows={4}
              maxLength={65536}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="backup, success"
            />
          </div>

          <div>
            <Label htmlFor="click">Click URL (optional)</Label>
            <Input
              id="click"
              value={click}
              onChange={(event) => setClick(event.target.value)}
              placeholder="https://dashboard.example.com"
              type="url"
            />
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger/30 bg-danger-soft px-2.5 py-2 text-[12px] text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !online}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-3.5 w-3.5" aria-hidden />
              )}
              {loading ? "Sending" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
