"use client";

import { Loader2, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Could not send the notification.",
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
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-in relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              New notification
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Publish to any topic. New topics are created automatically.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="alerts"
              className="font-mono text-[13px]"
              spellCheck={false}
            />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                value={priority}
                onChange={(event) =>
                  setPriority(Number(event.target.value) as Priority)
                }
                className="h-10 w-full rounded-lg border border-white/10 bg-black px-3 text-sm text-zinc-200 focus:border-white/25 focus:outline-none"
              >
                {PRIORITIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
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
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
