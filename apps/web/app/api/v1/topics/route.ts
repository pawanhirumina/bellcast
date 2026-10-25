import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) return fail(auth.status, auth.code, auth.message);

  try {
    const topics = await getStore().topics();
    return json({ topics });
  } catch (error) {
    console.error("[bellcast] topics failed", error);
    return fail(500, "internal", "Could not load topics.");
  }
}
