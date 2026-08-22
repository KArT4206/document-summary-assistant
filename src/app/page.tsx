"use client";

import { useCallback, useRef, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingState } from "@/components/ProcessingState";
import { SummaryView } from "@/components/SummaryView";
import { AlertCircleIcon, ShieldIcon, SparkleIcon } from "@/components/icons";
import type { AppState, SummaryLength, SummarizeResponse } from "@/lib/client-types";

class SummarizeError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

// Validation-type errors are fully explained by their message alone (wrong file
// type, too large, empty, corrupted, no readable text) — retrying the exact
// same file won't help, so the generic "trying again usually resolves it"
// reassurance would be misleading here. Only service/AI-side errors, where a
// retry genuinely might succeed, get that additional line.
const RETRYABLE_CODES = new Set(["AI_TIMEOUT", "AI_RATE_LIMITED", "AI_PROVIDER_ERROR", "AI_INVALID_RESPONSE", "RATE_LIMITED", "INTERNAL_ERROR"]);

async function callSummarizeApi(file: File, length: SummaryLength, signal: AbortSignal): Promise<SummarizeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("length", length);

  const res = await fetch("/api/summarize", { method: "POST", body: formData, signal });
  const data = await res.json();

  if (!res.ok) {
    throw new SummarizeError(data?.error?.message || "Something went wrong. Please try again.", data?.error?.code);
  }
  return data as SummarizeResponse;
}

export default function Home() {
  const [state, setState] = useState<AppState>({ phase: "idle" });
  const [length, setLength] = useState<SummaryLength>("medium");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Tracks the last uploaded file so "regenerate" / length-change can re-run without re-upload.
  const lastFileRef = useRef<File | null>(null);

  const runSummarize = useCallback(async (file: File, requestedLength: SummaryLength) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastFileRef.current = file;

    setState({ phase: "processing", file });
    try {
      const result = await callSummarizeApi(file, requestedLength, controller.signal);
      setState({ phase: "complete", result });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Unexpected error.";
      const code = err instanceof SummarizeError ? err.code : undefined;
      setState({ phase: "error", message, code });
    } finally {
      setIsRegenerating(false);
    }
  }, []);

  const handleFileSelected = useCallback(
    (file: File) => {
      runSummarize(file, length);
    },
    [runSummarize, length]
  );

  const handleLengthChange = useCallback(
    (newLength: SummaryLength) => {
      setLength(newLength);
      if (state.phase === "complete") {
        const currentFile = lastFileRef.current;
        if (currentFile) {
          setIsRegenerating(true);
          runSummarize(currentFile, newLength);
        }
      }
    },
    [state, runSummarize]
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    lastFileRef.current = null;
    setState({ phase: "idle" });
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-(--color-border) bg-(--color-surface)">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-(--color-primary) text-(--color-primary-fg)">
              <SparkleIcon className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-(--color-text)">Document Summary Assistant</span>
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-(--color-text-muted) sm:flex">
            <ShieldIcon className="h-3.5 w-3.5" />
            Not stored after this request
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        {state.phase === "idle" && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-(--color-text) sm:text-3xl">
                Turn documents into clear, actionable summaries.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-(--color-text-muted) sm:text-base">
                Upload a PDF or a scanned image. We extract the text — using OCR automatically when needed — and use
                AI to generate a summary, key points, and improvement suggestions.
              </p>
            </div>
            <UploadZone onFileSelected={handleFileSelected} />
          </>
        )}

        {state.phase === "processing" && <ProcessingState filename={state.file.name} />}

        {state.phase === "error" && (
          <div
            role="alert"
            className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-(--color-danger-border) bg-(--color-danger-bg) p-8 text-center sm:p-10"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-surface) text-(--color-danger)">
              <AlertCircleIcon className="h-6 w-6" />
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium text-(--color-text)">{state.message}</p>
              {state.code && RETRYABLE_CODES.has(state.code) ? (
                <p className="text-sm text-(--color-text-muted)">
                  This is usually temporary — a busy or momentarily unavailable service. Trying again in a moment
                  often resolves it.
                </p>
              ) : (
                <p className="text-sm text-(--color-text-muted)">You can pick a different file and try again.</p>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleReset}
                className="rounded-[var(--radius-md)] bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-(--color-primary-fg) transition-colors hover:bg-(--color-primary-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-[var(--radius-md)] border border-(--color-border) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-elevated) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
              >
                Choose another document
              </button>
            </div>
          </div>
        )}

        {state.phase === "complete" && (
          <SummaryView
            result={state.result}
            length={length}
            onLengthChange={handleLengthChange}
            onRegenerate={() => {
              const file = lastFileRef.current;
              if (file) {
                setIsRegenerating(true);
                runSummarize(file, length);
              }
            }}
            isRegenerating={isRegenerating}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="border-t border-(--color-border) py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-1 px-4 text-center text-xs text-(--color-text-faint) sm:px-6 lg:px-8">
          <p>Files are processed for this request only and are not stored.</p>
        </div>
      </footer>
    </div>
  );
}
