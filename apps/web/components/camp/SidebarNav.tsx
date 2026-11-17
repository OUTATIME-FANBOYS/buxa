'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/elements';
import { isActive, type NavGroup } from '@buxa/shared';

/** The links in their groups, a client island only to mark the current page. */
export function SidebarNav({ groups }: { groups: readonly NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav>
      {groups.map(group => (
        <div key={group.label || 'home'} className="nav-group">
          {group.label && <h2 className="nav-group-label">{group.label}</h2>}
          <ul>
            {group.items.map(item => {
              const active = isActive(pathname ?? "", item);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                    <Icon name={item.icon} size={18} /><span className="collapsible">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
