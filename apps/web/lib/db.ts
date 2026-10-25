import Dexie, { type Table } from "dexie";
import type { Message, TopicSummary } from "./types";

export type MetaRow = { key: string; value: unknown };

class BellcastDatabase extends Dexie {
  messages!: Table<Message, number>;
  topics!: Table<TopicSummary, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("bellcast");
    this.version(1).stores({
      messages: "seq, id, topic, created_at, [topic+seq]",
      topics: "topic, last_seq",
      meta: "key",
    });
  }
}

let instance: BellcastDatabase | null = null;

export function getDb() {
  if (typeof window === "undefined") {
    throw new Error("The local cache is only available in the browser.");
  }
  if (!instance) instance = new BellcastDatabase();
  return instance;
}
