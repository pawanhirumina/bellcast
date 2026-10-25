import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Message,
  MessagePage,
  PublishInput,
  SyncResult,
  TopicSummary,
} from "../types";
import type { MessageQuery, Store, SyncQuery } from "./types";

type StoredMessage = Message & { idempotency_key: string };

type State = {
  version: 1;
  seq: number;
  messages: StoredMessage[];
};

const EMPTY: State = { version: 1, seq: 0, messages: [] };

function strip(row: StoredMessage): Message {
  const { idempotency_key: _key, ...message } = row;
  return message;
}

/**
 * Local development store. Single process, single tenant, JSON on disk.
 * Never used in production: see lib/store/index.ts.
 */
export class FileStore implements Store {
  private readonly file: string;
  private state: State | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor() {
    const dir = process.env.BELLCAST_DATA_DIR
      ? path.resolve(process.env.BELLCAST_DATA_DIR)
      : path.join(process.cwd(), ".data");
    this.file = path.join(dir, "bellcast.json");
  }

  private async ensure() {
    if (this.state) return;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as State;
      this.state =
        parsed && Array.isArray(parsed.messages)
          ? { ...parsed, version: 1 }
          : { ...EMPTY };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        console.warn("[bellcast] could not read dev store, starting empty", error);
      }
      this.state = { ...EMPTY };
    }
  }

  private async save() {
    if (!this.state) return;
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.state, null, 2), "utf8");
    await rename(tmp, this.file);
  }

  private async mutate<T>(fn: (state: State) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      await this.ensure();
      const result = await fn(this.state as State);
      await this.save();
      return result;
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async publish(input: PublishInput): Promise<Message> {
    return this.mutate((state) => {
      const existing = state.messages.find(
        (message) =>
          message.topic === input.topic &&
          message.idempotency_key === input.idempotencyKey,
      );
      if (existing) return strip(existing);

      state.seq += 1;
      const row: StoredMessage = {
        id: randomUUID(),
        seq: state.seq,
        topic: input.topic,
        title: input.title,
        body: input.body,
        priority: input.priority,
        tags: input.tags,
        click: input.click,
        actions: input.actions,
        created_at: new Date().toISOString(),
        idempotency_key: input.idempotencyKey,
      };
      state.messages.push(row);
      return strip(row);
    });
  }

  async topics(): Promise<TopicSummary[]> {
    await this.ensure();
    const latest = new Map<string, StoredMessage>();
    for (const message of (this.state as State).messages) {
      const current = latest.get(message.topic);
      if (!current || message.seq > current.seq) latest.set(message.topic, message);
    }
    return [...latest.values()]
      .sort((a, b) => b.seq - a.seq)
      .map((message) => ({
        topic: message.topic,
        last_seq: message.seq,
        last_message_at: message.created_at,
      }));
  }

  async messages(query: MessageQuery): Promise<MessagePage> {
    await this.ensure();
    let rows = (this.state as State).messages;
    if (query.topic) rows = rows.filter((row) => row.topic === query.topic);
    if (query.before !== undefined) rows = rows.filter((row) => row.seq < query.before!);
    rows = [...rows].sort((a, b) => b.seq - a.seq);
    const hasMore = rows.length > query.limit;
    return {
      messages: rows.slice(0, query.limit).map(strip),
      hasMore,
    };
  }

  async sync(query: SyncQuery): Promise<SyncResult> {
    await this.ensure();
    let rows = (this.state as State).messages.filter(
      (row) => row.seq > query.since,
    );
    if (query.topic) rows = rows.filter((row) => row.topic === query.topic);
    rows = rows.sort((a, b) => a.seq - b.seq).slice(0, 200);
    return { messages: rows.map(strip), reset: false };
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.mutate((state) => {
      const before = state.messages.length;
      state.messages = state.messages.filter((row) => row.id !== id);
      return state.messages.length !== before;
    });
  }

  async prune(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.mutate((state) => {
      const before = state.messages.length;
      state.messages = state.messages.filter(
        (row) => new Date(row.created_at).getTime() >= cutoff,
      );
      return before - state.messages.length;
    });
  }
}
