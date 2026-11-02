# Print-ready reports: reference

## Contents
- [Anatomy of the printed page](#anatomy-of-the-printed-page)
- [Table density spec](#table-density-spec)
- [Column model](#column-model)
- [Column picker](#column-picker)
- [Excel export](#excel-export)
- [Data rules](#data-rules)
- [Print gotchas](#print-gotchas)

## Anatomy of the printed page

From top to bottom:

1. **Letterhead.**
   - Left side: the logo (about 42 pt tall), then the organisation name (16.8 pt bold), an optional subtitle such as a branch or campus, then the address lines, phone and email (9.8 pt each, muted).
   - Right side, aligned to the bottom: "Report Title:" in bold, with the title under it (10.5 pt).
   - A 3 pt double rule underneath.
2. **Filter line.** Right-aligned, 7.3 pt, muted. It echoes every active filter, including the ones left at "All": `Date Range: 01-Jan-2026 → 30-Nov-2026 · Class: All · Fee Categories: All`. A printed report with no filter line can't be trusted later, because nobody can tell what it covered.
3. **Stat strip (optional).** Three to five compact cards, such as Total, Late and Not due yet. Keep it to one line.
4. **Table.**
   - The header row repeats on every page.
   - A group header row comes before each group, for example "I - A".
   - The serial number restarts in each group.
   - A Subtotal row follows each group.
   - A Grand Total row comes last.
5. **"Printed: 02-Nov-2026, 9:24 PM"** at the end, right-aligned and 7 pt. Format it with the app's clock and timezone.

## Table density spec

| Columns | Body | Header | Cell padding (v × h) |
|---|---|---|---|
| > 12 | 6.6 pt | 7.3 pt | 2.2 × 4.5 pt |
| 9–12 | 7.5 pt | 8 pt | 2.6 × 5 pt |
| ≤ 8 | 8.5 pt | 9 pt | 3 × 6 pt |

- **Fonts and borders:** one sans-serif font, `font-variant-numeric: tabular-nums`, `line-height: 1.25`. Borders are 0.5 pt `#e5e7eb`, with zebra rows `#f9fafb`.
- **Alignment:** money and numbers align right, serial numbers in the centre, text to the left. Zero shows as "—".
- **Text:** cells never wrap (`white-space: nowrap`). Text cells get a max width (about 34 mm) with an ellipsis, so one long name can't push the table off the page.
- **Row tints:** group, subtotal and grand-total rows are bold, tinted `#eef0f4`, `#f3f4f6` and `#e5e7eb`.
- **Orientation:** landscape when there are more than 8 columns, otherwise portrait. The user can override this in the picker.
- **Font size floor:** don't go below 6.5 pt. If the table still doesn't fit, drop columns by default rather than shrinking the font.

## Column model

```ts
type ColumnType = 'serial' | 'text' | 'money' | 'number' | 'date';
interface ReportColumn<Row> {
  key: string;                 // stable id: used for the saved picker selection
  header: string;
  type: ColumnType;
  group?: string;              // picker section, e.g. 'Student' | 'Months' | 'Totals'
  required?: boolean;          // locked pill, can't be deselected (e.g. Name)
  align?: 'left' | 'right' | 'center';  // default comes from type
  total?: boolean;             // default: true for money/number
  dashZero?: boolean;          // default: true
  value?: (row: Row) => unknown;        // default: row[key]
}
```

Give each page the full list of useful fields, including ones the screen hides: IDs and reference numbers, parent or guardian, contact, class/section/department, status, due date, amount, paid and balance. The picker lets people trim.

## Column picker

One shared modal, opened by both Print and Export.

- **Pills.** Each column is a toggle pill (chip): a real `<button aria-pressed>` with a check icon when it's on. **All are selected by default.**
- **Toolbar:** "Select all", "Clear", and a live counter such as "15 of 17 columns".
- **Groups.** When columns have a `group`, show one small labelled section per group, each with its own all-or-none toggle. All twelve month columns are then one tap.
- **Required columns** show as locked pills (a lock icon, `aria-disabled`, with a tooltip saying why).
- **Print-only options:**
  - Orientation: Auto / Portrait / Landscape. Show what Auto resolves to, for example "Auto (Landscape: 17 columns)".
  - "Hide empty columns", on by default.
- **Confirm button:** "Print" or "Export to Excel". Disable it when no column is selected.
- **Memory.** Save the selection per report under a key like `report-cols:<reportId>`, storing the column keys in `localStorage` inside try/catch. If the saved selection contains unknown keys, ignore them. Columns added since the last save are selected. "Reset to all" restores the default.
- **Mobile.** On phones the modal is full width and the pills wrap. Keyboard: Tab moves through the pills, Space toggles one, and focus stays inside the modal (focus trap) and returns to the button that opened it.
- **Reuse.** Use the app's Modal and Button components. Don't introduce a new UI library for this.
- **Many columns.** With more than about 30 columns, pills get noisy. In that case, a two-list "Available / Selected" picker with drag-to-reorder may be better. Build pills first, propose the alternative, and don't switch silently.

## Excel export

- Use the selected columns, in the same order as print.
- The first rows hold the organisation name, the title, the filter line and a "Generated" timestamp. Then the header row, which is frozen.
- Money and number cells are written as **numbers** with a number format, never as preformatted strings. Otherwise Excel can't sum them.
- Group subtotals and the grand total are included as rows, styled bold.
- Name the file `<org>-<report>-<YYYY-MM-DD>.xlsx`, using the app's clock for the date.
- Use whatever XLSX library the app already has (SheetJS, exceljs and so on). Don't add a second one.

## Data rules

These come from a real dues report. Most apply to any money or list report.

- **Reconcile.** Each row's period cells add up to its Total. The subtotals add up to the grand total. The report's grand total equals the same figure shown elsewhere in the app. Write a test for this.
- **Late vs not yet due.** A bill printed on 30 Oct that's due on 10 Nov isn't late. Split the totals into "Late" and "Not yet due" using the due date against the app's "today". A report that lumps them together exaggerates the problem: in the reference report, 62% of the "outstanding" total wasn't due yet.
- **Opening or carried-in balances** get their own column. Don't dump them into the first month. In the reference report, old balances loaded in September made September look like the worst month.
- **Count carried amounts once.** An old unpaid amount that a newer bill carries forward must not be added twice.
- **Partial payments** show only the remaining amount.
- **Related parties.** If several rows belong to one payer, for example siblings sharing a parent, show a hint such as "Family owes Rs 83,800 · 4 children". Otherwise the biggest debt hides as four separate rows on four different pages.
- **Contact quality.** Flag missing or invalid phone numbers, and show a single banner count, for example "19 rows have no phone, 4 invalid". A report people use for follow-up calls is useless without numbers.
- **Server-side aggregation and full fetch.** Aggregate in SQL or on the server. Print and Export fetch every filtered row, never just the current page.

## Print gotchas

- **Background colours** disappear unless you set `-webkit-print-color-adjust: exact; print-color-adjust: exact;`.
- **Repeating header:** `thead { display: table-header-group }` repeats it on every page in Chrome and Edge. Use `tr { break-inside: avoid }` to stop rows splitting across pages.
- **Browser headers and footers** (URL, page x/y) are controlled by the user's print dialog. Don't rely on them. Put "Printed:" in the document itself.
- **Popups.** `window.open` returns `null` when popups are blocked. Detect that and tell the user.
- **Images:** wait for `load` or `error` on every `<img>` before calling `print()`, with a timeout of about 4 s. Remove a broken logo instead of showing a broken-image icon.
- **Never interpolate raw strings into HTML.** Escape every value.
- **Headless proof:**
  ```
  chrome --headless=new --no-pdf-header-footer --print-to-pdf=out.pdf file:///.../report.html
  ```
  Then run `node scripts/measure-pdf.mjs out.pdf`.
