/** Every id the demo data uses, in one place. Tests and the agent demo import these instead of repeating strings. */
export const DEMO_PASSWORD = 'demo1234';
export const AGENT_ID = 'u-agent-triage';

export const USER = {
  rosa: 'u-rosa',
  tom: 'u-tom',
  hannah: 'u-hannah',
  sam: 'u-sam',
  nia: 'u-nia',
} as const;
export type PersonId = (typeof USER)[keyof typeof USER];

export const WORKSPACE = { camp: 'w-birchwood', personal: 'w-me' } as const;

export const PROJECT = {
  registration: 'p-registration',
  facilities: 'p-facilities',
  staffing: 'p-staffing',
  comms: 'p-comms',
  programme: 'p-programme',
  offSeason: 'p-off-season',
} as const;
export type ProjectId = (typeof PROJECT)[keyof typeof PROJECT];

/** The camp workspace's projects (everything except the personal one), in sidebar order. */
export const CAMP_PROJECT_IDS: readonly ProjectId[] = [
  PROJECT.registration, PROJECT.facilities, PROJECT.staffing, PROJECT.comms, PROJECT.programme,
];

export const PROJECT_NAME = {
  registration: 'Summer 2027 Registration',
  facilities: 'Facilities & Safety Prep',
  staffing: 'Staff Hiring & Training',
  comms: 'Parent Communications',
  programme: 'Activities & Programme',
  offSeason: 'Off-season Planning',
} as const;

/** Titles other seed files refer to (activity feed, notices), so they are looked up rather than guessed by position. */
export const TASK_TITLE = {
  welcomeEmail: 'Send parent welcome email',
  sessionDates: 'Finalise 2027 session dates and fees',
  paymentPlan: 'Configure deposit and payment plan',
  importRecords: 'Import returning-camper records',
  formQuestions: 'Rewrite registration form questions',
  allergySection: 'Medical and allergy section review',
  waivers: 'Collect signed waivers and medical forms',
  formLayout: 'Draft registration form layout',
  paymentProvider: 'Choose payment provider',
  smokeAlarms: 'Fire extinguisher and smoke alarm check',
  trainingBudget: 'Staff training week budget sign-off',
} as const;
