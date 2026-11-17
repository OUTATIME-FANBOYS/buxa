/** One session on the Home page's upcoming list. */
export interface UpcomingSession { id: string; className: string; startsAt: string; location: string }

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
}
