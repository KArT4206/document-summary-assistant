"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon } from "./icons";

// Stage labels only, in the same order the server pipeline actually executes
// them (validate -> extract/OCR -> analyze -> generate) — no fabricated
// percentage or progress bar, since the server does one request/response
// cycle with no granular progress channel back to the client. A later stage
// becoming "current" is a reasonable (if not millisecond-exact) signal that
// earlier stages completed, because the pipeline is strictly sequential.
const STAGES = [
  "Uploading document",
  "Validating file",
  "Extracting text",
  "Analyzing content",
  "Generating summary",
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
      className="flex w-full flex-col items-center gap-6 rounded-[var(--radius-xl)] border border-(--color-border) bg-(--color-surface) p-8 sm:p-10"
    >
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-(--color-border) border-t-(--color-primary) motion-reduce:animate-none" />
      </div>

      <div className="w-full max-w-xs">
        <p className="truncate text-center text-sm font-medium text-(--color-text)">{filename}</p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {STAGES.map((stage, i) => {
            const isDone = i < stageIndex;
            const isCurrent = i === stageIndex;
            return (
              <li key={stage} className="flex items-center gap-2.5 text-sm">
                {isDone ? (
                  <CheckCircleIcon className="h-4 w-4 shrink-0 text-(--color-success)" />
                ) : (
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      isCurrent ? "border-(--color-primary)" : "border-(--color-border-strong)"
                    }`}
                  >
                    {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-(--color-primary) motion-safe:animate-pulse" />}
                  </span>
                )}
                <span className={isDone ? "text-(--color-text-muted)" : isCurrent ? "font-medium text-(--color-text)" : "text-(--color-text-faint)"}>
                  {stage}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-center text-xs text-(--color-text-faint)">
        This can take up to a minute for larger documents or scanned images.
      </p>
    </div>
  );
}
