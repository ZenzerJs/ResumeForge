"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiMarkdownRendererProps {
  content: string;
  className?: string;
}

function CodeBlock({
  language,
  value,
}: {
  language?: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-lg border border-slate-800 bg-slate-950/90 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
        <span>{language || "text"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-slate-200 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-slate-200">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export const AiMarkdownRenderer = React.memo(function AiMarkdownRenderer({
  content,
  className,
}: AiMarkdownRendererProps) {
  return (
    <div
      className={cn(
        "prose prose-invert prose-xs max-w-none text-slate-200 leading-relaxed space-y-2 text-xs",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !match && !codeString.includes("\n");

            if (isInline) {
              return (
                <code
                  className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[11.5px] font-mono text-amber-300 border border-slate-700/50"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match ? match[1] : undefined} value={codeString} />;
          },
          ul({ children }) {
            return <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 space-y-1 my-1">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-1 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-sm font-bold text-white mt-2 mb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xs font-bold text-amber-300 mt-2 mb-1 uppercase tracking-wide">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs font-semibold text-slate-100 mt-1 mb-0.5">{children}</h3>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-amber-500/60 pl-2.5 py-0.5 my-1 text-slate-300 italic bg-amber-950/10 rounded-r">
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
