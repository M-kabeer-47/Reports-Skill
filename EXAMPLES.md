# Print-ready reports: examples

## 1. A dues-by-month report config

```js
const months = ['Sep-26', 'Oct-26', 'Nov-26'];
const columns = [
  { key: 'sn', header: '#', type: 'serial', group: 'Student' },
  { key: 'gr', header: 'GR #', type: 'text', group: 'Student', required: true },
  { key: 'name', header: 'Name', type: 'text', group: 'Student', required: true },
  { key: 'father', header: 'Father Name', type: 'text', group: 'Student' },
  { key: 'contact', header: 'Contact', type: 'text', group: 'Student' },
  { key: 'opening', header: 'Opening bal.', type: 'money', group: 'Months' },
  ...months.map((m) => ({ key: m, header: m, type: 'money', group: 'Months' })),
  { key: 'total', header: 'Total', type: 'money', group: 'Totals', required: true },
];
// rows: one per student, already aggregated on the server, e.g.
// { className: 'I - A', gr: '26', name: 'SARA AHMED', father: 'AHMED RAZA',
//   contact: '3000000001', opening: 0, 'Sep-26': 700, 'Oct-26': 1200, 'Nov-26': 1400, total: 3300 }
const { html } = renderReportHtml({ branding, title: 'Outstanding fees report', filtersLine, printedAt,
  columns: columns.filter((c) => selected.has(c.key)), rows, groupBy: 'className', orientation });
```

What it renders: an "I - A" group row, then the students numbered 1, 2, 3 and so on, then "Subtotal … 6,500 10,100 34,700 51,300". The next class follows, and a "Grand Total" row closes the table.

## 2. Column picker (React sketch)

This sketch shows the pattern. Swap in the app's own `Modal` and `Button`, and its icon set.

```tsx
import { useMemo, useState } from 'react';

type Col = { key: string; header: string; group?: string; required?: boolean };
type Props = {
  open: boolean; mode: 'print' | 'export'; reportId: string; columns: Col[];
  onClose: () => void;
  onConfirm: (keys: string[], opts: { orientation: 'auto' | 'portrait' | 'landscape'; hideEmpty: boolean }) => void;
};

const storageKey = (id: string) => `report-cols:${id}`;
function loadSaved(id: string, all: Col[]): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(id)) || 'null') as string[] | null;
    if (!saved) return new Set(all.map((c) => c.key));
    const known = new Set(saved);
    const prev = JSON.parse(localStorage.getItem(storageKey(id) + ':all') || '[]') as string[];
    // keep saved picks; columns added since the last save start selected; required always on
    return new Set(all.filter((c) => c.required || known.has(c.key) || !prev.includes(c.key)).map((c) => c.key));
  } catch { return new Set(all.map((c) => c.key)); }
}

export function ColumnPickerModal({ open, mode, reportId, columns, onClose, onConfirm }: Props) {
  const [sel, setSel] = useState(() => loadSaved(reportId, columns));
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [hideEmpty, setHideEmpty] = useState(true);
  const groups = useMemo(() => {
    const m = new Map<string, Col[]>();
    columns.forEach((c) => { const g = c.group ?? ''; m.set(g, [...(m.get(g) ?? []), c]); });
    return [...m.entries()];
  }, [columns]);

  const toggle = (c: Col) => !c.required && setSel((s) => { const n = new Set(s); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; });
  const setMany = (cols: Col[], on: boolean) => setSel((s) => { const n = new Set(s); cols.forEach((c) => (on || c.required ? n.add(c.key) : n.delete(c.key))); return n; });
  const confirm = () => {
    const keys = columns.filter((c) => sel.has(c.key)).map((c) => c.key); // keep the report's order
    try {
      localStorage.setItem(storageKey(reportId), JSON.stringify(keys));
      localStorage.setItem(storageKey(reportId) + ':all', JSON.stringify(columns.map((c) => c.key)));
    } catch { /* private mode: selection just isn't remembered */ }
    onConfirm(keys, { orientation, hideEmpty });
  };
  const autoLabel = sel.size > 8 ? 'Landscape' : 'Portrait';
  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={mode === 'print' ? 'Print: choose columns' : 'Export: choose columns'}>
      <div className="toolbar">
        <span>{sel.size} of {columns.length} columns</span>
        <button type="button" onClick={() => setMany(columns, true)}>Select all</button>
        <button type="button" onClick={() => setMany(columns, false)}>Clear</button>
      </div>
      {groups.map(([g, cols]) => (
        <section key={g}>
          {g && (
            <header>
              <span>{g}</span>
              <button type="button" onClick={() => setMany(cols, !cols.every((c) => sel.has(c.key)))}>
                {cols.every((c) => sel.has(c.key)) ? 'None' : 'All'}
              </button>
            </header>
          )}
          <div className="pills">
            {cols.map((c) => (
              <button key={c.key} type="button" className="pill" aria-pressed={sel.has(c.key)}
                aria-disabled={c.required} title={c.required ? 'Always included' : undefined} onClick={() => toggle(c)}>
                {sel.has(c.key) ? '✓ ' : ''}{c.header}{c.required ? ' 🔒' : ''}
              </button>
            ))}
          </div>
        </section>
      ))}
      {mode === 'print' && (
        <div className="print-options">
          <select value={orientation} onChange={(e) => setOrientation(e.target.value as typeof orientation)}>
            <option value="auto">Auto ({autoLabel}: {sel.size} columns)</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <label><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} /> Hide empty columns</label>
        </div>
      )}
      <footer>
        <button type="button" onClick={() => setSel(new Set(columns.map((c) => c.key)))}>Reset to all</button>
        <Button onClick={confirm} disabled={sel.size === 0}>{mode === 'print' ? 'Print' : 'Export to Excel'}</Button>
      </footer>
    </Modal>
  );
}
```

How it plugs in: the shared Print button opens the modal with `mode="print"`. `onConfirm` then fetches all rows, filters the columns, calls `renderReportHtml` and then `openPrintWindow`. The Export button does the same with `mode="export"` and the app's XLSX writer.

## 3. Tests worth writing

- Every row's period cells add up to its total, and the group subtotals add up to the grand total (use a fixture with two groups).
- "Hide empty columns" drops a column that is zero in every row, and keeps it when one row has a value.
- A required column can't be deselected, and "Clear" leaves only the required ones.
- A saved selection with a stale key loads without error, and a newly added column starts selected.
- A value of `O'Brien <script>` comes out escaped in the HTML.
