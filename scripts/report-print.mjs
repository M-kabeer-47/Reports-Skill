// Print-ready report renderer. Zero dependencies, framework-agnostic.
// Copy into the app (rename to .ts and add types if the app uses TypeScript).
//
//   const { html } = renderReportHtml(config);   // pure: string in, string out
//   openPrintWindow(html);                        // browser only
//
// Config shape (all optional except title, columns, rows):
// {
//   branding:   { name, subtitle, addressLines: [], phone, email, logoUrl },
//   title:      'Outstanding fees report',
//   filtersLine:'Date Range: 01-Jan-2026 → 30-Nov-2026 · Class: All',
//   printedAt:  'Printed: 30-Oct-2026, 9:24 PM'   // format with the APP's clock, not the browser's
//   stats:      [{ label, value }],
//   columns:    [{ key, header, type, align, total, dashZero, maxWidth, required, value(row) }],
//                 type: 'serial' | 'text' | 'money' | 'number' | 'date'
//   rows:       [...],
//   groupBy:    'className' | (row) => string,   // group header row + per-group serial
//   subtotals:  true,                             // needs groupBy
//   grandTotal: true,
//   orientation:'auto' | 'portrait' | 'landscape',
//   hideEmptyColumns: true,                       // drop non-required columns empty/zero in every row
//   formatNumber: (n) => string,                  // default: en-US grouping, no decimals unless needed
// }

