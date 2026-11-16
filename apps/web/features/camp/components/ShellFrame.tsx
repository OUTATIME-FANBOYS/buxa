'use client';

import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useUi } from '@/components/ui';

/** The page skeleton and its small-screen open/close state. Everything inside arrives already rendered by the server. */
export function ShellFrame({ sidebar, topBar, children }: { sidebar: ReactNode; topBar: ReactNode; children: ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useUi();
  const pathname = usePathname();
  useEffect(() => { setSidebarOpen(false); }, [pathname, setSidebarOpen]);

  return (
    <div className={`shell ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      {sidebar}
      {sidebarOpen && <div className="nav-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-col">
        {topBar}
        <main id="main" tabIndex={-1} className="main">{children}</main>
      </div>
    </div>
  );
}
