/**
 * Trazá — motor de análisis de documentos (port del prototipo legacy).
 *
 * Valida partes quirúrgicos / autorizaciones contra reglas de prepagas.
 * Devuelve findings con severidad y, cuando corresponde, spans con la
 * ubicación del hallazgo en el texto para resaltar sobre el preview.
 */
import type {
  AnalysisResult,
  Finding,
  FindingSpan,
  Nomenclador,
  OcrPage,
} from "./types";

// Prepagas reconocidas en el texto del documento.
export const PREPAGAS = [
  "Swiss Medical",
  "OSDE",
  "Galeno",
  "Medicus",
  "Omint",
  "Medifé",
  "Sancor Salud",
  "Hospital Italiano",
  "Hospital Británico",
  "Prevención Salud",
] as const;

// Sanatorios frecuentes.
export const SANATORIOS = [
  "Otamendi",
  "Mater Dei",
  "Los Arcos",
  "Suizo Argentino",
  "Finochietto",
  "Clínica Santa Isabel",
  "Instituto Argentino de Diagnóstico",
  "Clínica Bazterrica",
] as const;

// Campos verificables que todo parte quirúrgico debería tener.
// Los no-verificables (paciente, DNI, afiliado, cirujano, firma) se omiten
// intencionalmente hasta definir cómo encararlos con el sanatorio.
interface RequiredField {
  key: "prepaga" | "fecha" | "procedimiento" | "codigo" | "sanatorio" | "anestesia" | "diagnostico";
  labels: string[];
  severity: "error" | "warn";
}

