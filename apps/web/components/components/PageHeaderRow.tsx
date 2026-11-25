import type { ReactNode } from 'react';

/**
 * The header of a list page: the title block on the left (title and subtitle), and a row of controls on the right (a search, a
 * session select, a button). The controls sit on the title block's centre line, and on a narrow screen they stack under the title.
 * Styles: styles/components/page-head-row.css.
 */
export function PageHeaderRow({
  title,
  subtitle,
  controls,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
}) {
  return (
    <header className="page-head page-head-row">
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {controls && <div className="page-head-controls">{controls}</div>}
    </header>
  );
}