const NUMERIC = new Set(['money', 'number']);

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function defaultFormatNumber(n) {
  return Number.isInteger(n)
    ? n.toLocaleString('en-US')
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rawValue(col, row) {
  return typeof col.value === 'function' ? col.value(row) : row[col.key];
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function isEmpty(col, v) {
  if (v === null || v === undefined || String(v).trim() === '') return true;
  return NUMERIC.has(col.type) && toNumber(v) === 0;
}

function alignOf(col) {
  if (col.align) return col.align;
  if (col.type === 'serial') return 'center';
  return NUMERIC.has(col.type) ? 'right' : 'left';
}

// Font scale by column count: the more columns, the denser (measured from a
// 17-column A4 landscape reference: body 6.6pt, header 7.3pt, row ≈ 13.5pt).
function scaleFor(count) {
  if (count > 12) return { body: 6.6, head: 7.3, padY: 2.2, padX: 4.5 };
  if (count > 8) return { body: 7.5, head: 8, padY: 2.6, padX: 5 };
  return { body: 8.5, head: 9, padY: 3, padX: 6 };
}

export function renderReportHtml(config) {
  const {
    branding = {}, title = 'Report', filtersLine, printedAt, stats = [],
    rows = [], groupBy, subtotals = true, grandTotal = true,
    orientation = 'auto', hideEmptyColumns = true,
    formatNumber = defaultFormatNumber,
  } = config;

  const columns = (config.columns || []).filter(
    (c) => !hideEmptyColumns || c.required || c.type === 'serial' ||
      rows.some((r) => !isEmpty(c, rawValue(c, r))),
  );
  const totalCols = columns.filter((c) => c.total ?? NUMERIC.has(c.type));
  const landscape = orientation === 'landscape' || (orientation === 'auto' && columns.length > 8);
  const s = scaleFor(columns.length);

  const cell = (col, v) => {
    if (col.type === 'serial') return escapeHtml(v);
    if (NUMERIC.has(col.type)) {
      const n = toNumber(v);
      if (n === 0 && col.dashZero !== false) return '—';
      return escapeHtml(formatNumber(n));
    }
    return escapeHtml(v);
  };

  const sumRows = (list) => Object.fromEntries(totalCols.map((c) => [c.key, list.reduce((a, r) => a + toNumber(rawValue(c, r)), 0)]));

  // Label sits in the first non-numeric run of columns; amounts under their columns.
  const labelSpan = Math.max(1, columns.findIndex((c) => NUMERIC.has(c.type)));
  const totalsRow = (label, sums, cls) => {
    const tail = columns.slice(labelSpan).map((c) => {
      const has = totalCols.includes(c);
      return `<td class="${alignOf(c)}">${has ? cell(c, sums[c.key]) : ''}</td>`;
    }).join('');
    return `<tr class="${cls}"><td colspan="${labelSpan}">${escapeHtml(label)}</td>${tail}</tr>`;
  };

  const keyOf = typeof groupBy === 'function' ? groupBy : groupBy ? (r) => r[groupBy] : null;
  const groups = [];
  if (keyOf) {
    const map = new Map();
    for (const r of rows) {
      const k = String(keyOf(r) ?? '');
      if (!map.has(k)) { map.set(k, []); groups.push([k, map.get(k)]); }
      map.get(k).push(r);
    }
  } else groups.push([null, rows]);

  let body = '';
  for (const [label, list] of groups) {
    if (label !== null) body += `<tr class="group"><td colspan="${columns.length}">${escapeHtml(label)}</td></tr>`;
    list.forEach((r, i) => {
      body += '<tr>' + columns.map((c) => {
        const v = c.type === 'serial' ? i + 1 : rawValue(c, r);
        const max = c.maxWidth ? ` style="max-width:${c.maxWidth}"` : '';
        return `<td class="${alignOf(c)}${c.type === 'text' ? ' clip' : ''}"${max}>${cell(c, v)}</td>`;
      }).join('') + '</tr>';
    });
    if (label !== null && subtotals && totalCols.length) body += totalsRow('Subtotal', sumRows(list), 'subtotal');
  }
  if (grandTotal && totalCols.length) body += totalsRow('Grand Total', sumRows(rows), 'grand');

  const head = columns.map((c) => `<th class="${alignOf(c)}">${escapeHtml(c.header)}</th>`).join('');
  const b = branding;
  const contact = [
    ...(b.addressLines || []).map((l) => `<div>${escapeHtml(l)}</div>`),
    b.phone ? `<div>Phone: ${escapeHtml(b.phone)}</div>` : '',
    b.email ? `<div>${escapeHtml(b.email)}</div>` : '',
  ].join('');
  const statHtml = stats.length
    ? `<div class="stats">${stats.map((x) => `<div class="stat"><span>${escapeHtml(x.label)}</span><b>${escapeHtml(x.value)}</b></div>`).join('')}</div>`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
@media screen { body { margin: 16px; } }
.lh { display: flex; justify-content: space-between; align-items: flex-end; gap: 16pt; padding-bottom: 6pt; border-bottom: 3pt double #111827; }
.lh-left { display: flex; gap: 10pt; align-items: center; }
.lh img { height: 42pt; width: auto; }
.lh .name { font-size: 16.8pt; font-weight: 700; line-height: 1.15; }
.lh .sub, .lh .contact { font-size: 9.8pt; color: #374151; line-height: 1.35; }
.lh-right { text-align: right; font-size: 10.5pt; }
.lh-right b { display: block; }
.filters { text-align: right; font-size: 7.3pt; color: #6b7280; margin: 6pt 0 4pt; }
.stats { display: flex; gap: 6pt; margin: 4pt 0 6pt; }
.stat { flex: 1; border: 0.75pt solid #e5e7eb; border-radius: 4pt; padding: 3pt 6pt; font-size: 7pt; }
.stat span { display: block; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; }
.stat b { font-size: 9.5pt; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th { background: #1f2547; color: #fff; font-size: ${s.head}pt; font-weight: 700; padding: ${s.padY + 0.6}pt ${s.padX}pt; white-space: nowrap; }
td { font-size: ${s.body}pt; padding: ${s.padY}pt ${s.padX}pt; border: 0.5pt solid #e5e7eb; line-height: 1.25; white-space: nowrap; }
tbody tr:nth-child(even) td { background: #f9fafb; }
td.clip { max-width: 34mm; overflow: hidden; text-overflow: ellipsis; }
.left { text-align: left; } .right { text-align: right; } .center { text-align: center; }
tr.group td { background: #eef0f4 !important; font-weight: 700; }
tr.subtotal td { background: #f3f4f6 !important; font-weight: 700; }
tr.grand td { background: #e5e7eb !important; font-weight: 700; }
.printed { text-align: right; font-size: 7pt; color: #6b7280; margin-top: 6pt; }
</style></head><body>
<header class="lh"><div class="lh-left">${b.logoUrl ? `<img src="${escapeHtml(b.logoUrl)}" alt="" onerror="this.remove()">` : ''}<div>
<div class="name">${escapeHtml(b.name || '')}</div>${b.subtitle ? `<div class="sub">${escapeHtml(b.subtitle)}</div>` : ''}<div class="contact">${contact}</div>
</div></div><div class="lh-right"><b>Report Title:</b>${escapeHtml(title)}</div></header>
${filtersLine ? `<div class="filters">${escapeHtml(filtersLine)}</div>` : ''}${statHtml}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${printedAt ? `<div class="printed">${escapeHtml(printedAt)}</div>` : ''}
</body></html>`;

  return { html, orientation: landscape ? 'landscape' : 'portrait', columns: columns.map((c) => c.key) };
}

// Browser only. Waits for images (the logo) before printing so it never prints blank.
// Returns false when the popup was blocked, so the caller can show a message.
export function openPrintWindow(html, { imageTimeoutMs = 4000 } = {}) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  const imgs = Array.from(w.document.images);
  const loaded = imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = res; }));
  const timeout = new Promise((res) => setTimeout(res, imageTimeoutMs));
  Promise.race([Promise.all(loaded), timeout]).then(() => {
    w.onafterprint = () => w.close();
    w.focus();
    w.print();
  });
  return true;
}
