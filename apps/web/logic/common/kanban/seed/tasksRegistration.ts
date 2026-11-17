import { PROJECT, TASK_TITLE, USER } from './ids';
import { doneSpec, spec, type TaskSpec } from './taskBuilder';

const R = PROJECT.registration;
const { rosa, tom, hannah, sam, nia } = USER;

/**
 * Summer 2027 Registration. Order matters: tests and the agent demo refer to the early tasks by position
 * (t-4 is an unstarted task owned by Nia, t-8 is the director's own task in progress).
 */
export const registrationTasks = (): TaskSpec[] => [
  spec(R, 0, 'Plan sibling and early-bird discount tiers', 'low', sam, null, 40, ['pricing', 'planning']),
  spec(R, 0, 'Evaluate registration software options', 'medium', hannah, null, null, ['research'], { desc: 'Compare three camp management platforms on family accounts, payment plans, waiver support and reporting.' }),
  spec(R, 0, 'Waitlist policy for full sessions', 'low', rosa, null, 30, ['policy']),
  spec(R, 1, TASK_TITLE.welcomeEmail, 'high', nia, -1, 3, ['communications'], { desc: 'Warm, short and practical: dates, what to expect, who to call. Link the packing list and the waiver portal.', comments: [[hannah, 'Can we run the draft past two returning parents before it goes to everyone?']] }),
  spec(R, 1, 'Set up registration confirmation emails', 'medium', tom, null, 6, ['email', 'operations']),
  spec(R, 1, TASK_TITLE.waivers, 'high', hannah, null, 2, ['waivers', 'compliance'], { subs: [['Export list of unsigned families', true], ['Send reminder to families', false], ['Review outstanding forms with Tom', false]] }),
  spec(R, 1, 'Define refund and cancellation terms', 'medium', sam, null, 9, ['policy']),
  spec(R, 2, TASK_TITLE.sessionDates, 'critical', rosa, -8, 2, ['planning'], {
    desc: 'Four two-week sessions plus a long weekend retreat. Fees, age ranges and capacity per session, ready for the board.',
    subs: [['Session weeks agreed', true], ['Age ranges per session', true], ['Fee table', true], ['Capacity per cabin group', true], ['Sibling discount rules', false], ['Board approval', false]],
    comments: [[tom, 'Fee table looks right. Can we publish the weeks as a calendar file too?'], [rosa, 'Yes, adding it this afternoon.']], files: ['session-calendar-2027.pdf'] }),
  spec(R, 2, TASK_TITLE.paymentPlan, 'high', tom, -4, 1, ['payments'], { subs: [['Deposit amount', true], ['Instalment schedule', false], ['Late payment reminder', false]] }),
  spec(R, 2, 'Photo consent options on the form', 'low', nia, -3, 5, ['privacy']),
  spec(R, 2, TASK_TITLE.importRecords, 'medium', sam, -6, -1, ['data', 'operations'], { desc: '212 families. Check emails, emergency contacts and sibling links after import.', subs: [['Import script', true], ['Fix duplicate parent accounts', false], ['Check sibling links', false]] }),
  spec(R, 3, TASK_TITLE.formQuestions, 'high', rosa, -10, -2, ['forms'], { comments: [[hannah, 'Dietary needs should come earlier in the form, before payment.'], [rosa, 'Agreed, I will reorder and share a new draft tomorrow.']], files: ['registration-form-draft.pdf'] }),
  spec(R, 3, TASK_TITLE.allergySection, 'critical', hannah, -2, 0, ['health', 'compliance'], { subs: [['Allergy checklist wording', true], ['Medication consent', false], ['Emergency contact fields', true]] }),
  spec(R, 3, 'Capacity limits per age group', 'medium', tom, -2, 2, ['planning']),
  doneSpec(R, 'Review last summer’s enrolment', 'medium', sam, -20, ['research']),
  doneSpec(R, 'Age-group and cabin structure', 'high', rosa, -15, ['planning'], 6),
  doneSpec(R, 'Confirm session weeks with the board', 'high', rosa, -12, ['research'], 7),
  doneSpec(R, 'Set up test registration site', 'medium', tom, -10, ['planning'], 5),
  doneSpec(R, 'Parent survey on pricing', 'medium', hannah, -17, ['research'], 5),
  doneSpec(R, 'Waiver template from legal', 'low', hannah, -9, ['planning'], 7),
  doneSpec(R, TASK_TITLE.formLayout, 'high', rosa, -6, ['research'], 5),
  doneSpec(R, TASK_TITLE.paymentProvider, 'low', tom, -4, ['planning'], 6),
  doneSpec(R, 'Kick-off meeting with the board', 'low', hannah, -26, ['research'], 5),
];
