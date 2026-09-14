import fs from 'fs';
import path from 'path';

function buildPdf(lines: string[]): Buffer {
  const contentStream = 'BT /F1 12 Tf 50 750 Td ' + lines.map(line => `(${line.replace(/[()\\]/g, '\\$&')}) Tj 0 -18 Td`).join(' ') + ' ET';
  const streamBytes = Buffer.from(contentStream, 'latin1');
  
  let out = '%PDF-1.4\n';
  const offsets: number[] = [0];
  
  // Obj 1: Catalog
  offsets.push(Buffer.byteLength(out, 'latin1'));
  out += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  
  // Obj 2: Pages
  offsets.push(Buffer.byteLength(out, 'latin1'));
  out += '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  
  // Obj 3: Page
  offsets.push(Buffer.byteLength(out, 'latin1'));
  out += '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n';
  
  // Obj 4: Stream
  offsets.push(Buffer.byteLength(out, 'latin1'));
  out += `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  
  // Xref
  const startXref = Buffer.byteLength(out, 'latin1');
  out += 'xref\n0 5\n0000000000 65535 f \n';
  for (let i = 1; i <= 4; i++) {
    out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  
  // Trailer
  out += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const targetDir = path.resolve('tests/fixtures/pdf');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const singleColumnPdf = buildPdf([
  'EXPERIENCE',
  'Senior Software Engineer at Horizon Systems 2021 to Present',
  'Designed and implemented distributed backend microservices using Node.js TypeScript and PostgreSQL',
  'Optimized database queries reducing p99 latency by 35 percent across all customer-facing endpoints',
  'SKILLS',
  'TypeScript JavaScript Node.js React Python Go Docker Kubernetes PostgreSQL AWS',
  'EDUCATION',
  'Bachelor of Science in Computer Science University of Technology 2020'
]);

const twoColumnPdf = buildPdf([
  'EXPERIENCE',
  'Lead Systems Engineer at CloudTech Platforms 2022 to Present',
  'Architected event-driven architecture using Kafka and Redis supporting 100k requests per second',
  'Automated CI CD pipelines with GitHub Actions and Terraform lowering deployment cycles by 50 percent',
  'PROJECTS',
  'ResumeForge Open Source Typst ATS Engine with deterministic AST patching',
  'EDUCATION',
  'Master of Science in Software Engineering State University 2022'
]);

fs.writeFileSync(path.join(targetDir, 'single-column-standard.pdf'), singleColumnPdf);
fs.writeFileSync(path.join(targetDir, 'two-column-engineering.pdf'), twoColumnPdf);
console.log('Successfully generated fixtures with > 50 chars and valid sections.');
