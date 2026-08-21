"use client";

import { useEffect, useState } from "react";

// Qualitative status labels only — no fabricated percentage/progress bar,
// since the server does one request/response cycle and true granular
// progress isn't available to the client.
const STAGES = [
  "Uploading document…",
  "Validating file…",
  "Extracting text…",
  "Analyzing content…",
  "Generating summary…",
];

export function ProcessingState({ filename }: { filename: string }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 motion-reduce:animate-none dark:border-slate-700" />
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{STAGES[stageIndex]}</p>
      <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">{filename}</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">This can take up to a minute for larger documents or scanned images.</p>
    </div>
  );
}
