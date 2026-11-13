'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui';
import { isActive, type NavItem } from './navItems';

/** The links, a client island only to mark the current page. */
export function SidebarNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav><ul>
      {items.map(item => {
        const active = isActive(pathname, item);
        return (
          <li key={item.label}>
            <Link href={item.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <Icon name={item.icon} size={18} /><span className="collapsible">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul></nav>
  );
}
