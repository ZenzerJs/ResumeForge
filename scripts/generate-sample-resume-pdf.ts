import fs from "fs";
import path from "path";

/**
 * Deterministically builds a valid PDF-1.4 byte buffer with exact xref byte offsets
 * containing synthetic resume text for automated PDF extraction tests.
 */
export function buildSampleResumePdf(lines: string[] = [
  "Alex Rivera",
  "Education: State University",
  "Experience: Northwind Health Systems",
]): string {
  const escapePdfText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const streamLines: string[] = ["BT", "/F1 12 Tf", "72 712 Td"];
  lines.forEach((line, idx) => {
    if (idx > 0) {
      streamLines.push("0 -14 Td");
    }
    streamLines.push(`(${escapePdfText(line)}) Tj`);
  });
  streamLines.push("ET");

  const streamContent = `${streamLines.join("\n")}\n`;
  const streamByteLength = Buffer.byteLength(streamContent, "utf8");

  const objects = [
    `1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj`,
    `2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj`,
    `3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj`,
    `4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj`,
    `5 0 obj <</Length ${streamByteLength}>> stream\n${streamContent}endstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer <</Size ${objects.length + 1} /Root 1 0 R>>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

if (require.main === module) {
  const outPath = path.join(process.cwd(), "e2e", "fixtures", "sample-resume.pdf");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buildSampleResumePdf(), "utf8");
}
