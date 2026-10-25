import type { NextRequest } from "next/server";
import { authorize } from "@/lib/auth";
import { fail, json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: Context) {
  const auth = authorize(req, { mutation: true });
  if (!auth.ok) return fail(auth.status, auth.code, auth.message);

  const { id } = await context.params;
  if (!id) return fail(400, "invalid_id", "Missing message id.");

  try {
    const deleted = await getStore().deleteMessage(id);
    if (!deleted) return fail(404, "not_found", "Message not found.");
    return json({ ok: true });
  } catch (error) {
    console.error("[bellcast] delete failed", error);
    return fail(500, "internal", "Could not delete the message.");
  }
}
