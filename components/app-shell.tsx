"use client";

import { useCallback, useState } from "react";
import { Sidebar, type ActiveView } from "./sidebar";
import { UploadView } from "./upload-view";
import { ErrorsView } from "./errors-view";
import type { TrazaFile } from "@/lib/analysis/types";

export function AppShell() {
  const [active, setActive] = useState<ActiveView>("upload");
  const [files, setFiles] = useState<TrazaFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const upsertFile = useCallback((entry: TrazaFile) => {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === entry.id);
      if (idx === -1) return [entry, ...prev];
      const copy = [...prev];
      copy[idx] = entry;
      return copy;
    });
    // Auto-seleccionar cuando termina de analizarse.
    if (entry.status === "analyzed") {
      setSelectedFileId(entry.id);
    }
  }, []);

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => prev.filter((f) => f.id !== id));
      if (selectedFileId === id) setSelectedFileId(null);
    },
    [selectedFileId],
  );

  const openFile = useCallback((id: string) => {
    setActive("upload");
    setSelectedFileId(id);
    setTimeout(() => {
      const el = document.querySelector(".analysis-detail");
      if (el instanceof HTMLElement) {
        window.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
      }
    }, 100);
  }, []);

  const errorCount = files.reduce((acc, f) => {
    if (!f.analysis) return acc;
    return acc + f.analysis.summary.error;
  }, 0);

  return (
    <div className="app">
      <Sidebar
        active={active}
        setActive={setActive}
        errorCount={errorCount}
      />
      <main className="main">
        {active === "upload" && (
          <UploadView
            files={files}
            onUpsertFile={upsertFile}
            onRemoveFile={removeFile}
            onSelectFile={setSelectedFileId}
            selectedFileId={selectedFileId}
          />
        )}
        {active === "errors" && (
          <ErrorsView files={files} onOpenFile={openFile} />
        )}
      </main>
    </div>
  );
}
