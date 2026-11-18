import type { HelpSectionContent } from './types';

/** The import's column names, in template order. The content test checks every one of these appears on this page. */
export const IMPORT_COLUMNS = [
  'external_key',
  'class_name',
  'starts_at',
  'ends_at',
  'location',
  'age_min',
  'age_max',
  'capacity',
  'instructor_names',
  'ratio_campers',
  'ratio_instructors',
] as const;

const EXAMPLE_ROW = [
  'ROB-W1-MON',
  'Robotics',
  '2027-06-07T09:00',
  '2027-06-07T12:00',
  'Lab 2',
  '8',
  '12',
  '10',
  'Priya Shah;Tom Reyes',
  '8',
  '1',
];

export const IMPORTS_SECTION: HelpSectionContent = {
  id: 'imports',
  title: 'Imports',
  availability: {
    label: 'Not available yet',
    detail:
      'Planned for Phase 2, classes and sessions. There is no import button yet. This page describes how it will work, so you can prepare the file.',
  },
  intro: [
    'An import creates many sessions at once from a spreadsheet. You fill in a CSV template, check the preview, and then confirm.',
    'Only people with permission to manage classes can upload or confirm an import.',
  ],
  subsections: [
    {
      heading: 'The template',
      paragraphs: [
        'The app will offer a CSV template to download. It opens in Excel and Google Sheets. Use that template rather than a file of your own.',
        'A printed or scanned PDF cannot be imported. Only CSV.',
      ],
      code: {
        caption: 'Header row and one example row',
        lines: [IMPORT_COLUMNS.join(','), EXAMPLE_ROW.join(',')],
      },
    },
    {
      id: 'import-columns',
      heading: 'Columns',
      table: {
        caption: 'Template columns, with an example row',
        headers: ['Column', 'Meaning', 'Example'],
        rows: [
          [
            'external_key',
            'Optional code for this session that you choose. Uploading the same key again updates the session. See External keys.',
            'ROB-W1-MON',
          ],
          ['class_name', 'The class this session belongs to, spelled as the class is named in the camp.', 'Robotics'],
          [
            'starts_at',
            'When the session starts, in camp local time, ISO format: date, T, then time.',
            '2027-06-07T09:00',
          ],
          [
            'ends_at',
            'When the session ends, in camp local time, same format. A session may cross midnight.',
            '2027-06-07T12:00',
          ],
          ['location', 'Where the session takes place. Free text.', 'Lab 2'],
          ['age_min', 'Youngest age allowed, a whole number. The limit is inclusive.', '8'],
          ['age_max', 'Oldest age allowed, a whole number. The limit is inclusive.', '12'],
          ['capacity', 'The most campers the session can take, a whole number. A hard limit.', '10'],
          ['instructor_names', 'The instructors, separated by a semicolon (;).', 'Priya Shah;Tom Reyes'],
          [
            'ratio_campers',
            'Campers allowed per instructor, the first number of the ratio. Stored and shown; not enforced automatically yet.',
            '8',
          ],
          ['ratio_instructors', 'Instructors for that number of campers, the second number of the ratio.', '1'],
        ],
      },
      after: [
        'The example reads: 8 campers to 1 instructor, ages 8 to 12, 10 places, in Lab 2 from 09:00 to 12:00 on 7 June 2027.',
      ],
    },
    {
      heading: 'Fill in the file',
      steps: [
        'One session per row.',
        'Write times as camp local time, for example 2027-06-07T09:00. Do not add a time zone.',
        'In Excel, format the time columns as Text before you type, so Excel does not change the value.',
        'Separate several instructor names with a semicolon.',
        'Leave external_key empty for a session you will not update later.',
      ],
    },
    {
      heading: 'Preview before you save',
      paragraphs: [
        'After you upload, the app checks every row and shows the result. Nothing is saved during the preview.',
        'Each row shows Ready, or it is refused with the reason. Fix the refused rows in your file and upload again.',
        'Confirm saves the file in one go. See A failed import saves nothing.',
      ],
      table: {
        caption: 'What a preview shows',
        headers: ['Row', 'Result', 'Message'],
        rows: [
          ['2', 'Ready', 'Art, 2027-06-07T13:00 to 15:00, Studio 1'],
          ['4', 'Refused', 'Robotics 09:00-12:00 overlaps Art 10:00-12:00 for the same camper group.'],
        ],
      },
    },
    {
      heading: 'What an error looks like',
      paragraphs: [
        'Every refused row names its row number, the field or rule that failed, and what it clashes with. For example: Row 4, Robotics 09:00-12:00 overlaps Art 10:00-12:00 for the same camper group.',
        'Each row shows its own result, so you can see every problem at once.',
      ],
    },
    {
      id: 'external-keys',
      heading: 'External keys',
      paragraphs: [
        'Give a session an external key, such as ROB-W1-MON, to link it to the row. Uploading the same key again updates that session. It does not create a second one.',
        'A row without a key is created once. If you upload that row again, the preview reports it as a duplicate, and nothing new is created.',
      ],
    },
    {
      heading: 'The rules still apply',
      paragraphs: [
        'Every row is checked against the same rules as a session added by hand: no camper may have two overlapping sessions, ages must fall in the range, and no session may take more campers than its capacity.',
        'An import never skips these rules. A row that breaks one is refused, and the message names the other session or the limit.',
      ],
    },
    {
      heading: 'A failed import saves nothing',
      paragraphs: [
        'Saving is all or nothing. If any row cannot be written, none of the file is saved, and you are told why.',
        'Fix the reason in your file, then upload and confirm again.',
      ],
    },
  ],
};
