/*
 * The tabs on a session's page. The URL names the open one in `?tab=` (for example `?tab=registrations`), so refresh and back keep
 * it. Classes is the default: an unknown tab, or one the viewer may not see, shows Classes.
 */
export const SESSION_TABS = ['classes', 'registrations', 'holds'] as const;
export type SessionTab = (typeof SESSION_TABS)[number];

export const SESSION_TAB_LABELS: Record<SessionTab, string> = {
  classes: 'Classes',
  registrations: 'Registrations',
  holds: 'Holds',
};

/**
 * The tabs a person may see. Registrations and Holds both read registration (the same read as the Registration and Holds screens),
 * so without it only Classes is left.
 */
export function visibleSessionTabs(canReadRegistration: boolean): SessionTab[] {
  return canReadRegistration ? [...SESSION_TABS] : ['classes'];
}

/** The tab the URL asks for, when it is one of the visible tabs; anything else (missing, unknown, repeated) is Classes. */
export function resolveSessionTab(
  requested: string | string[] | undefined,
  visible: readonly SessionTab[],
): SessionTab {
  if (typeof requested !== 'string') {
    return 'classes';
  }

  return visible.find(tab => tab === requested) ?? 'classes';
}
