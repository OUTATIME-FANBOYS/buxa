import type { ActivityItem, Notice, Task } from '../../types';
import { iso } from '../dates';
import { uid } from '../tasks';
import { PROJECT, TASK_TITLE, USER } from './ids';

const DAY = 86400000;

/** Looks a seeded task up by title; the seed lists are written together, so a miss is a programming error. */
function find(tasks: Task[], title: string): Task {
  const task = tasks.find(t => t.title === title);
  if (!task) throw new Error(`Seed refers to an unknown task: ${title}`);
  return task;
}

export function buildActivity(tasks: Task[]): ActivityItem[] {
  const row = (actorId: string, verb: string, title: string, detail: string, daysAgo: number): ActivityItem => {
    const task = find(tasks, title);
    return { id: uid(), at: new Date(Date.now() + daysAgo * DAY).toISOString(), actorId, verb, taskTitle: title, taskId: task.id, detail, projectId: task.projectId };
  };
  return [
    row(USER.tom, 'moved', TASK_TITLE.allergySection, 'to In Review', -0.1),
    row(USER.nia, 'commented on', TASK_TITLE.welcomeEmail, '', -0.5),
    row(USER.rosa, 'completed', TASK_TITLE.formLayout, '', -6),
    row(USER.hannah, 'assigned', TASK_TITLE.waivers, 'to Hannah Lindqvist', -1),
    row(USER.sam, 'moved', TASK_TITLE.importRecords, 'to In Progress', -2),
    row(USER.tom, 'completed', TASK_TITLE.paymentProvider, '', -4),
    row(USER.rosa, 'attached a file to', TASK_TITLE.formQuestions, '“registration-form-draft.pdf”', -2),
    row(USER.hannah, 'created', TASK_TITLE.trainingBudget, '', -3),
  ];
}

export function buildNotices(tasks: Task[]): Notice[] {
  const rosa = USER.rosa;
  const link = (title: string) => ({ taskId: find(tasks, title).id, projectId: find(tasks, title).projectId });
  return [
    { id: uid(), userId: rosa, at: iso(0, 8), kind: 'mention', text: 'Tom Achebe mentioned you in “Finalise 2027 session dates and fees”', ...link(TASK_TITLE.sessionDates), read: false },
    { id: uid(), userId: rosa, at: iso(-1, 15), kind: 'assign', text: 'Hannah Lindqvist assigned you “Fire extinguisher and smoke alarm check”', ...link(TASK_TITLE.smokeAlarms), read: false },
    { id: uid(), userId: rosa, at: iso(-2, 11), kind: 'comment', text: 'Hannah Lindqvist commented on “Rewrite registration form questions”', ...link(TASK_TITLE.formQuestions), read: true },
    { id: uid(), userId: rosa, at: iso(-3, 9), kind: 'complete', text: 'Tom Achebe completed “Choose payment provider”', projectId: PROJECT.registration, read: true },
    { id: uid(), userId: USER.tom, at: iso(-1, 10), kind: 'assign', text: 'Rosa Delgado assigned you “Configure deposit and payment plan”', ...link(TASK_TITLE.paymentPlan), read: false },
    { id: uid(), userId: USER.hannah, at: iso(-1, 14), kind: 'status', text: 'Rosa Delgado moved “Rewrite registration form questions” to In Review', ...link(TASK_TITLE.formQuestions), read: false },
  ];
}
