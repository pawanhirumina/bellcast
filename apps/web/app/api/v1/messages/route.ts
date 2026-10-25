import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { getStore } from "@/lib/store";
import { TOPIC_RE } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) return fail(auth.status, auth.code, auth.message);

  const params = req.nextUrl.searchParams;
  const topic = params.get("topic") ?? undefined;
  if (topic && !TOPIC_RE.test(topic)) {
    return fail(400, "invalid_topic", "Invalid topic.");
  }

  const limitRaw = Number(params.get("limit") ?? 100);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200)
    : 100;

  const beforeRaw = params.get("before");
  let before: number | undefined;
  if (beforeRaw !== null) {
    const parsed = Number(beforeRaw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return fail(400, "invalid_cursor", "before must be a positive integer.");
    }
    before = parsed;
  }

  try {
    const page = await getStore().messages({ topic, before, limit });
    return json(page);
  } catch (error) {
    console.error("[bellcast] messages failed", error);
    return fail(500, "internal", "Could not load messages.");
  }
}
