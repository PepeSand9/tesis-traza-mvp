/**
 * Tipos compartidos del motor de análisis de Trazá.
 */

export type Severity = "error" | "warn" | "ok" | "info";

export interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FindingSpan {
  page: number;
  bbox: Bbox;
  canvasWidth: number;
  canvasHeight: number;
}

export interface Finding {
  severity: Severity;
  code: string;
  title: string;
  body: string;
  action?: string;
  suggestion?: { code: string; desc?: string };
  spans?: FindingSpan[];
}

export interface AnalysisSummary {
  ok: number;
  warn: number;
  error: number;
}

export interface AnalysisResult {
  findings: Finding[];
  summary: AnalysisSummary;
  overall: "ok" | "warn" | "error";
  detected: {
    codes: string[];
    prepagas: string[];
    sanatorios: string[];
    fechas: string[];
    procedureGuess: {
      keyword: string;
      code: string;
      desc?: string;
    } | null;
  };
  fileName: string;
  analyzedAt: string;
}

export interface OcrWord {
  text: string;
  bbox: Bbox;
  confidence?: number;
}

export interface OcrPage {
  page: number;
  words: OcrWord[];
  width: number;
  height: number;
}

export interface Thumbnail {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ExtractionProgress {
  progress: number;
  message: string;
}

export interface ExtractionResult {
  text: string;
  thumbnails: Thumbnail[];
  method: "pdf-text" | "ocr";
  ocrWords: OcrPage[];
}

export type FileStatus = "analyzing" | "analyzed" | "error";

export interface TrazaFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
  status: FileStatus;
  progress?: number;
  progressMessage?: string;
  text?: string;
  thumbnails?: Thumbnail[];
  method?: "pdf-text" | "ocr";
  ocrWords?: OcrPage[];
  analysis?: AnalysisResult;
  errorMessage?: string;
}

export interface NomencladorEntry {
  desc: string;
  specialty: string;
}

export interface KeywordEntry {
  keywords: string[];
  code: string;
}

export interface Nomenclador {
  codes: Record<string, NomencladorEntry>;
  keywords: KeywordEntry[];
}
