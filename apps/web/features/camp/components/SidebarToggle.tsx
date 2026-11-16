'use client';

import { Icon } from '../../../elements';
import { useUi } from '../../../components/ui/UiProvider';

export function SidebarToggle() {
  const { setSidebarOpen } = useUi();
  return <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>;
}
