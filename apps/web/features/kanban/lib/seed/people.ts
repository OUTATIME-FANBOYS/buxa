import type { User, Workspace } from '../../types';
import { AGENT_ID, USER, WORKSPACE } from './ids';

/** Fictional staff. Emails use the reserved example.com domain only. */
export const buildUsers = (): User[] => [
  { id: USER.rosa, name: 'Rosa Delgado', email: 'rosa@example.com', title: 'Camp director' },
  { id: USER.tom, name: 'Tom Achebe', email: 'tom@example.com', title: 'Operations manager' },
  { id: USER.hannah, name: 'Hannah Lindqvist', email: 'hannah@example.com', title: 'Registrar' },
  { id: USER.sam, name: 'Sam Whitfield', email: 'sam@example.com', title: 'Activities lead' },
  { id: USER.nia, name: 'Nia Okoye', email: 'nia@example.com', title: 'Parent communications' },
  { id: AGENT_ID, name: 'Triage Agent', email: 'triage@agents.local', title: 'Claude', agent: true },
];

export const buildWorkspaces = (): Workspace[] => [
  { id: WORKSPACE.camp, name: 'Camp Birchwood', members: [
    { userId: USER.rosa, role: 'owner' }, { userId: USER.tom, role: 'admin' }, { userId: USER.hannah, role: 'member' },
    { userId: USER.sam, role: 'member' }, { userId: USER.nia, role: 'member' }, { userId: AGENT_ID, role: 'member' }] },
  { id: WORKSPACE.personal, name: 'Personal', members: [{ userId: USER.rosa, role: 'owner' }] },
];
