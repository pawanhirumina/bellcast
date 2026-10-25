import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Message,
  MessagePage,
  Priority,
  PublishInput,
  SyncResult,
  TopicSummary,
} from "../types";
import type { MessageQuery, Store, SyncQuery } from "./types";

type Row = {
  id: string;
  seq: number | string;
  topic: string;
  title: string | null;
  body: string;
  priority: number | string;
  tags: string[] | null;
  click_url: string | null;
  actions: Message["actions"];
  created_at: string;
};

function mapRow(row: Row): Message {
  return {
    id: row.id,
    seq: Number(row.seq),
    topic: row.topic,
    title: row.title ?? null,
    body: row.body,
    priority: Number(row.priority) as Priority,
    tags: row.tags ?? [],
    click: row.click_url ?? null,
    actions: row.actions ?? null,
    created_at: row.created_at,
  };
}

export class SupabaseStore implements Store {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async publish(input: PublishInput): Promise<Message> {
    const { data, error } = await this.db.rpc("publish_message", {
      p_topic: input.topic,
      p_title: input.title,
      p_body: input.body,
      p_priority: input.priority,
      p_tags: input.tags,
      p_click: input.click,
      p_actions: input.actions,
      p_idem: input.idempotencyKey,
    });
    if (error) throw new Error(`publish failed: ${error.message}`);
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    if (!row) throw new Error("publish failed: no row returned");
    return mapRow(row);
  }

  async topics(): Promise<TopicSummary[]> {
    const { data, error } = await this.db.rpc("list_topics");
    if (error) throw new Error(`topics failed: ${error.message}`);
    return ((data ?? []) as Array<{
      topic: string;
      last_seq: number | string;
      last_message_at: string;
    }>).map((row) => ({
      topic: row.topic,
      last_seq: Number(row.last_seq),
      last_message_at: row.last_message_at,
    }));
  }

  async messages(query: MessageQuery): Promise<MessagePage> {
    let request = this.db
      .from("messages")
      .select("*")
      .order("seq", { ascending: false })
      .limit(query.limit + 1);
    if (query.topic) request = request.eq("topic", query.topic);
    if (query.before !== undefined) request = request.lt("seq", query.before);

    const { data, error } = await request;
    if (error) throw new Error(`messages failed: ${error.message}`);
    const rows = (data ?? []) as Row[];
    const hasMore = rows.length > query.limit;
    return {
      messages: rows.slice(0, query.limit).map(mapRow),
      hasMore,
    };
  }

  async sync(query: SyncQuery): Promise<SyncResult> {
    let request = this.db
      .from("messages")
      .select("*")
      .gt("seq", query.since)
      .order("seq", { ascending: true })
      .limit(200);
    if (query.topic) request = request.eq("topic", query.topic);

    const { data, error } = await request;
    if (error) throw new Error(`sync failed: ${error.message}`);
    return {
      messages: ((data ?? []) as Row[]).map(mapRow),
      reset: false,
    };
  }

  async deleteMessage(id: string): Promise<boolean> {
    const { error, count } = await this.db
      .from("messages")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw new Error(`delete failed: ${error.message}`);
    return (count ?? 0) > 0;
  }

  async prune(days: number): Promise<number> {
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await this.db
      .from("messages")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw new Error(`prune failed: ${error.message}`);
    return (data ?? []).length;
  }
}
