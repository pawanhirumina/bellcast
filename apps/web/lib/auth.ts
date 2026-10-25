import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "bellcast_session";
const DEV_KEY = "dev-key";

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

/**
 * The local JSON store is only available outside production and only when it
 * has not been explicitly disabled. Production always requires Supabase.
 */
export function isDevMode() {
  return !isProduction() && process.env.BELLCAST_DEV_STORE !== "0";
}

export function hasSupabase() {
  return Boolean(
    process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function apiKey() {
  const configured = process.env.BELLCAST_API_KEY?.trim();
  if (configured) return configured;
  return isDevMode() ? DEV_KEY : "";
}

export function isConfigured() {
  return Boolean(apiKey()) && (hasSupabase() || isDevMode());
}

export function storeKind(): "supabase" | "file" | "none" {
  if (hasSupabase()) return "supabase";
  if (isDevMode()) return "file";
  return "none";
}

function safeEqual(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export function verifyKey(candidate: string | null | undefined) {
  const expected = apiKey();
  if (!expected || !candidate) return false;
  return safeEqual(candidate, expected);
}

function headerKey(req: NextRequest) {
  const direct = req.headers.get("x-api-key");
  if (direct) return direct;
  const authorization = req.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return null;
}

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

export type AuthResult =
  | { ok: true; via: "header" | "cookie" }
  | { ok: false; status: number; code: string; message: string };

export function authorize(
  req: NextRequest,
  options: { mutation?: boolean } = {},
): AuthResult {
  if (!isConfigured()) {
    return {
      ok: false,
      status: 503,
      code: "not_configured",
      message:
        "This instance is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BELLCAST_API_KEY.",
    };
  }

  const header = headerKey(req);
  if (header) {
    return verifyKey(header)
      ? { ok: true, via: "header" }
      : {
          ok: false,
          status: 401,
          code: "unauthorized",
          message: "Invalid API key.",
        };
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!verifyKey(cookie)) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Missing or invalid session. Connect with your API key.",
    };
  }

  if (options.mutation && !originAllowed(req)) {
    return {
      ok: false,
      status: 403,
      code: "bad_origin",
      message: "Cross-origin request rejected.",
    };
  }

  return { ok: true, via: "cookie" };
}
