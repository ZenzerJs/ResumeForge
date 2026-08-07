import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import crypto from "crypto";

export interface ParsedJobRow {
  externalId: string;
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string;
  datePosted: string;
  isClosed: boolean;
}

interface AstNode {
  type: string;
  value?: string;
  url?: string;
  children?: AstNode[];
}

export function parsePittCSCMarkdown(markdownContent: string): ParsedJobRow[] {
  const tree = remark().use(remarkGfm).parse(markdownContent);
  const jobs: ParsedJobRow[] = [];

  visit(tree, "tableRow", (node: unknown) => {
    const tableRow = node as AstNode;
    const cells = tableRow.children;
    if (!cells || cells.length < 4) return;

    const rawCompany = extractTextAndState(cells[0]);
    const rawRole = extractTextAndState(cells[1]);
    const location = extractTextAndState(cells[2]).text;
    const applyUrl = extractHref(cells[3]);
    const datePosted = extractTextAndState(cells[4] || {}).text;

    // Skip table header
    if (rawCompany.text.toLowerCase().includes("company")) return;

    const isClosed =
      rawCompany.isStrikethrough ||
      rawRole.isStrikethrough ||
      applyUrl === "" ||
      applyUrl.includes("🔒");

    const company = cleanText(rawCompany.text);
    const roleTitle = cleanText(rawRole.text);

    if (!company || !roleTitle) return;

    // Generate stable hash ID to prevent duplicate inserts on re-runs
    const externalId = crypto
      .createHash("md5")
      .update(`${company}-${roleTitle}-${applyUrl}`)
      .digest("hex");

    jobs.push({
      externalId,
      company,
      roleTitle,
      location,
      applyUrl,
      datePosted,
      isClosed,
    });
  });

  return jobs;
}

function extractTextAndState(cellNode: unknown): { text: string; isStrikethrough: boolean } {
  let text = "";
  let isStrikethrough = false;

  visit(cellNode as AstNode, (node: unknown) => {
    const astNode = node as AstNode;
    if (astNode.type === "delete") isStrikethrough = true;
    if (astNode.type === "text" && astNode.value) text += astNode.value + " ";
  });

  return { text: text.trim(), isStrikethrough };
}

function extractHref(cellNode: unknown): string {
  let href = "";
  visit(cellNode as AstNode, (node: unknown) => {
    const astNode = node as AstNode;
    if (astNode.type === "link" && astNode.url) href = astNode.url;
  });
  return href;
}

function cleanText(input: string): string {
  return input
    .replace(/[🔒🇺🇸🇨🇦]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
