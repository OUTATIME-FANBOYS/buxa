import type { Column, Project } from '../../types';
import { addDays, iso, today } from '../dates';
import { uid } from '../tasks';
import { PROJECT, PROJECT_NAME, WORKSPACE } from './ids';

const COLUMN_SPEC: [name: string, kind: Column['kind']][] = [
  ['Backlog', 'open'], ['To Do', 'open'], ['In Progress', 'active'], ['In Review', 'active'], ['Done', 'done'],
];

/** The five default columns. The seed passes fixed ids so its output is the same on every run; the app uses random ids. */
export const defaultColumns = (newId: (slot: number) => string = () => uid()): Column[] =>
  COLUMN_SPEC.map(([name, kind], slot) => ({ id: newId(slot), name, kind }));

const mk = (id: string, workspaceId: string, name: string, description: string, deadlineInDays: number): Project => ({
  id, workspaceId, name, description, deadline: addDays(today(), deadlineInDays), columns: defaultColumns(slot => `${id}-col-${slot}`), createdAt: iso(-45),
});

export const buildProjects = (): Project[] => [
  mk(PROJECT.registration, WORKSPACE.camp, PROJECT_NAME.registration, 'Open registration for next summer: session dates, fees, the family form, waivers and payment plans.', 24),
  mk(PROJECT.facilities, WORKSPACE.camp, PROJECT_NAME.facilities, 'Get the grounds, waterfront and cabins safe and ready before the first campers arrive.', 52),
  mk(PROJECT.staffing, WORKSPACE.camp, PROJECT_NAME.staffing, 'Recruit, certify and train counsellors, lifeguards and kitchen staff.', 15),
  mk(PROJECT.comms, WORKSPACE.camp, PROJECT_NAME.comms, 'Everything families hear from us before and during camp: emails, FAQs, packing lists and transport.', 40),
  mk(PROJECT.programme, WORKSPACE.camp, PROJECT_NAME.programme, 'Weekly activity schedules, supplies and instructors for arts, water sports, archery and evening events.', 60),
];
