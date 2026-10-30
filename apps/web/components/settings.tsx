"use client";

/* eslint-disable react-hooks/set-state-in-effect -- reads browser-only capabilities after hydration */

import {
  Bell,
  Check,
  Copy,
  Database,
  HardDrive,
  KeyRound,
  LogOut,
  Palette,
  RefreshCw,
  ShieldCheck,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getDb } from "@/lib/db";
import type { Health } from "@/lib/types";
import { VERSION } from "@/lib/version";
import { Button, cn } from "./ui";
import { ThemeGrid } from "./theme-switcher";

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-6 last:border-b-0">
      <div className="mb-4 flex items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-muted">{icon}</span> : null}
        <div>
          <h2 className="text-[14px] font-bold leading-5 text-ink">{title}</h2>
          {description ? (
            <p className="mt-1 text-[12px] leading-5 text-muted">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="sm:pl-7">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 border-b border-line px-3 py-2.5 last:border-b-0">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="text-right text-[12px] text-ink">{value}</span>
    </div>
  );
}

export function SettingsScreen() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [busy, setBusy] = useState(false);
  const messages = useLiveQuery(() => getDb().messages.count(), [], 0);
  const topics = useLiveQuery(() => getDb().topics.count(), [], 0);

  async function loadHealth() {
    setLoadingHealth(true);
    setHealthError(null);
    try {
      setHealth(await api.health());
    } catch {
      setHealth(null);
      setHealthError(
        "Can't reach this instance right now. Cached messages still work.",
      );
    } finally {
      setLoadingHealth(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    void loadHealth();
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
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
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
      // Ignore clipboard failures.
    }
  }

  return (
    <div className="min-h-full bg-surface">
      <div className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
        <Section
          title="Appearance"
          description="Two themes, applied instantly and remembered on this device."
          icon={<Palette className="h-4 w-4" />}
        >
          <ThemeGrid />
        </Section>

        <Section
          title="Instance"
          description="Details about the self-hosted service behind this workspace."
          icon={<Database className="h-4 w-4" />}
        >
          {loadingHealth ? (
            <div className="rounded-md border border-line bg-raised px-3 py-3 text-[12px] text-muted">
              Checking instance…
            </div>
          ) : healthError ? (
            <div
              role="alert"
              className="flex flex-wrap items-center gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[12px] text-danger"
            >
              <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">{healthError}</span>
              <Button variant="secondary" size="sm" onClick={() => void loadHealth()}>
                <RefreshCw className="h-3 w-3" aria-hidden />
                Retry
              </Button>
            </div>
          ) : health ? (
            <div className="overflow-hidden rounded-md border border-line bg-raised">
              <Row
                label="Version"
                value={<span className="font-mono text-[11px]">v{health.version}</span>}
              />
              <Row
                label="Storage"
                value={
                  health.store === "supabase"
                    ? "Supabase (Postgres)"
                    : health.store === "file"
                      ? "Local file (dev)"
                      : "Not configured"
                }
              />
              <Row label="Retention" value={`${health.retentionDays} days`} />
              <Row
                label="Status"
                value={
                  health.configured ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Active
                    </span>
                  ) : (
                    <span className="text-warn">Not configured</span>
                  )
                }
              />
              <Row
                label="Delivery"
                value={<span className="font-mono text-[11px]">long-poll</span>}
              />
            </div>
          ) : null}
        </Section>

        <Section
          title="Notifications"
          description="Browser notifications work while this tab is open. The desktop app handles background delivery."
          icon={<Bell className="h-4 w-4" />}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="text-[12px]">
              <span className="text-muted">Permission: </span>
              <span
                className={cn("font-bold capitalize", {
                  "text-success": permission === "granted",
                  "text-warn": permission === "default",
                  "text-danger": permission === "denied",
                  "text-faint": permission === "unsupported",
                })}
              >
                {permission}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={enableNotifications}
                disabled={
                  permission === "granted" || permission === "unsupported"
                }
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
        </Section>

        <Section
          title="Publishing"
          description="Use the API key from your instance environment. It is never shown here."
          icon={<KeyRound className="h-4 w-4" />}
        >
          <div className="overflow-hidden rounded-md border border-line bg-code">
            <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
              <span className="text-[11px] font-semibold text-muted">Bash</span>
              <button
                type="button"
                onClick={copyCurl}
                className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] font-semibold text-muted hover:bg-hover hover:text-ink"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" aria-hidden />
                ) : (
                  <Copy className="h-3 w-3" aria-hidden />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-6 text-ink">
              {curl}
            </pre>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-faint">
            The same payload shape works with Slack and Mattermost incoming
            webhooks. Point the URL at your hook.
          </p>
        </Section>

        <Section
          title="Local cache"
          description="Messages cached in IndexedDB for instant loads and offline reading."
          icon={<HardDrive className="h-4 w-4" />}
        >
          <div className="overflow-hidden rounded-md border border-line bg-raised">
            <Row label="Messages cached" value={messages ?? 0} />
            <Row label="Channels cached" value={topics ?? 0} />
            <Row
              label="Offline reads"
              value={
                <span className="inline-flex items-center gap-1.5 text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Enabled
                </span>
              }
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="danger"
              size="sm"
              onClick={clearCache}
              disabled={busy}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear cache
            </Button>
          </div>
        </Section>

        <Section
          title="Session"
          description="The API key is stored in an HttpOnly cookie on this device and is valid for one year."
          icon={<ShieldCheck className="h-4 w-4" />}
        >
          <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-raised px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Active session
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={signOut}
              disabled={busy}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </Section>

        <div className="py-8 text-center text-[11px] text-faint">
          Bellcast v{health?.version ?? VERSION} · self-hosted ·
          Slack-compatible API
        </div>
      </div>
    </div>
  );
}
