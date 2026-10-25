"use client";

import { BellRing, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Health } from "@/lib/types";
import { Button, Input } from "./ui";

export function ConnectForm() {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // The desktop shell hands the key over in the URL fragment so the user
  // does not have to paste it twice. The fragment never leaves the webview.
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
      .catch((error: unknown) => {
        setError(
          error instanceof ApiError ? error.message : "Could not connect.",
        );
        setLoading(false);
      });
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.session(key.trim());
      window.location.assign("/app");
    } catch (error) {
      setError(
        error instanceof ApiError ? error.message : "Could not connect.",
      );
      setLoading(false);
    }
  }

  const configured = health?.configured !== false;

  return (
    <main className="bg-grid relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.07),transparent_65%)]" />

      <div className="animate-in relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_40px_rgba(255,255,255,0.06)]">
            <BellRing className="h-5 w-5 text-white" strokeWidth={1.8} />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Bellcast
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect to your self-hosted instance.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/80 p-6 shadow-2xl backdrop-blur-xl">
          {!configured ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-300">
                This instance is not configured yet.
              </p>
              <p className="text-sm leading-6 text-zinc-400">
                Add the Supabase and API key environment variables to your
                Vercel project, then redeploy.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black p-3 text-[11px] leading-5 text-zinc-400">
                {`SUPABASE_URL=\nSUPABASE_SERVICE_ROLE_KEY=\nBELLCAST_API_KEY=`}
              </pre>
            </div>
          ) : (
            <form onSubmit={connect} className="space-y-4">
              <div>
                <label
                  htmlFor="api-key"
                  className="mb-1.5 block text-xs font-medium text-zinc-400"
                >
                  API key
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="api-key"
                    type={show ? "text" : "password"}
                    value={key}
                    onChange={(event) => setKey(event.target.value)}
                    placeholder="Paste your instance API key"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    className="pl-9 pr-10 font-mono text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                    aria-label={show ? "Hide API key" : "Show API key"}
                  >
                    {show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading || !key.trim()}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Connect
              </Button>

              {health?.devMode && health.devKey ? (
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        Development mode
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-300">
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

              <p className="text-center text-[11px] leading-5 text-zinc-600">
                The key is stored in an HttpOnly cookie on this device.
              </p>
            </form>
          )}
        </div>

        {health ? (
          <p className="mt-4 text-center text-[11px] text-zinc-600">
            v{health.version} · {health.store} store ·{" "}
            {health.retentionDays}d retention
          </p>
        ) : null}
      </div>
    </main>
  );
}
