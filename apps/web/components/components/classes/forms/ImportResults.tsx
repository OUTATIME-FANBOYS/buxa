import type { ImportPlan, RowResult, RowStatus } from '@buxa/domain';
import { Pill } from '@/components/elements/export';
import type { Tone } from '@buxa/shared';

const STATUS: Record<RowStatus, { label: string; tone: Tone }> = {
  create: { label: 'Ready: new', tone: 'ok' },
  update: { label: 'Ready: update', tone: 'brand' },
  refused: { label: 'Refused', tone: 'crit' },
};

/** The count line above the table: what will be saved, what will be skipped. */
export function countsLine(counts: ImportPlan['counts']): string {
  const ready = counts.create + counts.update;
  const readyText = ready === 1 ? '1 row is ready' : `${ready} rows are ready`;
  const refusedText = counts.refused === 1 ? '1 row is refused' : `${counts.refused} rows are refused`;
  return `${readyText}, ${refusedText}.`;
}

/**
 * Every row of the file with its result. A refused row shows each reason against its column, so the owner can fix the file.
 * Nothing here is saved yet: this is the preview.
 */
export function ImportResults({ results, counts }: { results: readonly RowResult[]; counts: ImportPlan['counts'] }) {
  return (
    <section aria-labelledby="import-results-heading" className="stack">
      <h2 id="import-results-heading" className="people-subheading">Preview</h2>
      <p aria-live="polite" className="muted">{countsLine(counts)} Nothing is saved until you confirm.</p>
      <div className="table-wrap"><table className="table classes-import-table">
        <caption className="sr-only">Every row in the file, with its result</caption>
        <thead><tr>
          <th scope="col">Row</th><th scope="col">Result</th><th scope="col">Class</th><th scope="col">Starts</th>
          <th scope="col">Ends</th><th scope="col">Location</th><th scope="col">Reason</th>
        </tr></thead>
        <tbody>
          {results.map(row => {
            const status = STATUS[row.status];
            return (
              <tr key={row.rowNumber}>
                <td>{row.rowNumber}</td>
                <td><Pill tone={status.tone}>{status.label}</Pill></td>
                <td>{row.className || '-'}</td>
                <td>{row.startsAt || '-'}</td>
                <td>{row.endsAt || '-'}</td>
                <td>{row.location || '-'}</td>
                <td>
                  {row.problems.length === 0 ? <span className="muted">Matches the camp</span> : (
                    <ul className="classes-problems">
                      {row.problems.map((p, i) => <li key={`${p.field}-${i}`}><strong>{p.field}:</strong> {p.message}</li>)}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </section>
  );
}
