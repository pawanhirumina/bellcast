import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { getStore } from "@/lib/store";
import { TOPIC_RE } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) return fail(auth.status, auth.code, auth.message);

  const params = req.nextUrl.searchParams;
  const topic = params.get("topic") ?? undefined;
  if (topic && !TOPIC_RE.test(topic)) {
    return fail(400, "invalid_topic", "Invalid topic.");
  }

  const since = Number(params.get("since") ?? 0);
  if (!Number.isInteger(since) || since < 0) {
    return fail(400, "invalid_cursor", "since must be a non-negative integer.");
  }

  const waitRaw = Number(params.get("wait") ?? 25);
  const wait = Number.isFinite(waitRaw)
    ? Math.min(Math.max(waitRaw, 0), 25)
    : 25;
  const deadline = Date.now() + wait * 1000;

  try {
    const store = getStore();
    let result = await store.sync({ since, topic });

    while (
      result.messages.length === 0 &&
      Date.now() < deadline &&
      !req.signal.aborted
    ) {
      await sleep(500, req.signal);
      if (req.signal.aborted) break;
      result = await store.sync({ since, topic });
    }

    const cursor =
      result.messages.length > 0
        ? result.messages[result.messages.length - 1].seq
        : since;

    return json({
      messages: result.messages,
      cursor,
      reset: result.reset,
    });
  } catch (error) {
    console.error("[bellcast] sync failed", error);
    return fail(500, "internal", "Could not sync messages.");
  }
}
