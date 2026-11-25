'use client';

import { useMemo, useState } from 'react';
import type { OnSiteRowView } from '@buxa/shared';
import { SearchField } from '@/components/atoms';
import { PageHeader } from '@/components/components';
import { OnSiteRow, ON_SITE_LIST_ID } from './OnSiteRow';

/** Lower case, accents removed and spaces trimmed, so "rene" finds "René" and a stray space does not hide everyone. */
function searchKey(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * The people on site. The page title, its count and the name search share one line (the search at the right, centred on the title
 * block); the list sits below. The list filters as you type by name; with nothing matching it says so instead of showing an
 * empty list. The rows are the same as before (check-out for staff).
 */
export function OnSiteList({
  title,
  subtitle,
  rows,
  canRecord,
  canOverride,
}: {
  title: string;
  subtitle: string;
  rows: readonly OnSiteRowView[];
  canRecord: boolean;
  canOverride: boolean;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = searchKey(query);

    return needle === '' ? rows : rows.filter(row => searchKey(row.name).includes(needle));
  }, [rows, query]);

  return (
    <div className="onsite-page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="onsite-search">
            <SearchField
              aria-label="Search people on site"
              placeholder="Search by name"
              value={query}
              onChange={setQuery}
            />
          </div>
        }
      />
      <div id={ON_SITE_LIST_ID} tabIndex={-1} className="onsite-wrap">
        {shown.length === 0 ? (
          <p className="class-helper" role="status">
            No one on site matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <ul className="onsite-list" aria-label="People on site">
            {shown.map(row => (
              <OnSiteRow key={row.personId} row={row} canRecord={canRecord} canOverride={canOverride} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
