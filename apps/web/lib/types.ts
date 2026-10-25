export type Priority = 1 | 2 | 3 | 4 | 5;

export type MessageAction = {
  action: "view";
  label: string;
  url: string;
  clear?: boolean;
};

export type Message = {
  id: string;
  seq: number;
  topic: string;
  title: string | null;
  body: string;
  priority: Priority;
  tags: string[];
  click: string | null;
  actions: MessageAction[] | null;
  created_at: string;
};

export type TopicSummary = {
  topic: string;
  last_seq: number;
  last_message_at: string;
};

export type MessagePage = {
  messages: Message[];
  hasMore: boolean;
};

export type SyncResult = {
  messages: Message[];
  reset: boolean;
  cursor?: number;
};

export type StoreKind = "supabase" | "file" | "none";

export type Health = {
  ok: boolean;
  version: string;
  time: string;
  configured: boolean;
  store: StoreKind;
  devMode: boolean;
  devKey?: string;
  retentionDays: number;
};

export type PublishInput = {
  topic: string;
  title: string | null;
  body: string;
  priority: Priority;
  tags: string[];
  click: string | null;
  actions: MessageAction[] | null;
  idempotencyKey: string;
};
