"use client";

import { useState } from "react";
import type { SummarizeResponse, SummaryLength } from "@/lib/client-types";
import { useToast } from "./Toast";
import { CheckCircleIcon, CopyIcon, ChevronDownIcon, SparkleIcon, FilePdfIcon, FileImageIcon } from "./icons";

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

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-surface) p-5 sm:p-6 ${className}`}
    >
      <h2 className="mb-3 text-xs font-semibold tracking-wide text-(--color-text-muted) uppercase">{title}</h2>
      {children}
    </section>
  );
}

function useCopy() {
  const { showToast } = useToast();
  const [justCopiedKey, setJustCopiedKey] = useState<string | null>(null);

  async function copy(key: string, text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setJustCopiedKey(key);
      showToast(`${label} copied to clipboard`, "success");
      setTimeout(() => setJustCopiedKey((k) => (k === key ? null : k)), 1600);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) — surface it, non-fatal.
      showToast("Couldn't copy — your browser blocked clipboard access", "error");
    }
  }

  return { copy, justCopiedKey };
}

export function SummaryView({ result, length, onLengthChange, onRegenerate, isRegenerating, onReset }: SummaryViewProps) {
  const [showSource, setShowSource] = useState(false);
  const { copy, justCopiedKey } = useCopy();

  const fullText = [
    `Summary:\n${result.summary}`,
    `Key Points:\n${result.keyPoints.map((p) => `- ${p}`).join("\n")}`,
    `Main Ideas:\n${result.mainIdeas.map((p) => `- ${p}`).join("\n")}`,
    `Improvement Suggestions:\n${result.improvementSuggestions.map((p) => `- ${p}`).join("\n")}`,
  ].join("\n\n");

  const keyPointsText = result.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n");

  const isImage = result.extractionMethod === "ocr";
  const extractionLabel =
    result.extractionMethod === "ocr"
      ? "Extracted via OCR"
      : result.extractionMethod === "pdf-ocr"
        ? "Scanned PDF — extracted via OCR"
        : "Extracted from PDF text";

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Document header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-(--color-border) bg-(--color-surface) p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-(--color-info-bg) text-(--color-primary)">
            {isImage ? <FileImageIcon className="h-5 w-5" /> : <FilePdfIcon className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-(--color-text)" title={result.filename}>
              {result.filename}
            </p>
            <p className="text-xs text-(--color-text-muted)">
              {extractionLabel}
              {result.pageCount ? ` · ${result.pageCount} page${result.pageCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label="Summary length" className="flex rounded-[var(--radius-md)] border border-(--color-border) bg-(--color-bg) p-0.5">
            {LENGTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={length === opt.value}
                disabled={isRegenerating}
                onClick={() => onLengthChange(opt.value)}
                className={`rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) disabled:cursor-not-allowed disabled:opacity-50 ${
                  length === opt.value
                    ? "bg-(--color-primary) text-(--color-primary-fg)"
                    : "text-(--color-text-muted) hover:bg-(--color-surface-elevated) hover:text-(--color-text)"
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
            className="rounded-[var(--radius-md)] border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-elevated) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegenerating ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>

      {result.warning && (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-(--color-warning-border) bg-(--color-warning-bg) px-4 py-2.5 text-sm text-(--color-warning)"
        >
          {result.warning}
        </p>
      )}

      {/* Summary — visually dominant */}
      <section className="rounded-[var(--radius-xl)] border border-(--color-border) bg-(--color-surface) p-6 shadow-[var(--shadow-token-sm)] sm:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-(--color-text-muted) uppercase">Summary</h2>
          <button
            type="button"
            onClick={() => copy("summary", result.summary, "Summary")}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-xs font-medium text-(--color-text-muted) transition-colors hover:bg-(--color-surface-elevated) hover:text-(--color-text) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
          >
            {justCopiedKey === "summary" ? (
              <>
                <CheckCircleIcon className="h-3.5 w-3.5 text-(--color-success)" /> Copied
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        </div>
        <p className="whitespace-pre-line text-base leading-relaxed text-(--color-text)">{result.summary}</p>
      </section>

      {/* Key points */}
      <SectionCard title="Key Points">
        <ol className="flex flex-col gap-3">
          {result.keyPoints.map((point, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-(--color-text)">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-(--color-info-bg) text-[11px] font-semibold text-(--color-primary)">
                {i + 1}
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* Main ideas */}
      <SectionCard title="Main Ideas">
        <ul className="flex flex-col gap-2.5">
          {result.mainIdeas.map((idea, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-(--color-text)">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-text-faint)" />
              <span>{idea}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Improvement suggestions — visually distinct, clearly generated, not authoritative */}
      <section className="rounded-[var(--radius-lg)] border border-(--color-info-border) bg-(--color-info-bg) p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <SparkleIcon className="h-4 w-4 text-(--color-primary)" />
          <h2 className="text-xs font-semibold tracking-wide text-(--color-primary) uppercase">Improvement Suggestions</h2>
        </div>
        <ul className="flex flex-col gap-2.5">
          {result.improvementSuggestions.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-(--color-text)">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-primary)" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-(--color-text-muted)">AI-generated suggestions — review before acting on them.</p>
      </section>

      {/* Source text */}
      <SectionCard title="Source Text">
        <button
          type="button"
          onClick={() => setShowSource((s) => !s)}
          aria-expanded={showSource}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-primary) hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) rounded-[var(--radius-sm)]"
        >
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${showSource ? "rotate-180" : ""}`} />
          {showSource ? "Hide extracted text" : "Show extracted text"}
        </button>
        {showSource && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-(--color-border) bg-(--color-bg) p-4 text-xs leading-relaxed whitespace-pre-wrap break-words text-(--color-text-muted)">
            {result.sourceTextPreview}
          </pre>
        )}
      </SectionCard>

      {/* Action bar */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={() => copy("full", fullText, "Full summary")}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-(--color-primary-fg) transition-colors hover:bg-(--color-primary-hover) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2"
        >
          {justCopiedKey === "full" ? <CheckCircleIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          Copy Summary
        </button>
        <button
          type="button"
          onClick={() => copy("keypoints", keyPointsText, "Key points")}
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-(--color-border) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-elevated) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          {justCopiedKey === "keypoints" ? <CheckCircleIcon className="h-4 w-4 text-(--color-success)" /> : <CopyIcon className="h-4 w-4" />}
          Copy Key Points
        </button>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto rounded-[var(--radius-md)] border border-(--color-border) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-colors hover:bg-(--color-surface-elevated) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          New Document
        </button>
      </div>
    </div>
  );
}
