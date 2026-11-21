'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import { can, type Actor } from '@buxa/domain';
import { Icon } from '@/components/elements';
import { Menu, type MenuAction } from '@/components/components';
import { ROUTES } from '@/config/routes';
import { selectCampAction, type ArchivedCamp } from '@/actions/camp';
import { ArchiveCampDialog } from './ArchiveCampDialog';
import { DeleteCampDialog } from './DeleteCampButton';
import { RenameCampDialog } from './RenameCampDialog';

/** The camp the person last opened, by its org id. It is listed first in the menu. */
const RECENT_KEY = 'buxa.recentCamps';
/** How many recently opened camps the menu lists when nothing is searched. */
const RECENT_LIMIT = 8;

/** The camp ids last opened, most recent first. A single id from the older key is read as a list of one. */
function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = raw.startsWith('[') ? JSON.parse(raw) : [raw];

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string').slice(0, RECENT_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(orgId: string, previous: readonly string[]) {
  try {
    const next = [orgId, ...previous.filter(id => id !== orgId)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage can be blocked; the menu simply does not remember this camp.
  }
}

const byName = (a: Membership, b: Membership) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** The person's role in one camp, as the permission checks need it. */
const actorIn = (camp: Membership): Actor => ({ userId: '', orgId: camp.orgId, role: camp.role });

/** The dialog a row button opened. The dialogs render beside the menu, so the menu's popover cannot clip them. */
type Pending = { kind: 'rename' | 'archive' | 'delete'; camp: Membership } | null;

/**
 * The camp name in the top bar; opens a list to switch camp or start another. The list has a search field at the top and the
 * "New camp…" item fixed at the bottom; the camps scroll between them. Each row has the check on the current camp, and icon
 * buttons to rename (org:update), archive (org:archive) and delete (org:delete, owner only). Choosing the row's name switches camp;
 * a button never does. Archived camps sit behind one "Show archived" item at the bottom, and open read-only.
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
  const [recent, setRecent] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  useEffect(() => setRecent(readRecent()), []);

  const select = async (orgId: string) => {
    writeRecent(orgId, recent);
    setRecent([orgId, ...recent.filter(id => id !== orgId)].slice(0, RECENT_LIMIT));
    await selectCampAction(orgId);
    router.push(ROUTES.camp);
    router.refresh();
  };

  // After a camp is archived or deleted: leave it if it was the open camp, and refresh the lists either way.
  const gone = (orgId: string) => {
    if (orgId === current?.orgId) {
      router.push(ROUTES.camp);
    }
    router.refresh();
  };

  // Recent camps first (most recent first), then the rest by name. Without a search the list holds only the recent camps;
  // a search covers every camp, so a camp outside the recent list can still be found.
  const byRecent = (a: Membership, b: Membership) => {
    const ia = recent.indexOf(a.orgId);
    const ib = recent.indexOf(b.orgId);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);

    return byName(a, b);
  };
  const ordered = [...camps].sort(byRecent);
  const needle = query.trim().toLowerCase();
  const shown = needle ? ordered.filter(c => c.name.toLowerCase().includes(needle)) : ordered.slice(0, RECENT_LIMIT);

  const rowActions = (c: Membership): MenuAction[] => {
    const actor = actorIn(c);
    const actions: (MenuAction | false)[] = [
      can(actor, 'org:update') && {
        label: `Rename ${c.name}`,
        icon: 'edit',
        onSelect: () => setPending({ kind: 'rename', camp: c }),
      },
      can(actor, 'org:archive') && {
        label: `Archive ${c.name}`,
        icon: 'archive',
        onSelect: () => setPending({ kind: 'archive', camp: c }),
      },
      can(actor, 'org:delete') && {
        label: `Delete ${c.name}`,
        icon: 'trash',
        danger: true,
        onSelect: () => setPending({ kind: 'delete', camp: c }),
      },
    ];

    return actions.filter((a): a is MenuAction => a !== false);
  };

  return (
    <>
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
            icon: 'camp',
            checked: c.orgId === current?.orgId,
            onSelect: () => {
              void select(c.orgId);
            },
            actions: rowActions(c),
          })),
          ...(needle && shown.length === 0 ? [{ label: 'No matching camps', disabled: true, onSelect() {} }] : []),
        ]}
        footer={[
          ...(camps.length ? [{ label: '', divider: true, onSelect() {} }] : []),
          { label: 'New camp…', icon: 'plus', onSelect: () => router.push(ROUTES.newCamp) },
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

      {pending?.kind === 'rename' && (
        <RenameCampDialog
          campId={pending.camp.orgId}
          currentName={pending.camp.name}
          onClose={() => {
            setPending(null);
            router.refresh();
          }}
        />
      )}
      {pending?.kind === 'archive' && (
        <ArchiveCampDialog
          campId={pending.camp.orgId}
          campName={pending.camp.name}
          onClose={() => setPending(null)}
          onArchived={() => gone(pending.camp.orgId)}
        />
      )}
      {pending?.kind === 'delete' && (
        <DeleteCampDialog
          campId={pending.camp.orgId}
          campName={pending.camp.name}
          onClose={() => setPending(null)}
          onDeleted={() => gone(pending.camp.orgId)}
        />
      )}
    </>
  );
}
