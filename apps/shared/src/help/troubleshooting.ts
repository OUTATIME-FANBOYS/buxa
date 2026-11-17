import type { HelpSectionContent } from './types';

export const TROUBLESHOOTING_SECTION: HelpSectionContent = {
  id: 'troubleshooting',
  title: 'Troubleshooting',
  intro: ['Find your problem below. Each entry says what to check first.'],
  subsections: [
    {
      heading: '“My file says a row overlaps”',
      paragraphs: [
        'The message names the row and the session it clashes with. A camper cannot be in two overlapping sessions, so this is a real clash, not a bug.',
      ],
      steps: [
        'Read the two times in the message.',
        'Change the time or the day of one of the two sessions in your file.',
        'Upload again and check the preview.',
        'If both sessions are correct, ask an admin how the camp wants to handle the clash.',
      ],
    },
    {
      heading: '“Excel changed my time”',
      paragraphs: [
        'Excel can turn 2027-06-07T09:00 or 09:00 into its own date or time format, or into a different value.',
      ],
      steps: [
        'Before an import: format the time columns as Text, then type or paste the values again.',
        'Check the preview. The time it shows must be the time you meant.',
        'In an export, times are UTC and end in Z. A spreadsheet can show them in another time zone, or as text. Compare them with the Attendance list, which shows camp time, before you act on them.',
      ],
    },
    {
      heading: '“I can’t see a button”',
      paragraphs: [
        'Buttons depend on your role. Download CSV needs permission to export attendance, which admins and owners have. An import upload needs permission to manage classes.',
        'If you think you should see a button, ask an admin to check your role under Team access.',
      ],
    },
    {
      heading: '“The export says there are too many visits”',
      paragraphs: [
        'An export of 5000 visits or more is refused. Choose a shorter date range and export each part.',
      ],
    },
  ],
};
