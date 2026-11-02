# print-ready-reports

An agent skill that teaches a coding agent to build **print-ready, data-dense table reports** in any web app. These are the kind of reports you hand to a principal, a manager or an auditor.

What the agent builds with it:

- **Letterhead:** logo, organisation name, address, phone and email on the left; the report title on the right; a double rule underneath.
- **Dense A4 tables** that fit 15–20 columns and stay readable. Money is right-aligned, zero shows as "—", the header repeats on every page and rows never split across pages.
- **Group rows with subtotals and a grand total**, for example by class, department or branch.
- **A column-picker modal** before Print and Export to Excel, using toggle pills. Every column is selected by default; columns can be grouped or locked, and the choice is remembered for each report.
- **Data rules** that keep money reports honest. Totals reconcile, "late" is kept apart from "not yet due", carried-forward balances get their own column, and missing phone numbers are flagged.

## Install

**Claude Code** (all projects):

```bash
git clone https://github.com/M-kabeer-47/Reports-Skill ~/.claude/skills/print-ready-reports
```

For a single project, clone it into `<project>/.claude/skills/print-ready-reports` instead. Other agents work too: copy the folder into that agent's skills directory.

The agent loads it when a task involves report printing, PDF/print output, Excel export or a list-style report. You can also ask for it by name.

## What's inside

| File | Purpose |
|---|---|
| `SKILL.md` | The workflow checklist, the key rules and the layout targets |
| `REFERENCE.md` | Page anatomy, density spec, column model, column-picker spec, Excel rules, data rules, print gotchas |
| `EXAMPLES.md` | A sample report config, a React column-picker sketch, and the tests worth writing |
| `scripts/report-print.mjs` | A zero-dependency renderer: `renderReportHtml(config)` → HTML, and `openPrintWindow(html)` |
| `scripts/measure-pdf.mjs` | Measures a printed PDF (page size, font sizes, row pitch) so you can compare it against a reference |

## Try the renderer

```js
import { renderReportHtml } from './scripts/report-print.mjs';
const { html } = renderReportHtml({
  branding: { name: 'Green Valley School', addressLines: ['12 Main Road'], phone: '+92 300 0000000' },
  title: 'Outstanding fees report',
  columns: [
    { key: 'sn', header: '#', type: 'serial' },
    { key: 'name', header: 'Name', type: 'text' },
    { key: 'due', header: 'Due', type: 'money' },
  ],
  rows: [{ cls: 'I - A', name: 'Sara', due: 1400 }, { cls: 'I - A', name: 'Ali', due: 0 }],
  groupBy: 'cls',
});
```

Open the HTML in a browser and press Print. Or print it from the command line:

```bash
chrome --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf file:///path/to/report.html
PDFJS_PATH=node_modules/pdfjs-dist/legacy/build/pdf.mjs node scripts/measure-pdf.mjs out.pdf
```

The layout targets were measured from a real 17-column A4 landscape report: 6.6 pt body text, 7.3 pt header, row pitch ≈ 13.5 pt. The renderer reproduces those numbers exactly when the output is measured with `measure-pdf.mjs`.
