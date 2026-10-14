"use client";

import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import { extractPdfEvidence, ExtractedPdfEvidence } from "../../lib/evidence/pdfExtractor";

interface FileState {
  name: string;
  status: "Parsing" | "Extracting" | "Indexed" | "Saved" | "Error";
  progress: number;
  tokenCount: number;
  savedCount?: number;
  error?: string;
}

interface Props {
  onComplete?: (items: ExtractedPdfEvidence[]) => Promise<number | void> | void;
}

export function BulkPdfDropzone({ onComplete }: Props) {
  const [files, setFiles] = useState<FileState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      fetch("/workers/pdf.worker.min.mjs", { cache: "force-cache" }).catch(() => {});
    }
  }, []);

  const processFiles = async (newFiles: FileList | File[]) => {
    const currentFiles = Array.from(newFiles);
    const initialStates: FileState[] = currentFiles.map(f => ({
      name: f.name,
      status: "Parsing",
      progress: 0,
      tokenCount: 0,
    }));
    
    setFiles(prev => [...prev, ...initialStates]);
    const extractedItems: ExtractedPdfEvidence[] = [];

    for (let i = 0; i < currentFiles.length; i++) {
      const file = currentFiles[i];
      try {
        setFiles(prev => {
          const next = [...prev];
          const idx = next.findIndex(f => f.name === file.name);
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: "Extracting", progress: 50 };
          }
          return next;
        });

        const buffer = await file.arrayBuffer();
        const extracted = await extractPdfEvidence(buffer, file.name);
        extractedItems.push(extracted);

        setFiles(prev => {
          const next = [...prev];
          const idx = next.findIndex(f => f.name === file.name);
          if (idx !== -1) {
            next[idx] = { ...next[idx], status: "Indexed", progress: 85, tokenCount: 100 };
          }
          return next;
        });
      } catch (err) {
        setFiles(prev => {
          const next = [...prev];
          const idx = next.findIndex(f => f.name === file.name);
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
        setFiles(prev =>
          prev.map(f =>
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
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
    Parsing: "bg-muted text-muted-foreground",
    Extracting: "bg-primary/10 text-primary",
    Indexed: "bg-amber-500/10 text-amber-500 border border-amber-500/20",
    Saved: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    Error: "bg-destructive/10 text-destructive"
  };

  return (
    <div className="w-full">
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <p>Drag and drop PDFs here, or click to select files</p>
        <input 
          type="file" 
          multiple 
          accept=".pdf"
          ref={inputRef} 
          onChange={handleChange} 
          className="hidden" 
        />
      </div>

      <div className="mt-4 space-y-2">
        {files.map((file, i) => (
          <div key={i} className="border p-4 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{file.name}</span>
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${statusClasses[file.status]}`}>
                {file.status === "Saved" ? (
                  <span className="flex items-center gap-1">
                    <span>✓ Added to Bank</span>
                    {file.savedCount ? <span className="font-mono">({file.savedCount} items)</span> : null}
                  </span>
                ) : (
                  file.status
                )}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${file.progress}%` }} 
              />
            </div>
            {file.error && <p className="text-destructive text-sm mt-1">{file.error}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
