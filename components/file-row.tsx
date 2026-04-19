"use client";

import { Icon } from "./icon";
import type { TrazaFile } from "@/lib/analysis/types";

interface FileRowProps {
  file: TrazaFile;
  onClick: () => void;
  onRemove: () => void;
  isSelected: boolean;
}

export function FileRow({ file, onClick, onRemove, isSelected }: FileRowProps) {
  const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
  const size = (file.size / 1024).toFixed(0) + " KB";

  return (
    <div
      role="button"
      tabIndex={0}
      className={`file-row ${isSelected ? "open" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="file-thumb">
        {file.thumbnails?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.thumbnails[0].dataUrl}
            alt={`preview de ${file.name}`}
          />
        ) : (
          ext
        )}
      </div>
      <div className="file-main">
        <div className="file-name">{file.name}</div>
        <div className="file-meta">
          {size} ·{" "}
          {new Date(file.addedAt).toLocaleString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {file.method && (
            <> · {file.method === "ocr" ? "OCR aplicado" : "texto PDF"}</>
          )}
        </div>
        {file.status === "analyzing" && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11.5,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span className="spinner" />
            {file.progressMessage}
            <div className="progress-bar" style={{ flex: 1, maxWidth: 180 }}>
              <div
                className="progress-fill"
                style={{ width: `${(file.progress || 0) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="file-status">
        {file.status === "analyzing" && (
          <span className="badge badge-neutral">
            <span className="badge-dot" />
            Analizando
          </span>
        )}
        {file.status === "analyzed" && file.analysis?.overall === "ok" && (
          <span className="badge badge-ok">
            <span className="badge-dot" />
            Sin errores
          </span>
        )}
        {file.status === "analyzed" && file.analysis?.overall === "warn" && (
          <span className="badge badge-warn">
            <span className="badge-dot" />
            {file.analysis.summary.warn} advertencia
            {file.analysis.summary.warn > 1 ? "s" : ""}
          </span>
        )}
        {file.status === "analyzed" && file.analysis?.overall === "error" && (
          <span className="badge badge-error">
            <span className="badge-dot" />
            {file.analysis.summary.error} error
            {file.analysis.summary.error > 1 ? "es" : ""}
          </span>
        )}
        {file.status === "error" && (
          <span className="badge badge-error">
            <span className="badge-dot" />
            Falló
          </span>
        )}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Icon name="eye" size={12} /> Ver
      </button>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Eliminar ${file.name}`}
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  );
}
