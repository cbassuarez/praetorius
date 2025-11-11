export interface WorkCue {
  label?: string;
  at?: string | number;
  t?: number;
}

export interface WorkPageFollowRow {
  at: string;
  page: number;
}

export interface WorkPageFollow {
  pdfStartPage: number;
  mediaOffsetSec: number;
  pageMap: WorkPageFollowRow[];
  pdfDelta?: number;
}

export interface Work {
  id: number | string;
  slug: string;
  title: string;
  one?: string;
  oneliner?: string;
  description?: string | string[] | null;
  openNote?: string[] | string;
  audio?: string | null;
  audioUrl?: string | null;
  pdf?: string | null;
  pdfUrl?: string | null;
  cues?: WorkCue[];
  pageFollow?: WorkPageFollow | null;
  score?: WorkPageFollow | null;
  [key: string]: unknown;
}

export interface WorkViewModel extends Work {
  one: string;
  onelinerEffective: string | null;
  descriptionEffective: string | null;
}

export declare function normalizeWork(work: Work): WorkViewModel;
export declare function collectWorkWarnings(work: Work | WorkViewModel): string[];

export declare const __workModelInternals: {
  toSingleLine(value: unknown): string;
  normalizeDescription(value: unknown): string | null;
  stripMarkdown(value: unknown): string;
  deriveOnelinerFromDescription(value: unknown): string;
  clampOneliner(value: string): string;
};
