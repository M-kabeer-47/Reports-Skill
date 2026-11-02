---
name: print-ready-reports
description: Builds print-ready, data-dense tabular reports for web apps: a branded letterhead, compact A4 tables that fit 15–20 columns legibly, group headers with subtotals and a grand total, and a column-picker modal (toggle pills, all selected by default) before Print and Export to Excel. Use when adding or upgrading a reports feature, report printing, PDF/print output, Excel/CSV export, an "outstanding/dues/defaulters/ledger/attendance/marks" style list report, or when printed tables overflow, look cramped, or lack a header.
---

# Print-ready reports

The target is a report someone hands to a principal, a manager or an auditor. It has a letterhead on top, one dense table that fits every column on an A4 page, totals that add up, and it is identical every time.

## Quick start

1. Copy [scripts/report-print.mjs](scripts/report-print.mjs) into the app's shared export utilities. Rename it to `.ts` and add types if the app uses TypeScript.
2. Describe the report as data, not markup:

```js
import { renderReportHtml, openPrintWindow } from './report-print';
const { html } = renderReportHtml({
  branding: { name: school.name, subtitle: '(campus 3)', addressLines: [school.address], phone: school.phone, email: school.email, logoUrl: school.logoUrl },
  title: 'Outstanding fees report',
  filtersLine: 'Date Range: 01-Jan-2026 → 30-Nov-2026 · Class: All',
  printedAt: `Printed: ${formatWithAppClock(now)}`,
  columns: [
    { key: 'sn', header: '#', type: 'serial' },
    { key: 'name', header: 'Name', type: 'text', required: true },
    { key: 'sep', header: 'Sep-26', type: 'money' },
    { key: 'total', header: 'Total', type: 'money' },
  ],
  rows, groupBy: 'className', hideEmptyColumns: true,
});
if (!openPrintWindow(html)) toast('Allow pop-ups to print');
```

3. Before Print or Export runs, show the column picker. See [REFERENCE.md § Column picker](REFERENCE.md#column-picker).

## Workflow

Copy this checklist and tick it off as you go:

```
- [ ] 1. Survey: find the app's existing print/export helpers, report pages, branding source, date/clock helper, Modal/Button components
- [ ] 2. One shared path: plan to change the shared helper/button once, not each page
- [ ] 3. Column model: list EVERY useful field (incl. ones not on screen), with type, required, group
- [ ] 4. Data: aggregate on the server; fetch ALL filtered rows, never just the current page
- [ ] 5. Correctness rules (REFERENCE.md § Data rules): totals reconcile, late vs not-yet-due, carried amounts once
- [ ] 6. Renderer: letterhead + dense table + groups/subtotals + grand total (scripts/report-print.mjs)
- [ ] 7. Column picker modal shared by Print and Export; XLSX honours the same selection and order
- [ ] 8. Verify: print to PDF, run scripts/measure-pdf.mjs, compare against the layout targets, reconcile totals
```

## Rules that matter most

- **Change it in one place.** Most apps have a single print helper and a single export button that every page uses. Upgrade those, and every report gets the letterhead and density together.
- **The default is everything.** The picker starts with every column selected. People trim columns; they shouldn't have to hunt for a missing one.
- **Numbers are typed, not guessed from strings.** Use `type: 'money' | 'number'` so values right-align, use tabular digits, total correctly and show "—" for zero.
- **Totals must reconcile.** Each row's month cells add up to its Total, and the subtotals add up to the grand total. Test this.
- **Use the app's clock** for "Printed:" and for "today" in due-date logic, never the browser's.
- **Escape every value.** Names like `O'Brien <x>` must not break the page. The renderer escapes them, so keep it that way.
- **Wait for the logo to load** before calling `print()`, or the first page prints without it. `openPrintWindow` handles this.

## Layout targets

These were measured from a real 17-column A4 landscape report, and the renderer reproduces them exactly:

| Element | Target |
|---|---|
| Page | A4, landscape when > 8 columns, 10 mm margins |
| School name / address lines | 16.8 pt bold / 9.8 pt |
| Filter line, table header | 7.3 pt (header: white bold on navy `#1f2547`) |
| Table body | 6.6 pt, row pitch ≈ 13.5 pt, ~29 rows on the first page |

The full spec, print gotchas and the data rules are in [REFERENCE.md](REFERENCE.md). A React column-picker sketch and a full config are in [EXAMPLES.md](EXAMPLES.md).

## Verify

```bash
# print the page to PDF (browser "Save as PDF", or headless Chrome), then:
node scripts/measure-pdf.mjs out.pdf 1        # page size, font sizes, row pitch
```

Compare the output with the targets above, and with any reference PDF the user supplies (run the same script on it). Finish with a screenshot of the printed page and of the picker modal.
