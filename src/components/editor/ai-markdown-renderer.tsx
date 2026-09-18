"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Check, Copy, Sparkles, AlertCircle, Info, ShieldCheck } from "lucide-react";
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
    <div className="relative my-3 rounded-xl border border-slate-800/80 bg-slate-950/95 overflow-hidden text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <span className="text-amber-400/90 font-medium">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Copy code snippet"
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
      <pre className="p-3.5 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-slate-200">
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
          // Code & inline code
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

          // Callout cards instead of plain blockquotes
          blockquote({ children }) {
            return (
              <div className="my-3 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-950/15 p-3 text-slate-200">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                <div className="text-xs leading-normal [&>p]:m-0 text-slate-200 italic font-sans">
                  {children}
                </div>
              </div>
            );
          },

          // Polished micro-tables
          table({ children }) {
            return (
              <div className="my-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60 shadow-xs">
                <table className="w-full text-left text-xs border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="border-b border-slate-800 bg-slate-900/80 font-medium text-slate-300">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 text-[10.5px] font-semibold tracking-wider uppercase text-amber-300/90 border-r border-slate-800/60 last:border-r-0">
                {children}
              </th>
            );
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-slate-800/60">{children}</tbody>;
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 text-slate-300 border-r border-slate-800/40 last:border-r-0 text-[11.5px]">
                {children}
              </td>
            );
          },

          // Lists & Typography
          ul({ children }) {
            return <ul className="list-disc pl-4 space-y-1 my-1 text-slate-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-4 space-y-1 my-1 text-slate-300">{children}</ol>;
          },
          p({ children }) {
            return <p className="my-1.5 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-sm font-bold text-white mt-2.5 mb-1">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xs font-bold text-amber-300 mt-2 mb-1 uppercase tracking-wide">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-xs font-semibold text-slate-100 mt-1.5 mb-0.5">{children}</h3>;
          },
          hr() {
            return <hr className="my-3 border-slate-800" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
