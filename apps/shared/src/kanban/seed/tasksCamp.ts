import { PROJECT, TASK_TITLE, USER } from './ids';
import { doneSpec, spec, type TaskSpec } from './taskBuilder';

const { rosa, tom, hannah, sam, nia } = USER;

const facilities = (): TaskSpec[] => {
  const F = PROJECT.facilities;

  return [
    spec(F, 0, 'Shade structure for the archery field', 'medium', tom, null, 35),
    spec(F, 0, 'Repaint dining hall trim', 'low', rosa, null, null),
    spec(F, 1, 'Order replacement life jackets', 'high', tom, null, 8, {
      subs: [
        ['Count current stock', false],
        ['Get supplier quotes', false],
      ],
    }),
    spec(F, 1, 'Campfire wood delivery schedule', 'low', sam, null, 12),
    spec(F, 1, 'Bus route plan for camper transport', 'high', undefined, null, 10),
    spec(F, 2, 'First-aid kit audit across all cabins', 'critical', rosa, -5, 3, {
      subs: [
        ['Cabins 1 to 6', true],
        ['Cabins 7 to 12', false],
        ['Waterfront and lodge kits', false],
      ],
      comments: [[hannah, 'Please restock the epinephrine auto-injectors first.']],
    }),
    spec(F, 2, 'Archery range inspection', 'medium', tom, -2, 4),
    spec(F, 3, TASK_TITLE.smokeAlarms, 'medium', rosa, -9, -3),
    doneSpec(F, 'Book county health inspection', 'high', tom, -14, 16),
    doneSpec(F, 'Walk-through of all cabins', 'medium', hannah, -9, 19),
    doneSpec(F, 'Replace dock boards', 'low', sam, -7, 11),
  ];
};

const staffing = (): TaskSpec[] => {
  const S = PROJECT.staffing;

  return [
    spec(S, 0, 'Plan counsellor reunion evening', 'low', hannah, null, 25),
    spec(S, 1, 'Recruit lifeguards for the waterfront', 'high', sam, null, 5),
    spec(S, 1, 'Order staff t-shirts', 'medium', nia, null, 7),
    spec(S, 2, 'Lifeguard certification renewals', 'critical', tom, -3, 0, {
      subs: [
        ['Collect current certificates', true],
        ['Book recertification day', false],
        ['Confirm CPR course dates', false],
      ],
    }),
    spec(S, 2, TASK_TITLE.trainingBudget, 'high', hannah, -4, -1, {
      comments: [[rosa, 'The board wants the split by training day.']],
    }),
    spec(S, 3, 'Write counsellor training schedule', 'medium', rosa, -7, 1),
    doneSpec(S, 'Review applications from returning staff', 'medium', hannah, -11, 13),
    doneSpec(S, 'Finalise job titles and pay bands', 'low', rosa, -8, 8),
  ];
};

const comms = (): TaskSpec[] => {
  const C = PROJECT.comms;

  return [
    spec(C, 0, 'Packing list and what-to-bring guide', 'low', nia, null, 20),
    spec(C, 1, 'Newsletter: meet the 2027 staff', 'medium', nia, null, 14),
    spec(C, 2, 'Parent information evening slides', 'high', hannah, -3, 4),
    spec(C, 2, 'Announce bus routes and pick-up times', 'high', tom, -5, -1),
    spec(C, 3, 'Update the FAQ page', 'medium', nia, -4, 1),
    doneSpec(C, 'Welcome email template', 'low', nia, -10, 12),
  ];
};

const programme = (): TaskSpec[] => {
  const P = PROJECT.programme;

  return [
    spec(P, 0, 'End-of-summer talent show plan', 'low', sam, null, 55),
    spec(P, 1, 'Tie-dye supplies order', 'medium', sam, null, 6),
    spec(P, 1, 'Allergy-free snack supplier', 'high', tom, null, 4, {
      desc: 'Shortlist two suppliers for nut-free and gluten-free snacks. Ask each for ingredient lists and delivery times.',
    }),
    spec(P, 2, 'Cabin assignments for week one', 'high', hannah, -3, 3, {
      subs: [
        ['Group by age and friend requests', true],
        ['Check medical and dietary notes', false],
        ['Share with counsellors', false],
      ],
    }),
    spec(P, 2, 'Archery safety briefing and curriculum', 'medium', sam, -2, 5),
    spec(P, 3, 'Rainy-day activity plan', 'medium', sam, -6, -2),
    doneSpec(P, 'Canoe and kayak fleet inspection', 'medium', tom, -10, 12),
  ];
};

export const campTasks = (): TaskSpec[] => [...facilities(), ...staffing(), ...comms(), ...programme()];
