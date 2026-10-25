import type {
  Message,
  MessagePage,
  PublishInput,
  SyncResult,
  TopicSummary,
} from "../types";

export type MessageQuery = {
  topic?: string;
  before?: number;
  limit: number;
};

export type SyncQuery = {
  since: number;
  topic?: string;
};

export interface Store {
  publish(input: PublishInput): Promise<Message>;
  topics(): Promise<TopicSummary[]>;
  messages(query: MessageQuery): Promise<MessagePage>;
  sync(query: SyncQuery): Promise<SyncResult>;
  deleteMessage(id: string): Promise<boolean>;
  prune(days: number): Promise<number>;
}
