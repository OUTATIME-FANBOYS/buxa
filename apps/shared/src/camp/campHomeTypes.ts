/** What the camp Home shows. A count is null when the viewer's role may not read it, so the page never shows a number its own page would refuse. */
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
  /** People whose membership is valid today. */
  validMemberships: number | null;
}
