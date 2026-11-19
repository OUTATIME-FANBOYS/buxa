'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import { Icon } from '@/components/elements';
import { Menu } from '@/components/components';
import { ROUTES } from '@/config/routes';
import { selectCampAction, type ArchivedCamp } from '@/actions/camp';

/** The camp the person last opened, by its org id. It is listed first in the menu. */
const RECENT_KEY = 'buxa.recentCamp';

function readRecent(): string | null {
  try {
    return localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

function writeRecent(orgId: string) {
  try {
    localStorage.setItem(RECENT_KEY, orgId);
  } catch {
    // Storage can be blocked; the menu simply does not remember this camp.
  }
}

const byName = (a: Membership, b: Membership) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * The camp name in the top bar; opens a menu to switch camp or start another.
 * The menu has a search field, the recent camp first and the rest by name. Archived camps sit behind one "Show archived"
 * item at the bottom. Choosing one opens it read-only.
 */
export function CampSwitcher({
  camps,
  current,
  archivedCamps = [],
}: {
  camps: readonly Membership[];
  current: Membership | null;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const router = useRouter();
  const name = current?.name ?? 'No camp yet';
  const [recent, setRecent] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => setRecent(readRecent()), []);

  const select = async (orgId: string) => {
    writeRecent(orgId);
    setRecent(orgId);
    await selectCampAction(orgId);
    router.push(ROUTES.camp);
    router.refresh();
  };

  const sorted = [...camps].sort(byName);
  const first = sorted.find(c => c.orgId === recent);
  const ordered = first ? [first, ...sorted.filter(c => c !== first)] : sorted;
  const needle = query.trim().toLowerCase();
  const shown = needle ? ordered.filter(c => c.name.toLowerCase().includes(needle)) : ordered;

  return (
    <Menu
      label="Switch camp"
      className="crumb camp-switch"
      align="start"
      search={{ label: 'Search camps', placeholder: 'Search camps', value: query, onChange: setQuery }}
      trigger={
        <>
          <span className="crumb-text" title={name}>
            {name}
          </span>
          <Icon name="down" size={14} />
        </>
      }
      items={[
        ...shown.map(c => ({
          label: c.name,
          checked: c.orgId === current?.orgId,
          onSelect: () => {
            void select(c.orgId);
          },
        })),
        ...(needle && shown.length === 0 ? [{ label: 'No matching camps', disabled: true, onSelect() {} }] : []),
        ...(camps.length ? [{ label: '', divider: true, onSelect() {} }] : []),
        { label: 'New camp…', icon: 'plus', tone: 'ok', onSelect: () => router.push(ROUTES.newCamp) },
        ...(archivedCamps.length
          ? [
              { label: '', divider: true, onSelect() {} },
              {
                label: 'Show archived',
                submenu: archivedCamps.map(c => ({
                  label: c.name,
                  checked: c.id === current?.orgId,
                  onSelect: () => {
                    void select(c.id);
                  },
                })),
              },
            ]
          : []),
      ]}
    />
  );
}
