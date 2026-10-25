import { apiKey, isConfigured, isDevMode, storeKind } from "@/lib/auth";
import { json } from "@/lib/http";
import { VERSION } from "@/lib/version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const devMode = isDevMode();
  return json({
    ok: true,
    version: VERSION,
    time: new Date().toISOString(),
    configured: isConfigured(),
    store: storeKind(),
    devMode,
    devKey: devMode ? apiKey() : undefined,
    retentionDays: Number(process.env.BELLCAST_RETENTION_DAYS ?? 30),
  });
}
