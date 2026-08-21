export type AppState =
  | { phase: "idle" }
  | { phase: "validating"; file: File }
  | { phase: "processing"; file: File }
  | { phase: "complete"; result: SummarizeResponse }
  | { phase: "error"; message: string; code?: string };

export interface SummarizeResponse {
  filename: string;
  extractionMethod: "pdf-text" | "ocr" | "pdf-ocr";
  pageCount?: number;
  warning?: string;
  sourceTextPreview: string;
  summary: string;
  keyPoints: string[];
  mainIdeas: string[];
  improvementSuggestions: string[];
}

export type SummaryLength = "short" | "medium" | "long";

export const ACCEPTED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
export const MAX_FILE_MB = 15;
