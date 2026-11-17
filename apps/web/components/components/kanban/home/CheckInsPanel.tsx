'use client';

import { useState } from 'react';
import type { CheckInsByDay } from '@buxa/shared/camp/campHomeTypes';
import { Segmented } from '@/components/elements/export';
import { CHECK_IN_RANGES, type CheckInRange, chartTotals, dayOfMonth, lastDays, shortDate, showAxisLabel } from './homeChartMath';

/**
 * People checked in per camp-local day, as bars, with a range picker. The table under it is the full text alternative: every
 * day, with its count. A null series means the viewer's role may not read attendance, so the panel says that instead.
 */
export function CheckInsPanel({ series }: { series: CheckInsByDay | null }) {
  const [range, setRange] = useState<CheckInRange>(14);
  if (series === null) {
    return (
      <section className="panel" aria-labelledby="check-ins-title">
        <div className="panel-head"><h2 id="check-ins-title">Check-ins per day</h2></div>
        <p className="muted">Attendance is not shown for your role.</p>
      </section>
    );
  }
  const days = lastDays(series.days, range);
  const { total, busiest } = chartTotals(days);
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <section className="panel home-chart" aria-labelledby="check-ins-title">
      <div className="panel-head home-chart-head">
        <h2 id="check-ins-title">Check-ins per day</h2>
        <Segmented<string>
          label="Date range"
          value={String(range)}
          onChange={value => setRange(Number(value) as CheckInRange)}
          options={CHECK_IN_RANGES.map(n => ({ value: String(n), label: `${n} days` }))}
        />
      </div>
      <p className="muted small">
        {total} {total === 1 ? 'person' : 'people'} checked in from {shortDate(first.date)} to {shortDate(last.date)}.
        {busiest ? ` Busiest day: ${shortDate(busiest.date)}, ${busiest.count}.` : ''}
      </p>
      {!series.complete && (
        <p className="home-note small">
          This camp has more visits in the last {CHECK_IN_RANGES[CHECK_IN_RANGES.length - 1]} days than the page can count, so the older days may be short. The Attendance log shows every visit.
        </p>
      )}
      {total === 0 ? (
        <p className="muted">No check-ins in the last {range} days.</p>
      ) : (
        <>
          <ol className="home-bars" aria-label={`Check-ins per day, last ${range} days`}>
            {days.map((day, i) => (
              <li key={day.date} className="home-bar">
                <span className="home-bar-value" aria-hidden="true">{range <= 14 && day.count > 0 ? day.count : ''}</span>
                <span className="home-bar-track">
                  <span className="home-bar-fill" style={{ height: `${(day.count / Math.max(1, busiest?.count ?? 0)) * 100}%` }} />
                </span>
                <span className="home-bar-label" aria-hidden="true">{showAxisLabel(i, days.length) ? dayOfMonth(day.date) : ''}</span>
                <span className="sr-only">{shortDate(day.date)}: {day.count} {day.count === 1 ? 'person' : 'people'}</span>
              </li>
            ))}
          </ol>
          <details className="home-table-alt">
            <summary className="link">Show as a table</summary>
            <table className="home-table">
              <caption className="sr-only">Check-ins per day, last {range} days</caption>
              <thead><tr><th scope="col">Day</th><th scope="col">People checked in</th></tr></thead>
              <tbody>
                {days.map(day => <tr key={day.date}><td>{shortDate(day.date)}</td><td>{day.count}</td></tr>)}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
