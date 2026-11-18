"use client";

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { extractPdfEvidence, extractTechnologies, ExtractedPdfEvidence } from "../../lib/evidence/pdfExtractor";
import { convertExtractedPdfToEvidenceItems, type CreateEvidencePayload } from "@/lib/evidence/evidence-transform";

export function buildSelectedPdfEvidence(
  fileName: string,
  extracted: ExtractedPdfEvidence,
  unselectedBullets: Record<string, boolean>
): ExtractedPdfEvidence {
  const hadSectionLines = Object.values(extracted.sections).some(
    (list) => Array.isArray(list) && list.length > 0
  );
  const filteredSections = { ...extracted.sections };
  (Object.keys(filteredSections) as Array<keyof typeof filteredSections>).forEach((secKey) => {
    const list = filteredSections[secKey];
    if (Array.isArray(list)) {
      filteredSections[secKey] = list.filter(
        (_, bIdx) => !unselectedBullets[`${fileName}:${String(secKey)}:${bIdx}`]
      );
    }
  });
  const remainingText = Object.values(filteredSections).flat().join(" ");
  return {
    ...extracted,
    pages: hadSectionLines ? [] : extracted.pages,
    sections: filteredSections,
    extractedTechnologies: extractTechnologies(remainingText),
  };
}

interface FileState {
  id: string;
  name: string;
  status: "Parsing" | "Extracting" | "Indexed" | "Saving" | "Saved" | "Error";
  progress: number;
  tokenCount: number;
  savedCount?: number;
  extracted?: ExtractedPdfEvidence;
  error?: string;
  retryItems?: PdfEvidenceSaveItem[];
}

export type PdfEvidenceSaveItem = CreateEvidencePayload & { importId: string };

interface Props {
  onComplete?: (items: PdfEvidenceSaveItem[]) => Promise<PdfEvidenceSaveItem[]>;
}

