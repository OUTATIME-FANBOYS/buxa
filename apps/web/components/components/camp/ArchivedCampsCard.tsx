import type { ArchivedCamp } from '@/actions/camp';

/** A read-only list of the person's archived camps: the name and the date each was archived. */
export function ArchivedCampsCard({ camps }: { camps: readonly ArchivedCamp[] }) {
  return (
    <section className="panel" id="archived-camps">
      <h2>Archived camps</h2>
      {camps.length === 0
        ? <p className="muted">No archived camps.</p>
        : <ul className="archived-list">{camps.map(camp => (
          <li key={camp.id}><span>{camp.name}</span> <span className="muted">Archived {formatDate(camp.archivedAt)}</span></li>
        ))}</ul>}
    </section>
  );
}

/** A fixed format in UTC, so the server and the browser print the same date. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}
