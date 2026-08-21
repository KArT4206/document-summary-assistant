"use client";

import { useCallback, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB } from "@/lib/client-types";

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
        className={`flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
            : isDragOver
              ? "cursor-pointer border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
              : "cursor-pointer border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
        }`}
      >
        <svg
          aria-hidden="true"
          className="h-10 w-10 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
        </svg>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isDragOver ? "Drop your file here" : "Drag & drop a document, or click to browse"}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          PDF, PNG, JPEG, or WEBP · up to {MAX_FILE_MB}MB
        </p>
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
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {localError}
        </p>
      )}
    </div>
  );
}
