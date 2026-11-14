import type { AttendanceEntry } from '@buxa/contracts';
import { OnSitePill } from './OnSitePill';
import { formatInstant } from '../lib/format';

/** One person's visits, newest first. Staff are named, never shown as ids. */
export function AttendanceHistory({ entries }: { entries: readonly AttendanceEntry[] }) {
  return (
    <section className="panel" aria-labelledby="visits-heading">
      <h2 id="visits-heading" className="people-heading">Attendance</h2>
      {entries.length === 0 ? <p className="muted">No visits yet.</p> : (
        <div className="table-wrap"><table className="table">
          <caption className="sr-only">Visits to camp, newest first</caption>
          <thead><tr><th scope="col">Arrived</th><th scope="col">Left</th><th scope="col">Checked in by</th><th scope="col">Collected by</th><th scope="col">Notes</th></tr></thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>{formatInstant(entry.checkedInAt)}</td>
                <td>{entry.checkedOutAt ? formatInstant(entry.checkedOutAt) : <OnSitePill onSite />}</td>
                <td>{entry.checkedInByName ?? '—'}</td>
                <td>{entry.collectedByName ?? '—'}</td>
                <td>{[entry.overrideReason && `Override: ${entry.overrideReason}`, entry.note].filter(Boolean).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </section>
  );
}
