import type { HelpSectionContent } from './types';

export const PRIVACY_SECTION: HelpSectionContent = {
  id: 'privacy',
  title: 'Privacy and children’s data',
  intro: [
    'Many people on this app are children. Treat their details with care, every time you export, import or share them.',
  ],
  subsections: [
    {
      heading: 'Who may see children’s data',
      paragraphs: [
        'Only staff who need a child’s details for their job should see them, such as the people checking children in and out.',
        'Do not forward an export to anyone who does not need it.',
      ],
    },
    {
      heading: 'Never put these in a file',
      paragraphs: [
        'Do not put these in any export, import, note or email: medical notes, allergy details, photos, home addresses or government ID numbers.',
        'The import does not accept them, and this version of the app does not store them.',
      ],
    },
    {
      heading: 'Keep files safe',
      steps: [
        'Save an export only where your camp keeps staff files.',
        'Delete your copy when you no longer need it.',
        'Keep the Note column to facts about the visit, not health information.',
      ],
    },
  ],
};
