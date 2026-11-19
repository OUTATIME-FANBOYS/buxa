'use client';

import { Button } from '@/components/elements';
import { useUi } from '@buxa/middleware/providers/UiProvider';

export function SidebarToggle() {
  const { setSidebarOpen } = useUi();

  return (
    <Button
      iconOnly
      icon="menu"
      className="only-mobile"
      aria-label="Open navigation"
      onClick={() => setSidebarOpen(true)}
    />
  );
}
