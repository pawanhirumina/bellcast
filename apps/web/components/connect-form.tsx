"use client";

/* eslint-disable react-hooks/set-state-in-effect -- health check and URL-fragment bootstrap */

import { BellRing, Eye, EyeOff, KeyRound, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Health } from "@/lib/types";
import { Button, Input } from "./ui";
import { ThemeMenu } from "./theme-switcher";

export function ConnectForm() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [checking, setChecking] = useState(true);

  async function loadHealth() {
    setChecking(true);
    setHealthError(false);
    try {
      setHealth(await api.health());
    } catch {
      setHealth(null);
      setHealthError(true);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void loadHealth();
  }, []);

  // The desktop shell hands the key over in the URL fragment so the user
  // does not have to paste it twice. The fragment never reaches the server.
  useEffect(() => {
    const fragment = window.location.hash;
    if (!fragment.startsWith("#key=")) return;
    const bootstrapKey = decodeURIComponent(fragment.slice(5)).trim();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    if (!bootstrapKey) return;

    setKey(bootstrapKey);
    setLoading(true);
    api
      .session(bootstrapKey)
      .then(() => window.location.assign("/app"))
      .catch((caught: unknown) => {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Could not reach this instance.",
        );
        setLoading(false);
      });
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    if (!window.navigator.onLine) {
      setError("You're offline. Reconnect before signing in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.session(key.trim());
      window.location.assign("/app");
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not reach this instance. Check your connection and try again.",
      );
      setLoading(false);
    }
  }

  const configured = health?.configured !== false;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-grid opacity-40" aria-hidden />
      <div className="absolute right-3 top-3">
        <ThemeMenu align="right" />
      </div>

      <div className="animate-in relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <BellRing className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="mt-3 text-[20px] font-bold tracking-tight text-ink">
            Bellcast
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            Connect to your self-hosted instance.
          </p>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          {checking ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Checking this instance…
            </div>
          ) : healthError ? (
            <div className="space-y-3" role="alert">
              <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-[12px] text-danger">
                <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Can&apos;t reach this instance.</p>
                  <p className="mt-0.5 text-ink/80">
                    The health check failed. Check your connection, then retry.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => void loadHealth()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Retry health check
              </Button>
              <form onSubmit={connect} className="space-y-3 border-t border-line pt-3">
                <div>
                  <label
                    htmlFor="api-key-offline"
                    className="mb-1.5 block text-[12px] font-medium text-muted"
                  >
                    API key
                  </label>
                  <Input
                    id="api-key-offline"
                    type="password"
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="Paste your instance API key"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                {error ? (
                  <p className="rounded-md border border-danger/30 bg-danger-soft px-2.5 py-2 text-[12px] text-danger">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={loading || !key.trim()} className="w-full">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  Try connecting anyway
                </Button>
              </form>
            </div>
          ) : !configured ? (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-warn">
                This instance is not configured yet.
              </p>
              <p className="text-[12px] leading-5 text-muted">
                Add the Supabase and API key environment variables to your
                Vercel project, then redeploy.
              </p>
              <pre className="overflow-x-auto rounded-md border border-line bg-code p-3 font-mono text-[11px] leading-5 text-muted">
                {`SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\nBELLCAST_API_KEY=`}
              </pre>
            </div>
          ) : (
            <form onSubmit={connect} className="space-y-4">
              <div>
                <label
                  htmlFor="api-key"
                  className="mb-1.5 block text-[12px] font-medium text-muted"
                >
                  API key
                </label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint"
                    aria-hidden
                  />
                  <Input
                    id="api-key"
                    type={show ? "text" : "password"}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="Paste your instance API key"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="pl-8 pr-9 font-mono text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((value) => !value)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:bg-hover hover:text-ink"
                    aria-label={show ? "Hide API key" : "Show API key"}
                  >
                    {show ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-danger/30 bg-danger-soft px-2.5 py-2 text-[12px] text-danger"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading || !key.trim()}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Connect
              </Button>

              {health?.devMode && health.devKey ? (
                <div className="rounded-md border border-line bg-raised p-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted">
                        Development mode
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink">
                        {health.devKey}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setKey(health.devKey ?? "")}
                    >
                      Use key
                    </Button>
                  </div>
                </div>
              ) : null}

              <p className="text-center text-[11px] leading-5 text-faint">
                The key is stored in an HttpOnly cookie on this device.
              </p>
            </form>
          )}
        </div>

        {health ? (
          <p className="mt-4 text-center text-[11px] text-faint">
            v{health.version} · {health.store} store · {health.retentionDays}d
            retention
          </p>
        ) : null}
      </div>
    </main>
  );
}
