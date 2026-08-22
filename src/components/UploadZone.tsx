"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB } from "@/lib/client-types";
import { UploadIcon, AlertCircleIcon } from "./icons";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelected, disabled }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndEmit = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setLocalError(null);

      const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setLocalError("Unsupported file type. Please use PDF, PNG, JPEG, or WEBP.");
        return;
      }
      if (file.size === 0) {
        setLocalError("This file is empty.");
        return;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setLocalError(`File is too large. Maximum size is ${MAX_FILE_MB}MB.`);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Upload a document by dragging and dropping, or activate to choose a file"
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (disabled) return;
          validateAndEmit(e.dataTransfer.files?.[0]);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`group relative flex min-h-72 flex-col items-center justify-center gap-4 rounded-[var(--radius-xl)] border-2 border-dashed p-8 text-center transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-offset-2 sm:min-h-80 sm:p-12 ${
          disabled
            ? "cursor-not-allowed border-(--color-border) bg-(--color-surface) opacity-50"
            : isDragOver
              ? "cursor-pointer scale-[1.005] border-(--color-primary) bg-(--color-info-bg)"
              : "cursor-pointer border-(--color-border-strong) bg-(--color-surface) hover:border-(--color-primary) hover:bg-(--color-surface-elevated)"
        }`}
      >
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
            isDragOver ? "bg-(--color-primary) text-(--color-primary-fg)" : "bg-(--color-info-bg) text-(--color-primary)"
          }`}
        >
          <UploadIcon className="h-6 w-6" />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-base font-medium text-(--color-text)">
            {isDragOver ? "Drop to upload" : "Drag & drop your document here"}
          </p>
          <p className="text-sm text-(--color-text-muted)">
            {isDragOver ? "Release to start" : "or click anywhere in this area to browse"}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
          {["PDF", "PNG", "JPEG", "WEBP"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-full border border-(--color-border) bg-(--color-surface-elevated) px-2.5 py-1 text-xs font-medium text-(--color-text-muted)"
            >
              {fmt}
            </span>
          ))}
          <span className="px-1 text-xs text-(--color-text-faint)">up to {MAX_FILE_MB}MB</span>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          disabled={disabled}
          onChange={(e) => validateAndEmit(e.target.files?.[0])}
        />
      </div>
      {localError && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-(--color-danger-border) bg-(--color-danger-bg) px-4 py-3 text-sm text-(--color-danger)"
        >
          <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
}
