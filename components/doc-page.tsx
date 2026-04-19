"use client";

import type { Bbox, Thumbnail } from "@/lib/analysis/types";

interface SpanOnPage {
  bbox: Bbox;
  severity: "error" | "warn" | "ok" | "info";
}

interface DocPageProps {
  thumb: Thumbnail;
  pageIdx: number;
  spans: SpanOnPage[];
  activeSpanBboxes: Bbox[];
  showPageNum?: boolean;
}

export function DocPage({
  thumb,
  pageIdx,
  spans,
  activeSpanBboxes,
  showPageNum,
}: DocPageProps) {
  const hasActive = activeSpanBboxes.length > 0;
  return (
    <div className="doc-page-wrap">
      <div
        className="doc-page"
        style={{ aspectRatio: `${thumb.width} / ${thumb.height}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb.dataUrl} alt={`página ${pageIdx + 1}`} />
        <svg
          className="doc-overlay"
          viewBox={`0 0 ${thumb.width} ${thumb.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {spans.map((s, i) => {
            const { x0, y0, x1, y1 } = s.bbox;
            const isActive = activeSpanBboxes.some(
              (b) => b.x0 === x0 && b.y0 === y0,
            );
            const dim = hasActive && !isActive;
            return (
              <rect
                key={i}
                x={x0 - 4}
                y={y0 - 4}
                width={x1 - x0 + 8}
                height={y1 - y0 + 8}
                className={`highlight-rect sev-${s.severity} ${
                  isActive ? "active" : ""
                } ${dim ? "dim" : ""}`}
                rx={3}
              />
            );
          })}
        </svg>
      </div>
      {showPageNum && <div className="doc-page-num">Pág {pageIdx + 1}</div>}
    </div>
  );
}
