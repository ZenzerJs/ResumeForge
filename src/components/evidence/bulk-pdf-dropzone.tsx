"use client";

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { Upload, FileText, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { extractPdfEvidence, ExtractedPdfEvidence } from "../../lib/evidence/pdfExtractor";

interface FileState {
  name: string;
  status: "Parsing" | "Extracting" | "Indexed" | "Saved" | "Error";
  progress: number;
  tokenCount: number;
  savedCount?: number;
  extracted?: ExtractedPdfEvidence;
  error?: string;
}

interface Props {
  onComplete?: (items: ExtractedPdfEvidence[]) => Promise<number | void> | void;
}

export function BulkPdfDropzone({ onComplete }: Props) {
  const [files, setFiles] = useState<FileState[]>([]);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [unselectedBullets, setUnselectedBullets] = useState<Record<string, boolean>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleBulletSelection = (bulletKey: string) => {
    setUnselectedBullets((prev) => ({
      ...prev,
      [bulletKey]: !prev[bulletKey],
    }));
  };

  const handleCommitSelected = async (file: FileState) => {
    if (!onComplete || !file.extracted) return;
    const filteredSections = { ...file.extracted.sections };
    (Object.keys(filteredSections) as Array<keyof typeof filteredSections>).forEach((secKey) => {
      const list = filteredSections[secKey];
      if (Array.isArray(list)) {
        filteredSections[secKey] = list.filter(
          (_, bIdx) => !unselectedBullets[`${file.name}:${String(secKey)}:${bIdx}`]
        );
      }
    });
    const filteredItem: ExtractedPdfEvidence = {
      ...file.extracted,
      sections: filteredSections,
    };
    const savedCount = await onComplete([filteredItem]);
    setFiles((prev) =>
      prev.map((f) =>
        f.name === file.name
          ? {
              ...f,
              status: "Saved",
              progress: 100,
              savedCount: typeof savedCount === "number" ? savedCount : f.savedCount,
            }
          : f
      )
    );
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetch("/workers/pdf.worker.min.mjs", { cache: "force-cache" }).catch(() => {});
    }
  }, []);

  const processFiles = async (newFiles: FileList | File[]) => {
    const currentFiles = Array.from(newFiles);
    const initialStates: FileState[] = currentFiles.map((f) => ({
      name: f.name,
      status: "Parsing",
      progress: 0,
      tokenCount: 0,
    }));

    setFiles((prev) => [...prev, ...initialStates]);
    const extractedItems: ExtractedPdfEvidence[] = [];

    for (let i = 0; i < currentFiles.length; i++) {
      const file = currentFiles[i];
      try {
        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.name === file.name);
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: "Extracting", progress: 50 };
          }
          return next;
        });

        const buffer = await file.arrayBuffer();
        const extracted = await extractPdfEvidence(buffer, file.name);
        extractedItems.push(extracted);

        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.name === file.name);
          if (idx !== -1) {
            next[idx] = {
              ...next[idx],
              status: "Indexed",
              progress: 85,
              tokenCount: 100,
              extracted,
            };
          }
          return next;
        });
        setExpandedFile(file.name);
      } catch (err) {
        setFiles((prev) => {
          const next = [...prev];
          const idx = next.findIndex((f) => f.name === file.name);
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: "Error", progress: 0, error: String(err) };
          }
          return next;
        });
      }
    }

    if (onComplete && extractedItems.length > 0) {
      try {
        const savedCount = await onComplete(extractedItems);
        setFiles((prev) =>
          prev.map((f) =>
            f.status === "Indexed"
              ? {
                  ...f,
                  status: "Saved",
                  progress: 100,
                  savedCount: typeof savedCount === "number" ? savedCount : undefined,
                }
              : f
          )
        );
      } catch (err) {
        console.error("Failed to complete evidence indexing:", err);
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
            const isExpanded = expandedFile === file.name;
            const sectionEntries = file.extracted
              ? (Object.entries(file.extracted.sections) as [string, string[]][]).filter(
                  ([, bullets]) => Array.isArray(bullets) && bullets.length > 0
                )
              : [];
            const totalBullets = sectionEntries.reduce((acc, [, bullets]) => acc + bullets.length, 0);

            return (
              <div
                key={i}
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
                        onClick={() => setExpandedFile(isExpanded ? null : file.name)}
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
                {file.error && <p className="text-status-danger text-xs mt-2 font-mono">{file.error}</p>}

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
                        data-testid={`pdf-commit-selected-btn-${i}`}
                        onClick={() => void handleCommitSelected(file)}
                        className="rounded border border-primary/40 bg-primary/15 px-2.5 py-1 text-xs font-mono font-semibold text-primary hover:bg-primary/25 transition"
                      >
                        Save Selected to Evidence Bank
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
                          {bullets.slice(0, 6).map((b: string, bIdx: number) => {
                            const bulletKey = `${file.name}:${secName}:${bIdx}`;
                            const isChecked = !unselectedBullets[bulletKey];
                            return (
                              <li key={bIdx} className="leading-relaxed">
                                <label className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
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

