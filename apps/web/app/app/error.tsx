"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-danger-soft text-danger">
        <TriangleAlert className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-3 text-[16px] font-bold text-ink">
        This screen failed to load
      </h1>
      <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
        {error.message || "An unexpected error occurred while loading the app."}
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="sm" onClick={reset}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.assign("/app")}
        >
          Back to activity
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-4 font-mono text-[10px] text-faint">
          digest {error.digest}
        </p>
      ) : null}
    </div>
  );
}
