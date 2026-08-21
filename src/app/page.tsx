"use client";

import { useCallback, useRef, useState } from "react";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingState } from "@/components/ProcessingState";
import { SummaryView } from "@/components/SummaryView";
import type { AppState, SummaryLength, SummarizeResponse } from "@/lib/client-types";

async function callSummarizeApi(file: File, length: SummaryLength, signal: AbortSignal): Promise<SummarizeResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("length", length);

  const res = await fetch("/api/summarize", { method: "POST", body: formData, signal });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Something went wrong. Please try again.");
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
      setState({ phase: "error", message: err instanceof Error ? err.message : "Unexpected error." });
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Document Summary Assistant</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload a PDF or image. Get an AI-generated summary, key points, and improvement suggestions — nothing is stored.
        </p>
      </header>

      {state.phase === "idle" && <UploadZone onFileSelected={handleFileSelected} />}

      {state.phase === "processing" && <ProcessingState filename={state.file.name} />}

      {state.phase === "error" && (
        <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">{state.message}</p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Try Again
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
  );
}
