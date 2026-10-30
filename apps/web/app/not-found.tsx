import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <p className="font-mono text-[11px] text-faint">404</p>
      <h1 className="mt-2 text-[18px] font-bold text-ink">
        That page doesn&apos;t exist
      </h1>
      <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">
        The channel may have been renamed, or the link is out of date.
      </p>
      <Link
        href="/app"
        className="mt-4 rounded-md bg-accent px-3 py-1.5 text-[13px] font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Back to activity
      </Link>
    </main>
  );
}