export function BulkPdfDropzone({ onComplete }: Props) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [unselectedBullets, setUnselectedBullets] = useState<Record<string, boolean>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const savingFiles = useRef(new Set<string>());

  const updateFile = (id: string, changes: Partial<FileState>) => {
    setFiles((current) => current.map((file) => file.id === id ? { ...file, ...changes } : file));
  };

  const toggleBulletSelection = (bulletKey: string) => {
    setUnselectedBullets((prev) => ({
      ...prev,
      [bulletKey]: !prev[bulletKey],
    }));
  };

  const handleCommitSelected = async (file: FileState) => {
    if (!onComplete || !file.extracted || file.status === "Saved" || savingFiles.current.has(file.id)) return;
    const items = file.retryItems ?? convertExtractedPdfToEvidenceItems(
      buildSelectedPdfEvidence(file.id, file.extracted, unselectedBullets)
    ).map((item, index) => ({ ...item, importId: `pdf-import-${file.id}-${index}` }));
    if (items.length === 0) {
      updateFile(file.id, { error: "Select a complete entry with at least one bullet to save." });
      return;
    }

    savingFiles.current.add(file.id);
    updateFile(file.id, { status: "Saving", error: undefined });
    let failedItems = items;
    try {
      failedItems = await onComplete(items);
    } catch {
      // Reuse the same request IDs if the result of a save is unknown.
    } finally {
      const savedCount = (file.savedCount ?? 0) + items.length - failedItems.length;
      updateFile(file.id, failedItems.length === 0 ? {
        status: "Saved", progress: 100, savedCount, retryItems: undefined,
      } : {
        status: "Indexed", savedCount, retryItems: failedItems,
        error: savedCount > 0
          ? `Saved ${savedCount}. Could not save ${failedItems.length}. Retry the remaining items.`
          : "Could not save the selected evidence. Your selection is still here. Try again.",
      });
      savingFiles.current.delete(file.id);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetch("/workers/pdf.worker.min.mjs", { cache: "force-cache" }).catch(() => {});
    }
  }, []);

  const processFiles = async (newFiles: FileList | File[]) => {
    const currentFiles = Array.from(newFiles);
    const initialStates: FileState[] = currentFiles.map((f) => ({
      id: Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join(""),
      name: f.name,
      status: "Parsing",
      progress: 0,
      tokenCount: 0,
    }));

    setFiles((prev) => [...prev, ...initialStates]);

    for (let i = 0; i < currentFiles.length; i++) {
      const file = currentFiles[i];
      const { id } = initialStates[i];
      try {
        updateFile(id, { status: "Extracting", progress: 50 });

        const buffer = await file.arrayBuffer();
        const extracted = await extractPdfEvidence(buffer, file.name);

        updateFile(id, { status: "Indexed", progress: 85, tokenCount: 100, extracted });
        setExpandedFile(id);
      } catch (err) {
        updateFile(id, { status: "Error", progress: 0, error: String(err) });
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const statusClasses = {
    Parsing: "bg-elevated text-text-secondary border border-hairline",
    Extracting: "bg-primary/15 text-primary border border-primary/30",
    Indexed: "bg-primary/15 text-primary border border-primary/30",
    Saving: "bg-primary/15 text-primary border border-primary/30",
    Saved: "bg-status-success/15 text-status-success border border-status-success/30",
    Error: "bg-status-danger/15 text-status-danger border border-status-danger/30",
  };

  return (
    <div className="w-full" data-testid="bulk-pdf-dropzone">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`group rounded-xl border-2 border-dashed glass-bar p-8 text-center cursor-pointer transition-all ${
          isDragOver
            ? "border-primary bg-primary/[0.08] shadow-[var(--shadow-2)]"
            : "border-primary/40 hover:border-primary/75"
        }`}
      >
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-inset/80 text-primary group-hover:scale-105 transition-transform">
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Drag and drop resume PDFs here, or click to select files
        </p>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          Client-side PDF parsing · Extracts roles, projects &amp; impact bullets into your Evidence Bank
        </p>
        <input
          type="file"
          multiple
          accept=".pdf"
          ref={inputRef}
          onChange={handleChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-3">
          {files.map((file, i) => {
            const isExpanded = expandedFile === file.id;
            const sectionEntries = file.extracted
              ? (Object.entries(file.extracted.sections) as [string, string[]][]).filter(
                  ([, bullets]) => Array.isArray(bullets) && bullets.length > 0
                )
              : [];
            const totalBullets = sectionEntries.reduce((acc, [, bullets]) => acc + bullets.length, 0);
            const selectedBulletsCount = sectionEntries.reduce(
              (acc, [secName, bullets]) =>
                acc +
                bullets.filter(
                  (_, bIdx) => !unselectedBullets[`${file.id}:${secName}:${bIdx}`]
                ).length,
              0
            );

            return (
              <div
                key={file.id}
                className="rounded-xl surface-raised p-4 text-foreground"
              >
                <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-mono text-xs font-semibold text-foreground truncate">
                      {file.name}
                    </span>
                    {file.extracted && (
                      <button
                        type="button"
                        onClick={() => setExpandedFile(isExpanded ? null : file.id)}
                        data-testid={`toggle-pdf-preview-${i}`}
                        className="ml-1 inline-flex items-center gap-1 rounded bg-elevated px-2 py-0.5 text-xs font-mono text-text-secondary hover:text-foreground transition"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Preview ({totalBullets} bullets)
                      </button>
                    )}
                  </div>
                  <span
                    role="status"
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-full ${statusClasses[file.status]}`}
                  >
                    {file.status === "Saved" ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Indexed · Added to Bank</span>
                        {file.savedCount ? (
                          <span className="font-mono">({file.savedCount} items)</span>
                        ) : null}
                      </span>
                    ) : (
                      file.status
                    )}
                  </span>
                </div>
                <div className="w-full bg-inset rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
                {file.error && <p role="alert" className="text-status-danger text-xs mt-2">{file.error}</p>}

                {isExpanded && file.extracted && (
                  <div
                    data-testid="pdf-extracted-preview"
                    className="mt-3 pt-3 border-t border-hairline space-y-2 max-h-64 overflow-y-auto"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        Extracted Sections ({sectionEntries.length})
                      </div>
                      <button
                        type="button"
                        disabled={selectedBulletsCount === 0 || file.status === "Saved" || file.status === "Saving"}
                        data-testid={`pdf-commit-selected-btn-${i}`}
                        onClick={() => void handleCommitSelected(file)}
                        className="rounded border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-mono font-semibold text-primary hover:bg-primary/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {file.status === "Saved" ? "Saved to Evidence Bank"
                          : file.status === "Saving" ? "Saving…"
                          : file.retryItems ? "Retry save"
                          : "Save Selected to Evidence Bank"}
                      </button>
                    </div>
                    {sectionEntries.map(([secName, bullets], sIdx) => (
                      <div
                        key={sIdx}
                        className="rounded-lg border border-hairline bg-inset p-2.5 space-y-1.5"
                      >
                        <div className="text-xs font-bold text-primary font-mono uppercase">
                          {secName}
                        </div>
                        <ul className="space-y-1 text-xs text-text-secondary">
                          {bullets.map((b: string, bIdx: number) => {
                            const bulletKey = `${file.id}:${secName}:${bIdx}`;
                            const isChecked = !unselectedBullets[bulletKey];
                            return (
                              <li key={bIdx} className="leading-relaxed">
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={file.status === "Saved" || file.status === "Saving" || Boolean(file.retryItems)}
                                    onChange={() => toggleBulletSelection(bulletKey)}
                                    data-testid={`pdf-bullet-checkbox-${sIdx}-${bIdx}`}
                                    className="mt-0.5 rounded border-hairline bg-panel text-primary focus:ring-primary"
                                  />
                                  <span className={isChecked ? "text-foreground" : "text-muted-foreground line-through"}>
                                    {b}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

