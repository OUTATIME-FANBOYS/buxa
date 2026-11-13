'use client';

import { Icon, useUi } from '@/components/ui';

export function SidebarToggle() {
  const { setSidebarOpen } = useUi();
  return <button className="icon-btn only-mobile" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button>;
}
