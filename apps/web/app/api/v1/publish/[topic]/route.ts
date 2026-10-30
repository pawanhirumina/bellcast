import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { fail, json, PUBLISH_CORS } from "@/lib/http";
import { getStore } from "@/lib/store";
import type { MessageAction, Priority, PublishInput } from "@/lib/types";
import {
  isHttpUrl,
  jsonPublishSchema,
  MAX_TITLE_LENGTH,
  normalizeTitle,
  parseActions,
  parsePriority,
  parseTags,
  TOPIC_RE,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ topic: string }> };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: PUBLISH_CORS });
}

export async function POST(req: NextRequest, context: Context) {
  const auth = authorize(req, { mutation: true });
  if (!auth.ok) {
    return fail(auth.status, auth.code, auth.message, PUBLISH_CORS);
  }

  const { topic } = await context.params;
  if (!TOPIC_RE.test(topic)) {
    return fail(
      400,
      "invalid_topic",
      "Topic must match ^[a-z0-9][a-z0-9_-]{0,63}$.",
      PUBLISH_CORS,
    );
  }

  const maxBytes = Number(process.env.BELLCAST_MAX_BODY_BYTES ?? 65536);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes + 4096) {
    return fail(413, "payload_too_large", "Message body is too large.", PUBLISH_CORS);
  }

  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");

  let payload: Record<string, unknown> = {};
  let body = "";

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return fail(413, "payload_too_large", "Message body is too large.", PUBLISH_CORS);
  }

  if (isJson) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const checked = jsonPublishSchema.safeParse(parsed);
      if (!checked.success) {
        return fail(400, "invalid_body", "Invalid JSON payload.", PUBLISH_CORS);
      }
      payload = checked.data as Record<string, unknown>;
      const candidate = payload.body ?? payload.message ?? "";
      if (typeof candidate !== "string") {
        return fail(400, "invalid_body", "body must be a string.", PUBLISH_CORS);
      }
      body = candidate;
    } catch {
      return fail(400, "invalid_json", "Could not parse JSON body.", PUBLISH_CORS);
    }
  } else {
    body = raw;
  }

  const rawTitle = req.headers.get("title") ?? payload.title;
  let title: string | null = null;
  if (rawTitle !== undefined && rawTitle !== null && rawTitle !== "") {
    const normalized = normalizeTitle(rawTitle);
    if (normalized === undefined) {
      return fail(
        400,
        "invalid_title",
        `Title must be at most ${MAX_TITLE_LENGTH} characters.`,
        PUBLISH_CORS,
      );
    }
    title = normalized;
  }

  // Browsers may attach their own `Priority` header (RFC 9218), e.g. `u=3`.
  // Only honour the header when it is a valid value, otherwise fall back to
  // the JSON body so web requests are not rejected by transport metadata.
  const priorityHeader = req.headers.get("priority");
  const priority =
    (priorityHeader !== null ? parsePriority(priorityHeader) : null) ??
    parsePriority(payload.priority);
  if (priority === null) {
    return fail(
      400,
      "invalid_priority",
      "Priority must be min, low, default, high, max or 1-5.",
      PUBLISH_CORS,
    );
  }

  const tags = parseTags(req.headers.get("tags") ?? payload.tags);
  if (tags === null) {
    return fail(
      400,
      "invalid_tags",
      "Tags must be a comma-separated list of at most 10 short values.",
      PUBLISH_CORS,
    );
  }

  const rawClick = req.headers.get("click") ?? payload.click;
  let click: string | null = null;
  if (rawClick !== undefined && rawClick !== null && rawClick !== "") {
    if (typeof rawClick !== "string" || !isHttpUrl(rawClick)) {
      return fail(
        400,
        "invalid_click",
        "Click must be an absolute http(s) URL.",
        PUBLISH_CORS,
      );
    }
    click = rawClick;
  }

  const rawActions = payload.actions;
  let actions: MessageAction[] | null = null;
  if (rawActions !== undefined && rawActions !== null) {
    const parsed = parseActions(rawActions);
    if (parsed === undefined) {
      return fail(400, "invalid_actions", "Invalid actions.", PUBLISH_CORS);
    }
    actions = parsed;
  }

  const idempotencyKey =
    req.headers.get("idempotency-key") ??
    (typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : "");
  if (idempotencyKey.length > 128) {
    return fail(
      400,
      "invalid_idempotency_key",
      "Idempotency key is too long.",
      PUBLISH_CORS,
    );
  }

  const trimmedBody = body.trim();
  if (!trimmedBody && !title) {
    return fail(
      400,
      "empty_message",
      "Provide a message body or a title.",
      PUBLISH_CORS,
    );
  }

  const input: PublishInput = {
    topic,
    title: title ?? null,
    body: trimmedBody,
    priority: priority as Priority,
    tags,
    click,
    actions,
    idempotencyKey: idempotencyKey || randomUUID(),
  };

  try {
    const message = await getStore().publish(input);
    return json({ message }, { status: 201, headers: PUBLISH_CORS });
  } catch (error) {
    console.error("[bellcast] publish failed", error);
    return fail(500, "internal", "Could not publish the message.", PUBLISH_CORS);
  }
}
