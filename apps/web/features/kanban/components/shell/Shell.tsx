import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUi } from '@/components/ui';
import { useStore } from '../../state/store';
import type { Route } from '../../lib/router';
import { useGlobalShortcuts } from '../../hooks/useGlobalShortcuts';
import { ProjectDialog, WorkspaceDialog } from '../dialogs';
import { Sidebar } from './Sidebar';
import { Topbar, type ShellDialog } from './Topbar';

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { s, project } = useStore();
  const { sidebarOpen, setSidebarOpen } = useUi();
  const [dlg, setDlg] = useState<ShellDialog>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useGlobalShortcuts(searchRef, !!project);
  useEffect(() => { setSidebarOpen(false); }, [route, setSidebarOpen]);

  return (
    <div className={`shell ${s.ui.sidebarCollapsed ? 'is-collapsed' : ''} ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <Sidebar route={route} />
      {sidebarOpen && <div className="nav-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-col">
        <Topbar searchRef={searchRef} onDialog={setDlg} />
        <main id="main" tabIndex={-1} className="main">{children}</main>
      </div>
      {dlg === 'project' && <ProjectDialog onClose={() => setDlg(null)} />}
      {dlg === 'workspace' && <WorkspaceDialog onClose={() => setDlg(null)} />}
    </div>
  );
}
