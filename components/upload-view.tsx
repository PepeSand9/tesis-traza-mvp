"use client";

import { useRef, useState } from "react";
import { Icon } from "./icon";
import { FileRow } from "./file-row";
import { AnalysisDetail } from "./analysis-detail";
import { extractText } from "@/lib/analysis/extract";
import { analyzeDocument } from "@/lib/analysis/engine";
import { loadNomenclador } from "@/lib/analysis/nomenclador";
import type { TrazaFile } from "@/lib/analysis/types";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/jpg,image/webp";

interface UploadViewProps {
  files: TrazaFile[];
  onUpsertFile: (entry: TrazaFile) => void;
  onRemoveFile: (id: string) => void;
  onSelectFile: (id: string | null) => void;
  selectedFileId: string | null;
}

export function UploadView({
  files,
  onUpsertFile,
  onRemoveFile,
  onSelectFile,
  selectedFileId,
}: UploadViewProps) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: File[]) {
    const nomenclador = await loadNomenclador();
    for (const file of fileList) {
      const id =
        "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
      const baseEntry: TrazaFile = {
        id,
        name: file.name,
        size: file.size,
        type: file.type,
        addedAt: new Date().toISOString(),
        status: "analyzing",
        progress: 0,
        progressMessage: "Iniciando...",
      };
      onUpsertFile(baseEntry);

      try {
        const { text, thumbnails, method, ocrWords } = await extractText(
          file,
          (p) => {
            onUpsertFile({
              ...baseEntry,
              progress: p.progress,
              progressMessage: p.message,
            });
          },
        );

        const analysis = analyzeDocument(text, file.name, ocrWords, nomenclador);

        onUpsertFile({
          ...baseEntry,
          status: "analyzed",
          progress: 1,
          text,
          thumbnails,
          method,
          ocrWords,
          analysis,
        });
      } catch (err) {
        console.error(err);
        onUpsertFile({
          ...baseEntry,
          status: "error",
          errorMessage:
            err instanceof Error ? err.message : "Error procesando archivo",
        });
      }
    }
  }

  const selected = files.find((f) => f.id === selectedFileId);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Cargar documentos</h1>
          <p className="page-subtitle">
            Subí parte quirúrgico, autorizaciones u otra documentación. Trazá
            detecta automáticamente errores comunes antes de que presentes.
          </p>
        </div>
        {files.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="upload" size={14} /> Subir más
          </button>
        )}
      </div>

      {files.length === 0 && (
        <div
          className={`upload-zone ${drag ? "drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handleFiles(Array.from(e.dataTransfer.files));
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <div className="upload-icon">
            <Icon name="upload" size={48} />
          </div>
          <div className="upload-title">
            Arrastrá archivos acá o hacé click para subir
          </div>
          <div className="upload-hint">
            Trazá analiza cada documento y detecta errores antes de que
            presentes
          </div>
          <div className="upload-formats">
            <span className="fmt">PDF</span>
            <span className="fmt">PNG</span>
            <span className="fmt">JPG</span>
            <span className="fmt">JPEG</span>
            <span className="fmt">WEBP</span>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          const list = e.target.files;
          if (list) handleFiles(Array.from(list));
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onClick={() => onSelectFile(f.id)}
              onRemove={() => onRemoveFile(f.id)}
              isSelected={f.id === selectedFileId}
            />
          ))}
        </div>
      )}

      {selected && selected.status === "analyzed" && (
        <AnalysisDetail file={selected} />
      )}
    </div>
  );
}
