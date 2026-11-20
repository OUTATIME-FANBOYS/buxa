/** The kinds of notification the camp sends. A kind sets the icon; the server decides who receives it (by permission). */
export type NotificationKind = 'registration' | 'schedule' | 'people';

/** A notification as a screen reads it. */
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  link: string;
  createdAt: string;
  readAt: string | null;
}

/** How many notifications the list shows, newest first. */
export const NOTIFICATION_LIMIT = 50;

/** The icon for each kind, from the Icon set. */
export const NOTIFICATION_ICON: Record<NotificationKind, string> = {
  registration: 'list',
  schedule: 'calendar',
  people: 'users',
};
