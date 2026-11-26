/*
 * The tabs on the check-in page. The URL names the open one in `?tab=` (for example `?tab=family`), so refresh and back keep it.
 * Scan or find is the default: an unknown or missing tab, or one this person may not use, shows it.
 */
export const CHECK_IN_TABS = ['scan', 'family', 'link', 'phones'] as const;
export type CheckInTab = (typeof CHECK_IN_TABS)[number];

export const CHECK_IN_TAB_LABELS: Record<CheckInTab, string> = {
  scan: 'Scan or find',
  family: 'Family by email',
  link: 'Check-in link',
  phones: 'Phones verified',
};

/**
 * The tabs a person may use. The link is made and replaced by people who may update the camp (org:update), so the link tab is only
 * shown to them. The other tabs go with attendance:record, which the page already requires.
 */
export function visibleCheckInTabs(canManageLink: boolean): CheckInTab[] {
  return CHECK_IN_TABS.filter(tab => tab !== 'link' || canManageLink);
}

/** The tab the URL asks for, when it is one of the visible tabs; anything else (missing, unknown, repeated) is Scan or find. */
export function resolveCheckInTab(
  requested: string | string[] | undefined,
  visible: readonly CheckInTab[],
): CheckInTab {
  if (typeof requested !== 'string') {
    return 'scan';
  }

  return visible.find(tab => tab === requested) ?? 'scan';
}
