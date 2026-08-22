"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircleIcon } from "@/components/icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled client error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-danger-bg) text-(--color-danger)">
        <AlertCircleIcon className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold text-(--color-text)">Something went wrong</h1>
      <p className="max-w-sm text-sm text-(--color-text-muted)">
        An unexpected error occurred. You can try again, or start over with a new document.
      </p>
      {error.digest && <p className="text-xs text-(--color-text-faint)">Reference: {error.digest}</p>}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-md)] bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-(--color-primary-fg) transition-colors hover:bg-(--color-primary-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-[var(--radius-md)] border border-(--color-border) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-elevated) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
