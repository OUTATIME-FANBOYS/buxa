/** One session on the Home page's upcoming list. */
export interface UpcomingSession { id: string; className: string; startsAt: string; location: string }

/** People checked in on one camp-local day. */
export interface DayCount { date: string; count: number }

/**
 * The check-in chart's data: one entry per camp-local day, oldest first, ending today. `complete` is false when the camp had more
 * visits in the window than one read returns, so the older days may be short.
 */
export interface CheckInsByDay { days: DayCount[]; complete: boolean }

/** Everyone on the camp list by membership status. `none` includes revoked memberships. */
export interface MembershipStatusCounts { valid: number; notStarted: number; expired: number; none: number }

/** What the camp Home shows. A fact is null when the viewer's role may not read it, so the page never shows a number its own page would refuse. */
export interface CampHome {
  campId: string;
  name: string;
  firstName: string;
  /** Owners and admins may rename the camp (org:update). */
  canRename: boolean;
  /** People on the camp list. */
  people: number | null;
  /** Checked in and not yet checked out. */
  onSite: number | null;
  /** People who checked in at any time today (camp-local day). */
  checkedInToday: number | null;
  /** People whose membership is valid today. */
  validMemberships: number | null;
  /** The next few sessions across all classes, soonest first. An empty list when there are none; null when the viewer may not read classes. */
  upcomingSessions: UpcomingSession[] | null;
  /** People checked in per day for the last 30 days. Null when the viewer may not read attendance. */
  checkInsByDay: CheckInsByDay | null;
  /** On site now, split into adults and minors. Null when the viewer may not read attendance or the contact-level minor flag. */
  onSiteByAge: { adults: number; minors: number } | null;
  /** Membership status across the camp list. Null when the viewer may not read membership status. */
  membershipStatus: MembershipStatusCounts | null;
}
