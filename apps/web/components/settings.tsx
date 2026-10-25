"use client";

import { useLiveQuery } from "dexie-react-hooks";
import {
  Bell,
  Check,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Health } from "@/lib/types";
import { Button, cn } from "./ui";

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-b-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span
        className={cn(
          "text-right text-xs text-zinc-300",
          mono && "font-mono text-[11px]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Card({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/50">
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-zinc-400">
          {icon}
        </div>
        <div>
          <h2 className="text-[13px] font-medium text-zinc-200">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-5 text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function SettingsScreen() {
  const [health, setHealth] = useState<Health | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [busy, setBusy] = useState(false);

  const messages = useLiveQuery(() => getDb().messages.count(), [], 0);
  const topics = useLiveQuery(() => getDb().topics.count(), [], 0);

  useEffect(() => {
    setOrigin(window.location.origin);
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  function testNotification() {
    const payload = {
      id: `test-${Date.now()}`,
      title: "Bellcast",
      body: "Notifications are working.",
      topic: "general",
      priority: 3,
      click: null,
    };
    if (window.__BELLCAST__?.notify) {
      window.__BELLCAST__.notify(payload);
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(payload.title, { body: payload.body });
    }
  }

  async function clearCache() {
    if (!window.confirm("Clear the local message cache on this device?")) return;
    setBusy(true);
    try {
      await getDb().delete();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await api.logout();
    } finally {
      window.location.assign("/connect");
    }
  }

  const curl = `curl -X POST ${origin}/api/v1/publish/general \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Title: Hello from Bellcast" \\
  -d "It works."`;

  async function copyCurl() {
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          This device and your instance.
        </p>
      </div>

      <div className="space-y-3">
        <Card
          title="Instance"
          description="Read-only details from the server."
          icon={<Database className="h-3.5 w-3.5" />}
        >
          {health ? (
            <div>
              <Row label="Version" value={`v${health.version}`} />
              <Row
                label="Storage"
                value={
                  health.store === "supabase"
                    ? "Supabase"
                    : health.store === "file"
                      ? "Local file (dev)"
                      : "Not configured"
                }
              />
              <Row
                label="Retention"
                value={`${health.retentionDays} days`}
              />
              <Row
                label="Configured"
                value={
                  health.configured ? (
                    <span className="text-emerald-300">Yes</span>
                  ) : (
                    <span className="text-amber-300">No</span>
                  )
                }
              />
              <Row
                label="Delivery"
                value="Authenticated long-poll"
                mono
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking instance…
            </div>
          )}
        </Card>

        <Card
          title="Notifications"
          description="Browser notifications appear while this tab is open. The desktop app handles background delivery."
          icon={<Bell className="h-3.5 w-3.5" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-400">
              Permission:{" "}
              <span
                className={cn("font-medium", {
                  "text-emerald-300": permission === "granted",
                  "text-amber-300": permission === "default",
                  "text-red-300":
                    permission === "denied" || permission === "unsupported",
                })}
              >
                {permission === "unsupported"
                  ? "Not supported"
                  : permission}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={enableNotifications}
                disabled={permission === "granted" || permission === "unsupported"}
              >
                Enable
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={testNotification}
                disabled={permission !== "granted"}
              >
                Send test
              </Button>
            </div>
          </div>
        </Card>

        <Card
          title="Publish from anywhere"
          description="Use the API key from your Vercel environment. It is never shown in this UI."
          icon={<KeyRound className="h-3.5 w-3.5" />}
        >
          <pre className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black p-3 text-[11px] leading-5 text-zinc-400">
            {curl}
          </pre>
          <div className="mt-3 flex justify-end">
            <Button variant="secondary" size="sm" onClick={copyCurl}>
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy curl"}
            </Button>
          </div>
        </Card>

        <Card
          title="Local cache"
          description="Messages are cached in IndexedDB on this device for instant loads and offline reading."
          icon={<HardDrive className="h-3.5 w-3.5" />}
        >
          <Row label="Messages" value={messages ?? 0} />
          <Row label="Topics" value={topics ?? 0} />
          <div className="mt-3 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={clearCache}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear cache
            </Button>
          </div>
        </Card>

        <Card
          title="Session"
          description="The API key is stored in an HttpOnly cookie. Signing out removes it from this browser."
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <RefreshCw className="h-3.5 w-3.5" />
              Session stays valid for one year.
            </div>
            <Button variant="secondary" size="sm" onClick={signOut} disabled={busy}>
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </Card>
      </div>

      <p className="mt-6 text-center text-[11px] text-zinc-700">
        Bellcast v{health?.version ?? "0.1.0"} · self-hosted
      </p>
    </div>
  );
}
