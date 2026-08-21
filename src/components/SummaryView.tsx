"use client";

import { useState } from "react";
import type { SummarizeResponse, SummaryLength } from "@/lib/client-types";

interface SummaryViewProps {
  result: SummarizeResponse;
  length: SummaryLength;
  onLengthChange: (length: SummaryLength) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  onReset: () => void;
}

const LENGTH_OPTIONS: { value: SummaryLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SummaryView({ result, length, onLengthChange, onRegenerate, isRegenerating, onReset }: SummaryViewProps) {
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = [
      `Summary:\n${result.summary}`,
      `Key Points:\n${result.keyPoints.map((p) => `- ${p}`).join("\n")}`,
      `Main Ideas:\n${result.mainIdeas.map((p) => `- ${p}`).join("\n")}`,
      `Improvement Suggestions:\n${result.improvementSuggestions.map((p) => `- ${p}`).join("\n")}`,
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) — fail silently, non-critical.
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{result.filename}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {result.extractionMethod === "ocr"
              ? "Extracted via OCR"
              : result.extractionMethod === "pdf-ocr"
                ? "Scanned PDF — extracted via OCR"
                : "Extracted from PDF text"}
            {result.pageCount ? ` · ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Summary length" className="flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={length === opt.value}
                disabled={isRegenerating}
                onClick={() => onLengthChange(opt.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                  length === opt.value
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>

      {result.warning && (
        <p role="status" className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {result.warning}
        </p>
      )}

      <Section title="Summary">
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-200">{result.summary}</p>
      </Section>

      <Section title="Key Points">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {result.keyPoints.map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      </Section>

      <Section title="Main Ideas">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {result.mainIdeas.map((idea, i) => (
            <li key={i}>{idea}</li>
          ))}
        </ul>
      </Section>

      <Section title="Improvement Suggestions">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-700 dark:text-slate-200">
          {result.improvementSuggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </Section>

      <Section title="Source Text">
        <button
          type="button"
          onClick={() => setShowSource((s) => !s)}
          aria-expanded={showSource}
          className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {showSource ? "Hide extracted text" : "Show extracted text"}
        </button>
        {showSource && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            {result.sourceTextPreview}
          </pre>
        )}
      </Section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          {copied ? "Copied!" : "Copy Summary"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          New Document
        </button>
      </div>
    </div>
  );
}
