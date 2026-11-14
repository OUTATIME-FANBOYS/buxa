import { PROJECT, TASK_TITLE, USER } from './ids';
import { doneSpec, spec, type TaskSpec } from './taskBuilder';

const { rosa, tom, hannah, sam, nia } = USER;

const facilities = (): TaskSpec[] => {
  const F = PROJECT.facilities;
  return [
    spec(F, 0, 'Shade structure for the archery field', 'medium', tom, null, 35, ['facilities']),
    spec(F, 0, 'Repaint dining hall trim', 'low', rosa, null, null, ['maintenance']),
    spec(F, 1, 'Order replacement life jackets', 'high', tom, null, 8, ['waterfront', 'supplies'], { subs: [['Count current stock', false], ['Get supplier quotes', false]] }),
    spec(F, 1, 'Campfire wood delivery schedule', 'low', sam, null, 12, ['supplies']),
    spec(F, 1, 'Bus route plan for camper transport', 'high', undefined, null, 10, ['transport']),
    spec(F, 2, 'First-aid kit audit across all cabins', 'critical', rosa, -5, 3, ['safety', 'health'], { subs: [['Cabins 1 to 6', true], ['Cabins 7 to 12', false], ['Waterfront and lodge kits', false]], comments: [[hannah, 'Please restock the epinephrine auto-injectors first.']] }),
    spec(F, 2, 'Archery range inspection', 'medium', tom, -2, 4, ['safety', 'inspection']),
    spec(F, 3, TASK_TITLE.smokeAlarms, 'medium', rosa, -9, -3, ['safety']),
    doneSpec(F, 'Book county health inspection', 'high', tom, -14, ['compliance'], 16),
    doneSpec(F, 'Walk-through of all cabins', 'medium', hannah, -9, ['inspection'], 19),
    doneSpec(F, 'Replace dock boards', 'low', sam, -7, ['maintenance'], 11),
  ];
};

const staffing = (): TaskSpec[] => {
  const S = PROJECT.staffing;
  return [
    spec(S, 0, 'Plan counsellor reunion evening', 'low', hannah, null, 25, ['events']),
    spec(S, 1, 'Recruit lifeguards for the waterfront', 'high', sam, null, 5, ['hiring', 'waterfront']),
    spec(S, 1, 'Order staff t-shirts', 'medium', nia, null, 7, ['supplies']),
    spec(S, 2, 'Lifeguard certification renewals', 'critical', tom, -3, 0, ['certification', 'waterfront'], { subs: [['Collect current certificates', true], ['Book recertification day', false], ['Confirm CPR course dates', false]] }),
    spec(S, 2, TASK_TITLE.trainingBudget, 'high', hannah, -4, -1, ['planning'], { comments: [[rosa, 'The board wants the split by training day.']] }),
    spec(S, 3, 'Write counsellor training schedule', 'medium', rosa, -7, 1, ['training']),
    doneSpec(S, 'Review applications from returning staff', 'medium', hannah, -11, ['hiring'], 13),
    doneSpec(S, 'Finalise job titles and pay bands', 'low', rosa, -8, ['planning'], 8),
  ];
};

const comms = (): TaskSpec[] => {
  const C = PROJECT.comms;
  return [
    spec(C, 0, 'Packing list and what-to-bring guide', 'low', nia, null, 20, ['communications']),
    spec(C, 1, 'Newsletter: meet the 2027 staff', 'medium', nia, null, 14, ['communications', 'newsletter']),
    spec(C, 2, 'Parent information evening slides', 'high', hannah, -3, 4, ['events']),
    spec(C, 2, 'Announce bus routes and pick-up times', 'high', tom, -5, -1, ['transport', 'communications']),
    spec(C, 3, 'Update the FAQ page', 'medium', nia, -4, 1, ['communications']),
    doneSpec(C, 'Welcome email template', 'low', nia, -10, ['communications'], 12),
  ];
};

const programme = (): TaskSpec[] => {
  const P = PROJECT.programme;
  return [
    spec(P, 0, 'End-of-summer talent show plan', 'low', sam, null, 55, ['events']),
    spec(P, 1, 'Tie-dye supplies order', 'medium', sam, null, 6, ['arts', 'supplies']),
    spec(P, 1, 'Allergy-free snack supplier', 'high', tom, null, 4, ['dietary', 'supplies'], { desc: 'Shortlist two suppliers for nut-free and gluten-free snacks. Ask each for ingredient lists and delivery times.' }),
    spec(P, 2, 'Cabin assignments for week one', 'high', hannah, -3, 3, ['cabins'], { subs: [['Group by age and friend requests', true], ['Check medical and dietary notes', false], ['Share with counsellors', false]] }),
    spec(P, 2, 'Archery safety briefing and curriculum', 'medium', sam, -2, 5, ['archery', 'training']),
    spec(P, 3, 'Rainy-day activity plan', 'medium', sam, -6, -2, ['planning']),
    doneSpec(P, 'Canoe and kayak fleet inspection', 'medium', tom, -10, ['waterfront', 'inspection'], 12),
  ];
};

const offSeason = (): TaskSpec[] => {
  const O = PROJECT.offSeason;
  return [
    spec(O, 1, 'Plan staff reunion weekend', 'medium', rosa, null, 10, ['events']),
    spec(O, 2, 'Collect camp song book ideas', 'low', rosa, -2, 14, ['idea']),
    doneSpec(O, 'Renew first-aid instructor certificate', 'low', rosa, -5, ['admin'], 7),
  ];
};

export const campTasks = (): TaskSpec[] => [...facilities(), ...staffing(), ...comms(), ...programme(), ...offSeason()];
