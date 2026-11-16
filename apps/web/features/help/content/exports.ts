import type { HelpSectionContent } from './types';

export const EXPORTS_SECTION: HelpSectionContent = {
  id: 'exports',
  title: 'Exports',
  intro: [
    'An export is a file you download to keep or to pass to the people who need it. These exports are available now.',
  ],
  subsections: [
    {
      id: 'attendance-csv',
      heading: 'Attendance CSV',
      paragraphs: [
        'The attendance CSV lists every visit in the days you choose, one visit per row.',
      ],
      steps: [
        'Open Attendance from the sidebar.',
        'Choose the From and To dates. These are camp days, in camp time. They start as today.',
        'Optional: choose one person under Person. Leave it on Everyone for the whole camp.',
        'Press Show to check the list, then press Download CSV.',
      ],
      after: [
        'Only admins and owners see Download CSV.',
        'The file is named after the dates, for example attendance-2027-06-07-to-2027-06-08.csv.',
      ],
    },
    {
      heading: 'What the columns mean',
      table: {
        caption: 'Attendance CSV columns',
        headers: ['Column', 'What it holds'],
        rows: [
          ['Person', 'The name of the person who came in.'],
          ['Checked in', 'When they came in. Times are UTC and end in Z.'],
          ['Checked in by', 'The staff member who recorded the arrival.'],
          ['Method', 'How they were found: qr (badge scan), search (name search) or manual.'],
          ['Checked out', 'When they left. Blank while they are still on site.'],
          ['Checked out by', 'The staff member who recorded the departure.'],
          ['Collected by', 'For a child, the guardian who collected them. Blank otherwise.'],
          ['Override reason', 'The written reason when an admin allowed a refused check-in or check-out.'],
          ['Note', 'Free text that staff wrote. See Privacy before you put anything here.'],
        ],
      },
    },
    {
      heading: 'Opening the file',
      paragraphs: [
        'Excel: double-click the downloaded file, or open Excel and use File, then Open.',
        'Google Sheets: use File, then Import, then Upload, and choose the file.',
        'The file starts with a byte-order mark. It is invisible. It tells Excel the file is UTF-8, so accented names such as José show correctly. Do not delete it.',
      ],
    },
    {
      heading: 'Names that start with a symbol',
      paragraphs: [
        'If a name or note starts with =, +, -, @ or a tab, the file adds an apostrophe at the start. A spreadsheet then shows the text, and does not run it as a formula. You may see the apostrophe in the cell. It is not a fault in the file.',
      ],
    },
    {
      heading: 'Too many visits',
      paragraphs: [
        'An export of 5000 visits or more is refused. The message says: That is too many visits to export at once. Choose a shorter date range.',
        'Narrow the From and To dates, export that range, then export the next one.',
      ],
    },
  ],
};
