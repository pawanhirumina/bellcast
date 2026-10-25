import type {
  Health,
  Message,
  MessagePage,
  Priority,
  SyncResult,
  TopicSummary,
} from "./types";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      message = body.error?.message ?? message;
      code = body.error?.code;
    } catch {
      // no JSON body
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type PublishRequest = {
  title?: string;
  body: string;
  priority?: Priority;
  tags?: string[];
  click?: string;
};

export const api = {
  health: () => request<Health>("/api/v1/health"),

  topics: () => request<{ topics: TopicSummary[] }>("/api/v1/topics"),

  messages: (options: { topic?: string; before?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (options.topic) params.set("topic", options.topic);
    if (options.before !== undefined) params.set("before", String(options.before));
    params.set("limit", String(options.limit ?? 100));
    return request<MessagePage>(`/api/v1/messages?${params.toString()}`);
  },

  sync: (since: number, signal?: AbortSignal, wait = 25) =>
    request<SyncResult>(
      `/api/v1/sync?since=${since}&wait=${wait}`,
      { signal },
    ),

  publish: (topic: string, body: PublishRequest) =>
    request<{ message: Message }>(`/api/v1/publish/${encodeURIComponent(topic)}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": crypto.randomUUID() },
    }),

  deleteMessage: (id: string) =>
    request<{ ok: true }>(`/api/v1/messages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  session: (key: string) =>
    request<{ ok: true }>("/api/v1/session", {
      method: "POST",
      body: JSON.stringify({ key }),
    }),

  logout: () => request<{ ok: true }>("/api/v1/session", { method: "DELETE" }),
};
