import type { NextRequest } from "next/server";
import {
  authorize,
  isConfigured,
  isProduction,
  SESSION_COOKIE,
  verifyKey,
} from "@/lib/auth";
import { fail, json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originAllowed(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isConfigured()) {
    return fail(
      503,
      "not_configured",
      "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BELLCAST_API_KEY first.",
    );
  }
  if (!originAllowed(req)) {
    return fail(403, "bad_origin", "Cross-origin request rejected.");
  }

  let key = req.headers.get("x-api-key") ?? "";
  if (!key) {
    try {
      const body = (await req.json()) as { key?: unknown };
      if (typeof body.key === "string") key = body.key;
    } catch {
      // fall through to the 400 below
    }
  }

  if (!key) return fail(400, "missing_key", "Provide an API key.");
  if (!verifyKey(key)) {
    return fail(401, "unauthorized", "That API key is not valid.");
  }

  const response = json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: key,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function GET(req: NextRequest) {
  const auth = authorize(req);
  if (!auth.ok) return fail(auth.status, auth.code, auth.message);
  return json({ authenticated: true });
}

export async function DELETE() {
  const response = json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: 0,
  });
  return response;
}
