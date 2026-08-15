import React from "react";
import { parseJobDescriptionMarkdown } from "@/lib/ingestion/jd-format";

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={index} className="font-semibold text-on-surface">
          {bold[1]}
        </strong>
      );
    }
    const italic = part.match(/^\*([^*]+)\*$/);
    if (italic) {
      return (
        <em key={index} className="italic">
          {italic[1]}
        </em>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function JobDescriptionMarkdown({ markdown }: { markdown: string }) {
  const blocks = parseJobDescriptionMarkdown(markdown);

  if (blocks.length === 0) {
    return <p className="text-sm text-on-surface-variant">No description available.</p>;
  }

  return (
    <div
      data-testid="job-description-markdown"
      className="max-w-none space-y-4 font-body-regular text-sm leading-relaxed text-on-surface/90"
    >
      {blocks.map((block, index) => {
        if (block.type === "title") {
          return (
            <p
              key={index}
              className="font-page-title-mobile text-2xl font-bold tracking-tight text-on-surface md:text-3xl"
            >
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "heading") {
          return (
            <p
              key={index}
              className={
                block.level === 2
                  ? "font-section-label border-b border-outline-variant/50 pb-2 text-xs uppercase tracking-widest text-on-surface-variant"
                  : "pt-1 text-sm font-semibold tracking-wide text-on-surface"
              }
            >
              {renderInline(block.text)}
            </p>
          );
        }
        if (block.type === "meta") {
          return (
            <dl key={index} className="grid gap-1 text-sm text-on-surface-variant">
              {block.items.map((item) => (
                <div key={item.label} className="flex flex-wrap gap-x-2">
                  <dt className="font-section-label text-[11px] uppercase tracking-wider text-on-surface-variant/80">
                    {item.label}
                  </dt>
                  <dd className="text-on-surface">{renderInline(item.value)}</dd>
                </div>
              ))}
            </dl>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-on-surface-variant">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
