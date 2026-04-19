"use client";

import { useState } from "react";
import { Icon } from "./icon";
import { DocPage } from "./doc-page";
import type { Bbox, TrazaFile } from "@/lib/analysis/types";

export function AnalysisDetail({ file }: { file: TrazaFile }) {
  const analysis = file.analysis;
  const thumbnails = file.thumbnails;
  const [activeFindingIdx, setActiveFindingIdx] = useState<number | null>(null);

  if (!analysis) return null;

  const sorted = [...analysis.findings].sort((a, b) => {
    const order: Record<string, number> = { error: 0, warn: 1, ok: 2, info: 1 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  const activeFinding =
    activeFindingIdx !== null ? sorted[activeFindingIdx] : null;
  const activeSpans = activeFinding?.spans ?? [];

  // Agrupamos spans por página (solo error/warn; los OK únicamente al click).
  const spansByPage: Record<
    number,
    { bbox: Bbox; severity: "error" | "warn" | "ok" | "info" }[]
  > = {};
  for (const f of sorted) {
    if (!f.spans) continue;
    if (f.severity === "ok") continue;
    for (const s of f.spans) {
      (spansByPage[s.page] = spansByPage[s.page] || []).push({
        bbox: s.bbox,
        severity: f.severity,
      });
    }
  }

  const multiplePages = (thumbnails?.length ?? 0) > 1;

  return (
    <div className="analysis-detail">
      <div className="panel doc-preview">
        <div className="doc-preview-head">
          <div style={{ fontWeight: 600, fontSize: 13 }}>{file.name}</div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--text-soft)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {file.method === "ocr" ? "OCR · español" : "PDF · texto embebido"}
          </div>
        </div>
        <div className="doc-preview-body">
          {thumbnails?.map((thumb, i) => (
            <DocPage
              key={i}
              thumb={thumb}
              pageIdx={i}
              spans={spansByPage[i] ?? []}
              activeSpanBboxes={activeSpans
                .filter((s) => s.page === i)
                .map((s) => s.bbox)}
              showPageNum={multiplePages}
            />
          ))}
          {!thumbnails?.length && (
            <div
              style={{
                padding: 20,
                color: "var(--text-soft)",
                fontSize: 12,
              }}
            >
              Sin preview disponible
            </div>
          )}
        </div>
        <div className="doc-preview-legend">
          <span className="legend-swatch err" /> Error
          <span className="legend-swatch warn" /> Advertencia
          <span
            style={{ color: "var(--text-soft)", marginLeft: "auto" }}
          >
            Click un hallazgo para resaltar
          </span>
        </div>
      </div>

      <div className="panel analysis-result">
        <div className="analysis-head">
          <h3>Resultado del análisis</h3>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {analysis.detected.prepagas.length > 0 && (
              <>
                Prepaga: <b>{analysis.detected.prepagas.join(", ")}</b> ·{" "}
              </>
            )}
            {analysis.detected.codes.length > 0 ? (
              <>
                Código detectado:{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>
                  {analysis.detected.codes.join(", ")}
                </code>
              </>
            ) : (
              <span style={{ color: "var(--text-soft)" }}>
                Sin código detectado
              </span>
            )}
          </div>
        </div>
        <div className="analysis-body">
          <div className="analysis-summary">
            <div className="summary-cell err">
              <div className="n">{analysis.summary.error}</div>
              <div className="l">Errores</div>
            </div>
            <div className="summary-cell warn">
              <div className="n">{analysis.summary.warn}</div>
              <div className="l">Advertencias</div>
            </div>
            <div className="summary-cell ok">
              <div className="n">{analysis.summary.ok}</div>
              <div className="l">OK</div>
            </div>
          </div>

          {sorted.map((f, i) => (
            <div
              key={i}
              className={`finding sev-${f.severity} ${
                activeFindingIdx === i ? "active" : ""
              } ${f.spans?.length ? "clickable" : ""}`}
              onClick={() =>
                f.spans?.length &&
                setActiveFindingIdx(activeFindingIdx === i ? null : i)
              }
            >
              <div className="finding-head">
                <span className="finding-title">{f.title}</span>
                {f.spans && f.spans.length > 0 && (
                  <span className="finding-loc">
                    <Icon name="target" size={11} /> en documento
                  </span>
                )}
              </div>
              <div className="finding-body">{f.body}</div>
              {f.suggestion && (
                <div className="suggestion">
                  <div className="suggestion-label">
                    <Icon name="sparkles" size={12} /> Sugerencia de Trazá
                  </div>
                  <div className="suggestion-card">
                    <div className="suggestion-code">{f.suggestion.code}</div>
                    <div className="suggestion-desc">{f.suggestion.desc}</div>
                  </div>
                  <div className="suggestion-note">
                    Detectamos el procedimiento en el texto. Este es el código
                    de nomenclador que corresponde.
                  </div>
                </div>
              )}
              {f.action && !f.suggestion && (
                <div className="finding-action">→ {f.action}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
