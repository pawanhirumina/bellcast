import type { NextRequest } from "next/server";
import { fail, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return fail(401, "unauthorized", "Invalid cron secret.");
  }

  const days = Number(process.env.BELLCAST_RETENTION_DAYS ?? 30);
  try {
    const deleted = await getStore().prune(
      Number.isFinite(days) && days > 0 ? days : 30,
    );
    return json({ ok: true, deleted });
  } catch (error) {
    console.error("[bellcast] prune failed", error);
    return fail(500, "internal", "Could not prune messages.");
  }
}
