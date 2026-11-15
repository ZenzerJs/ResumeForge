import fs from "fs";
import path from "path";

const workerCandidates = [
  path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
  path.resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
];
const destDir = path.resolve("public/workers");
const destPath = path.join(destDir, "pdf.worker.min.mjs");

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const sourcePath = workerCandidates.find((candidate) => fs.existsSync(candidate));
if (sourcePath) {
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied PDF worker from ${sourcePath} to ${destPath}`);
} else {
  console.error(`PDF worker not found in ${workerCandidates.join(" or ")}`);
}
