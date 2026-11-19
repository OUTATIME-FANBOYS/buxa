import { type ReactNode, useId } from 'react';
import { type ChartTone } from '@/components/elements';

export interface ChartCardTable {
  caption: string;
  headers: [string, string];
  rows: { label: string; value: number }[];
}

/**
 * A chart in a card, in the stat-card style: the title on top with an optional control on the right, the main value in bold with an
 * optional change badge and a grey subtitle, then the chart, a legend of coloured dots and an optional table view.
 * The card lifts on hover with a gentle tilt; the tilt is off under reduced motion (charts.css).
 */
export function ChartCard({
  title,
  action,
  value,
  badge,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  action?: ReactNode;
  value: ReactNode;
  badge?: ReactNode;
  subtitle?: ReactNode;
  legend?: { name: string; tone: ChartTone }[];
  table?: ChartCardTable;
  children: ReactNode;
}) {
  const titleId = `chart-${useId().replace(/:/g, '')}`;

  return (
    <section className="panel chart-card" aria-labelledby={titleId}>
      <div className="panel-head chart-card-head">
        <h2 id={titleId}>{title}</h2>
        {action}
      </div>
      <div className="chart-card-figure">
        <div className="chart-card-value">
          <span className="chart-value">{value}</span>
          {badge}
        </div>
        {subtitle && <p className="chart-sub muted small">{subtitle}</p>}
      </div>
      {children}
      {legend && legend.length > 0 && (
        <ul className="chart-legend" aria-label="Legend">
          {legend.map(item => (
            <li key={item.name}>
              <span className={`chart-sw chart-tone-${item.tone}`} aria-hidden="true" />
              {item.name}
            </li>
          ))}
        </ul>
      )}
      {table && (
        <details className="chart-table-alt">
          <summary className="link">Show as a table</summary>
          <table className="chart-table">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{table.headers[0]}</th>
                <th scope="col">{table.headers[1]}</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(row => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
