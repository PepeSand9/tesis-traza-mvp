"use client";

/**
 * Extracción de texto + bounding boxes desde PDFs e imágenes.
 * Corre solo del lado del cliente. PDF.js y Tesseract.js se cargan de forma
 * dinámica para no inflar el bundle inicial.
 */
import type {
  ExtractionProgress,
  ExtractionResult,
  OcrPage,
  OcrWord,
  Thumbnail,
} from "./types";

type ProgressHandler = (p: ExtractionProgress) => void;

// Cache de los módulos dinámicos para no re-importarlos en cada archivo.
let pdfjsLibPromise: Promise<typeof import("pdfjs-dist/build/pdf")> | null = null;
let tesseractModulePromise: Promise<typeof import("tesseract.js")> | null = null;

async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/build/pdf").then((mod) => {
      // El worker se carga desde el mismo CDN que la lib para evitar conflictos de versión.
      mod.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      return mod;
    });
  }
  return pdfjsLibPromise;
}

async function getTesseract() {
  if (!tesseractModulePromise) {
    tesseractModulePromise = import("tesseract.js");
  }
  return tesseractModulePromise;
}

export async function extractText(
  file: File,
  onProgress?: ProgressHandler,
): Promise<ExtractionResult> {
  const type = file.type;
  if (type === "application/pdf") return extractFromPdf(file, onProgress);
  if (type.startsWith("image/")) return extractFromImage(file, onProgress);
  throw new Error("Formato no soportado: " + type);
}

async function extractFromPdf(
  file: File,
  onProgress?: ProgressHandler,
): Promise<ExtractionResult> {
  onProgress?.({ progress: 0.1, message: "Leyendo PDF..." });
  const arrayBuffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let allText = "";
  const thumbnails: Thumbnail[] = [];
  let ocrWords: OcrPage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const SCALE = 1.8;
    const viewport = page.getViewport({ scale: SCALE });

    const textContent = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = textContent.items.map((i: any) => i.str).join(" ");
    allText += pageText + "\n";

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener contexto 2D del canvas");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.render({ canvasContext: ctx as any, viewport }).promise;
    thumbnails.push({
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });

    // Convertir items del texto embebido a "words" con bbox en coords del canvas.
    if (pageText.trim().length > 20) {
      const pageWords: OcrWord[] = [];
      for (const item of textContent.items as unknown as Array<{
        str: string;
        width: number;
        transform: number[];
      }>) {
        if (!item.str || !item.str.trim()) continue;
        const tx = item.transform;
        const m = pdfjsLib.Util.transform(viewport.transform, tx);
        const fontHeight = Math.hypot(m[2], m[3]);
        const widthPdf = item.width || item.str.length * (Math.abs(tx[0]) || 12) * 0.5;
        const widthCanvas = widthPdf * SCALE;
        const baseX = m[4];
        const baseY = m[5];
        const x0 = baseX;
        const y0 = baseY - fontHeight;
        const x1 = baseX + widthCanvas;
        const y1 = baseY;
        const tokens = item.str.split(/\s+/).filter((t) => t.length > 0);
        if (tokens.length === 0) continue;
        const totalChars = item.str.length || 1;
        let cursor = 0;
        for (const tok of tokens) {
          const wx0 = x0 + (cursor / totalChars) * widthCanvas;
          const wx1 = x0 + ((cursor + tok.length) / totalChars) * widthCanvas;
          pageWords.push({
            text: tok,
            bbox: { x0: wx0, y0, x1: wx1, y1 },
          });
          cursor += tok.length + 1;
        }
      }
      ocrWords.push({
        page: p - 1,
        words: pageWords,
        width: canvas.width,
        height: canvas.height,
      });
    }

    onProgress?.({
      progress: 0.1 + 0.3 * (p / pdf.numPages),
      message: `Procesando página ${p}/${pdf.numPages}...`,
    });
  }

  let method: ExtractionResult["method"] = "pdf-text";
  if (allText.trim().length < 50) {
    method = "ocr";
    allText = "";
    ocrWords = [];
    for (let i = 0; i < thumbnails.length; i++) {
      const res = await ocrImageWithWords(thumbnails[i].dataUrl, (p) => {
        onProgress?.({
          progress: 0.4 + 0.55 * ((i + p) / thumbnails.length),
          message: `OCR página ${i + 1}/${thumbnails.length}`,
        });
      });
      allText += res.text + "\n";
      ocrWords.push({
        page: i,
        words: res.words,
        width: thumbnails[i].width,
        height: thumbnails[i].height,
      });
    }
  }

  onProgress?.({ progress: 1, message: "Listo" });
  return { text: allText, thumbnails, method, ocrWords };
}

async function extractFromImage(
  file: File,
  onProgress?: ProgressHandler,
): Promise<ExtractionResult> {
  onProgress?.({ progress: 0.1, message: "Cargando imagen..." });
  const dataUrl = await fileToDataUrl(file);
  const dim = await imageDimensions(dataUrl);
  onProgress?.({ progress: 0.2, message: "Aplicando OCR..." });
  const res = await ocrImageWithWords(dataUrl, (p) => {
    onProgress?.({ progress: 0.2 + 0.75 * p, message: "Reconociendo texto..." });
  });
  onProgress?.({ progress: 1, message: "Listo" });
  return {
    text: res.text,
    thumbnails: [{ dataUrl, width: dim.width, height: dim.height }],
    method: "ocr",
    ocrWords: [{ page: 0, words: res.words, width: dim.width, height: dim.height }],
  };
}

function imageDimensions(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function ocrImageWithWords(
  dataUrl: string,
  onProg: (p: number) => void,
): Promise<{ text: string; words: OcrWord[] }> {
  const Tesseract = await getTesseract();
  const { data } = await Tesseract.recognize(dataUrl, "spa", {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === "recognizing text" && onProg) onProg(m.progress || 0);
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const words = ((data as any).words || []) as Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    confidence: number;
  }>;
  return {
    text: data.text,
    words: words.map((w) => ({
      text: w.text,
      bbox: w.bbox,
      confidence: w.confidence,
    })),
  };
}