export const REQUIRED_FIELDS: RequiredField[] = [
  { key: "prepaga", labels: ["prepaga", "obra social", "convenio", "financiador", "cobertura"], severity: "error" },
  { key: "fecha", labels: ["fecha"], severity: "error" },
  { key: "procedimiento", labels: ["procedimiento", "práctica", "intervención", "cirugía", "operación"], severity: "error" },
  { key: "codigo", labels: ["código", "codigo nomenclador", "nomenclador", "cod. nomenclador"], severity: "error" },
  { key: "sanatorio", labels: ["sanatorio", "clínica", "institución", "centro asistencial"], severity: "warn" },
  { key: "anestesia", labels: ["anestesia", "tipo de anestesia"], severity: "warn" },
  { key: "diagnostico", labels: ["diagnóstico", "dx"], severity: "error" },
];

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Busca los bounding boxes en las palabras OCR/PDF que componen una frase.
// Soporta needles multi-palabra: busca secuencias consecutivas de palabras.
function findSpans(needle: string, ocrPages: OcrPage[] | undefined): FindingSpan[] {
  if (!ocrPages || !needle) return [];
  const needleTokens = stripAccents(needle.toLowerCase())
    .replace(/[^\w\s.\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (needleTokens.length === 0) return [];

  const spans: FindingSpan[] = [];
  for (const page of ocrPages) {
    const words = page.words || [];
    for (let i = 0; i <= words.length - needleTokens.length; i++) {
      let matched = true;
      for (let j = 0; j < needleTokens.length; j++) {
        const wordText = stripAccents((words[i + j].text || "").toLowerCase()).replace(/[^\w.\-]/g, "");
        const nt = needleTokens[j];
        if (wordText !== nt && !wordText.includes(nt) && !nt.includes(wordText)) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const bboxes = [];
        for (let j = 0; j < needleTokens.length; j++) bboxes.push(words[i + j].bbox);
        const x0 = Math.min(...bboxes.map((b) => b.x0));
        const y0 = Math.min(...bboxes.map((b) => b.y0));
        const x1 = Math.max(...bboxes.map((b) => b.x1));
        const y1 = Math.max(...bboxes.map((b) => b.y1));
        spans.push({
          page: page.page,
          bbox: { x0, y0, x1, y1 },
          canvasWidth: page.width,
          canvasHeight: page.height,
        });
        i += needleTokens.length - 1;
      }
    }
  }
  return spans;
}

function fieldLabel(key: RequiredField["key"]): string {
  return (
    {
      prepaga: "prepaga / obra social",
      fecha: "fecha",
      procedimiento: "procedimiento",
      codigo: "código de nomenclador",
      sanatorio: "sanatorio / institución",
      anestesia: "tipo de anestesia",
      diagnostico: "diagnóstico",
    }[key] || key
  );
}

export function analyzeDocument(
  text: string,
  fileName: string,
  ocrWords: OcrPage[] | undefined,
  nomenclador: Nomenclador,
): AnalysisResult {
  const lower = stripAccents(text.toLowerCase());
  const findings: Finding[] = [];

  // 1. Campos presentes
  const foundFields: Record<string, boolean> = {};
  for (const field of REQUIRED_FIELDS) {
    const hit = field.labels.find((l) => lower.includes(stripAccents(l.toLowerCase())));
    if (hit) foundFields[field.key] = true;
  }

  // 2. Procedimiento mencionado por keyword
  let procedureGuess: AnalysisResult["detected"]["procedureGuess"] = null;
  for (const entry of nomenclador.keywords) {
    for (const kw of entry.keywords) {
      if (lower.includes(stripAccents(kw.toLowerCase()))) {
        procedureGuess = {
          keyword: kw,
          code: entry.code,
          desc: nomenclador.codes[entry.code]?.desc,
        };
        break;
      }
    }
    if (procedureGuess) break;
  }

  // 3. Códigos de nomenclador presentes en el texto
  const codeRegex = /\b(\d{2}[.\-]\d{2}[.\-]\d{2}|\d{4,6})\b/g;
  const rawCodes = [...new Set([...text.matchAll(codeRegex)].map((m) => m[1]))];
  const validCodes: string[] = [];
  for (const raw of rawCodes) {
    const normalized = raw.replace(/-/g, ".");
    if (nomenclador.codes[normalized]) validCodes.push(normalized);
    else if (nomenclador.codes[raw]) validCodes.push(raw);
  }

  if (validCodes.length > 0) {
    for (const code of validCodes) {
      findings.push({
        severity: "ok",
        code: `CODE_OK_${code}`,
        title: `Código ${code} válido`,
        body: `${nomenclador.codes[code].desc} — reconocido en el nomenclador de Swiss Medical.`,
        spans: findSpans(code, ocrWords),
      });
    }
  } else if (procedureGuess) {
    findings.push({
      severity: "error",
      code: "NO_CODE_SUGGEST",
      title: "Falta el código de nomenclador",
      body: `El documento menciona "${procedureGuess.keyword}" pero no incluye el código correspondiente. Sin código la prepaga no puede procesar la liquidación.`,
      action: `Agregar código ${procedureGuess.code} — ${procedureGuess.desc}.`,
      suggestion: { code: procedureGuess.code, desc: procedureGuess.desc },
      spans: findSpans(procedureGuess.keyword, ocrWords),
    });
  } else {
    findings.push({
      severity: "error",
      code: "NO_CODE",
      title: "Falta el código de nomenclador",
      body: "No se detectó un código de facturación en el documento. Sin código la prepaga no puede procesar la liquidación.",
      action: "Agregar el código correspondiente del nomenclador de la prepaga.",
    });
  }

  // 4. Campos faltantes (verificables)
  for (const field of REQUIRED_FIELDS) {
    if (field.key === "codigo") continue;
    if (!foundFields[field.key]) {
      findings.push({
        severity: field.severity,
        code: `MISSING_${field.key.toUpperCase()}`,
        title: `Falta ${fieldLabel(field.key)}`,
        body: `No se detecta el campo "${field.labels[0]}" en el documento. Este campo es requerido por las prepagas para procesar la liquidación.`,
        action: `Agregar ${fieldLabel(field.key)} al documento antes de presentar.`,
      });
    }
  }

  // 5. Prepagas / sanatorios detectados
  const prepagasDetectadas = PREPAGAS.filter((p) => lower.includes(stripAccents(p.toLowerCase())));
  const sanatoriosDetectados = SANATORIOS.filter((s) => lower.includes(stripAccents(s.toLowerCase())));

  // 6. Fechas + plazo
  const fechaRegex = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g;
  const fechas = [...text.matchAll(fechaRegex)].map((m) => m[0]);
  if (fechas.length > 0) {
    try {
      const fechaStr = fechas[0];
      const parts = fechaStr.split(/[\/\-]/).map(Number);
      const [d, m] = parts;
      let y = parts[2];
      if (y < 100) y += 2000;
      const fechaPractica = new Date(y, m - 1, d);
      const hoy = new Date();
      const diasDesde = Math.floor((hoy.getTime() - fechaPractica.getTime()) / 86400000);
      const plazoLimite = 60;
      if (diasDesde > plazoLimite) {
        findings.push({
          severity: "error",
          code: "PLAZO_VENCIDO",
          title: "Plazo de presentación posiblemente vencido",
          body: `La fecha detectada (${fechaStr}) es de hace ${diasDesde} días. El plazo estándar de re-facturación es de 60 días.`,
          action: "Verificar con la prepaga si la presentación es aún admisible.",
          spans: findSpans(fechaStr, ocrWords),
        });
      } else if (diasDesde > 30) {
        findings.push({
          severity: "warn",
          code: "PLAZO_CERCANO",
          title: "Plazo de presentación próximo",
          body: `La fecha detectada (${fechaStr}) es de hace ${diasDesde} días. Quedan ${plazoLimite - diasDesde} días hasta el vencimiento.`,
          action: "Presentar la liquidación en los próximos días.",
          spans: findSpans(fechaStr, ocrWords),
        });
      } else {
        findings.push({
          severity: "ok",
          code: "PLAZO_OK",
          title: "Dentro del plazo de presentación",
          body: `La fecha detectada (${fechaStr}) está dentro del plazo normal de 60 días.`,
        });
      }
    } catch {
      /* ignorar fechas mal formadas */
    }
  }

  // 7. Legibilidad
  const wordCount = text.split(/\s+/).filter((w) => w.length > 2).length;
  if (wordCount < 20) {
    findings.push({
      severity: "warn",
      code: "LOW_CONTENT",
      title: "Contenido escaso o ilegible",
      body: `Solo se pudieron reconocer ${wordCount} palabras. El documento puede estar mal escaneado o incompleto.`,
      action: "Re-escanear en mayor resolución o solicitar copia legible.",
    });
  }

  const summary = {
    ok: findings.filter((f) => f.severity === "ok").length,
    warn: findings.filter((f) => f.severity === "warn").length,
    error: findings.filter((f) => f.severity === "error").length,
  };
  const overall: AnalysisResult["overall"] =
    summary.error > 0 ? "error" : summary.warn > 0 ? "warn" : "ok";

  return {
    findings,
    summary,
    overall,
    detected: {
      codes: validCodes,
      prepagas: [...prepagasDetectadas],
      sanatorios: [...sanatoriosDetectados],
      fechas: fechas.slice(0, 3),
      procedureGuess,
    },
    fileName,
    analyzedAt: new Date().toISOString(),
  };
}
