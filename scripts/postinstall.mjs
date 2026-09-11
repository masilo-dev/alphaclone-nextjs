import fs from "node:fs";
import path from "node:path";

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else if (entry.isFile()) {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyPdfJsAssets() {
  const repoRoot = path.resolve(process.cwd());
  const pdfjsRoot = path.join(repoRoot, "node_modules", "pdfjs-dist");
  const workerSrc = path.join(pdfjsRoot, "build", "pdf.worker.min.mjs");
  const cmapsSrc = path.join(pdfjsRoot, "cmaps");

  const outRoot = path.join(repoRoot, "public", "pdfjs");
  const outWorker = path.join(outRoot, "pdf.worker.min.mjs");
  const outCmaps = path.join(outRoot, "cmaps");

  if (!fs.existsSync(workerSrc)) {
    throw new Error(`Missing PDF.js worker: ${workerSrc}`);
  }
  fs.mkdirSync(outRoot, { recursive: true });
  fs.copyFileSync(workerSrc, outWorker);

  if (fs.existsSync(cmapsSrc)) {
    copyDir(cmapsSrc, outCmaps);
  }
}

try {
  copyPdfJsAssets();
  process.stdout.write("[postinstall] pdfjs assets copied to public/pdfjs\n");
} catch (err) {
  process.stderr.write(
    `[postinstall] failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exitCode = 1;
}
