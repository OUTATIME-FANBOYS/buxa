import { ROUTES } from '../config/routes';
import { EXPORTS_SECTION } from './exports';
import { IMPORTS_SECTION } from './imports';
import { PRIVACY_SECTION } from './privacy';
import { TROUBLESHOOTING_SECTION } from './troubleshooting';
import type { HelpSectionContent } from './types';

export type { HelpSectionContent, HelpSubsection, HelpTable, HelpCode, HelpAvailability } from './types';
export { IMPORT_COLUMNS } from './imports';

/** The page title and its opening words. */
export const HELP_PAGE = {
  title: 'Help',
  intro:
    'How to get data out of the app and into it, and what to do when something does not work. Find the section you need below.',
} as const;

/** The sections, in page order. */
export const HELP_SECTIONS: readonly HelpSectionContent[] = [
  EXPORTS_SECTION,
  IMPORTS_SECTION,
  PRIVACY_SECTION,
  TROUBLESHOOTING_SECTION,
];

/** The label of the link to this page from the pages that need it. */
export const HELP_LINK_LABEL = 'Help';

/** The address of one section of the help page, for example /camp/help#exports. */
export const helpLink = (sectionId: string): string => `${ROUTES.help}#${sectionId}`;
