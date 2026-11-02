// Measure a printed report PDF: page size, font sizes in use, table row pitch.
// Use it to compare your print against a reference PDF, number for number.
//
//   node measure-pdf.mjs <file.pdf> [pageNumber=1]
//
// Needs pdfjs-dist. Resolved from the current directory's node_modules, or set
// PDFJS_PATH to .../pdfjs-dist/legacy/build/pdf.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [file, pageArg = '1'] = process.argv.slice(2);
if (!file) { console.error('usage: node measure-pdf.mjs <file.pdf> [page]'); process.exit(1); }
const pdfjsPath = process.env.PDFJS_PATH || path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs');
if (!fs.existsSync(pdfjsPath)) { console.error(`pdfjs-dist not found at ${pdfjsPath}. npm i -D pdfjs-dist, or set PDFJS_PATH.`); process.exit(1); }
const pdfjs = await import(pathToFileURL(pdfjsPath).href);

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
const page = await doc.getPage(Number(pageArg));
const vp = page.getViewport({ scale: 1 });
const w = Math.round(vp.width), h = Math.round(vp.height);
const named = { '842x595': 'A4 landscape', '595x842': 'A4 portrait', '792x612': 'Letter landscape', '612x792': 'Letter portrait' }[`${w}x${h}`] || 'custom';
console.log(`pages: ${doc.numPages} · page ${pageArg}: ${w} x ${h} pt (${named})`);

const tc = await page.getTextContent();
const bySize = new Map();
for (const it of tc.items) {
  const s = it.str.trim();
  if (!s) continue;
  const size = Math.hypot(it.transform[2], it.transform[3]).toFixed(1);
  if (!bySize.has(size)) bySize.set(size, { n: 0, ys: [], eg: [] });
  const e = bySize.get(size);
  e.n++; e.ys.push(it.transform[5]); if (e.eg.length < 4) e.eg.push(s);
}
const sizes = [...bySize.entries()].sort((a, b) => b[1].n - a[1].n);
console.log('font sizes (most used first):');
for (const [size, e] of sizes) console.log(`  ${size} pt × ${e.n}  e.g. ${e.eg.join(' | ')}`);

// Row pitch from the most-used size (= table body): median gap between distinct baselines.
const body = sizes[0][1];
const ys = [...new Set(body.ys.map((y) => Math.round(y * 2) / 2))].sort((a, b) => b - a);
const gaps = ys.slice(1).map((y, i) => ys[i] - y).filter((g) => g > 2 && g < 40).sort((a, b) => a - b);
if (gaps.length) console.log(`table body ≈ ${sizes[0][0]} pt, row pitch ≈ ${gaps[Math.floor(gaps.length / 2)].toFixed(1)} pt, rows on page ≈ ${ys.length}`);
