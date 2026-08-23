import { z } from "zod";

export const SummaryLengthSchema = z.enum(["short", "medium", "long"]);
export type SummaryLength = z.infer<typeof SummaryLengthSchema>;

export const SummaryResultSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string().min(1)).min(1).max(15),
  mainIdeas: z.array(z.string().min(1)).min(1).max(10),
  improvementSuggestions: z.array(z.string().min(1)).min(1).max(10),
});
export type SummaryResult = z.infer<typeof SummaryResultSchema>;

export interface SummarizeInput {
  documentText: string;
  length: SummaryLength;
}

/**
 * Provider-agnostic interface: swapping the underlying model/vendor (Gemini,
 * OpenAI, a local model) means writing a new class that implements this,
 * with no change to callers.
 */
export interface AIProvider {
  generateSummary(input: SummarizeInput): Promise<SummaryResult>;
}
