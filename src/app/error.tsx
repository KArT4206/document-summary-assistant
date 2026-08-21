"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled client error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        An unexpected error occurred. You can try again, or start over with a new document.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 dark:text-slate-600">Reference: {error.digest}</p>
      )}
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
