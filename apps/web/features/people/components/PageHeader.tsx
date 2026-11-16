import type { ReactNode } from 'react';

/** The title block of a people page. Its own copy: the camp feature's header is not exported for other features. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-title"><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
