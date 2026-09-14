import fs from "fs";
import path from "path";

const sourcePath = path.resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = path.resolve("public/workers");
const destPath = path.join(destDir, "pdf.worker.min.mjs");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(sourcePath)) {
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied PDF worker to ${destPath}`);
} else {
  console.error(`PDF worker not found at ${sourcePath}`);
}
