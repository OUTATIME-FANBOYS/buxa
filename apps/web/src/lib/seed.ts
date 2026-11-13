import type { AppState, Column, Priority, Task, Workspace, Project, User, ActivityItem, Notice } from '../types';
import { addDays, iso, today } from './dates';
import { uid } from './tasks';

export const DEMO_PASSWORD = 'demo1234';
export const AGENT_ID = 'u-agent-triage';

export const defaultColumns = (): Column[] => [
  { id: uid(), name: 'Backlog', kind: 'open' },
  { id: uid(), name: 'To Do', kind: 'open' },
  { id: uid(), name: 'In Progress', kind: 'active' },
  { id: uid(), name: 'In Review', kind: 'active' },
  { id: uid(), name: 'Done', kind: 'done' },
];

export function buildSeed(): AppState {
  const users: User[] = [
    { id: 'u-maya', name: 'Maya Chen', email: 'maya@northwind.studio', title: 'Design lead' },
    { id: 'u-dan', name: 'Daniel Okafor', email: 'daniel@northwind.studio', title: 'Engineering' },
    { id: 'u-priya', name: 'Priya Raman', email: 'priya@northwind.studio', title: 'Product manager' },
    { id: 'u-lucas', name: 'Lucas Meyer', email: 'lucas@northwind.studio', title: 'Content & SEO' },
    { id: 'u-sofia', name: 'Sofia Alvarez', email: 'sofia@northwind.studio', title: 'Brand' },
    { id: AGENT_ID, name: 'Triage Agent', email: 'triage@agents.local', title: 'Claude', agent: true },
  ];
  const workspaces: Workspace[] = [
    { id: 'w-nw', name: 'Northwind Studio', members: [
      { userId: 'u-maya', role: 'owner' }, { userId: 'u-dan', role: 'admin' }, { userId: 'u-priya', role: 'member' },
      { userId: 'u-lucas', role: 'member' }, { userId: 'u-sofia', role: 'member' }, { userId: AGENT_ID, role: 'member' }] },
    { id: 'w-me', name: 'Personal', members: [{ userId: 'u-maya', role: 'owner' }] },
  ];
  const mkProject = (id: string, workspaceId: string, name: string, description: string, deadline: number): Project => ({
    id, workspaceId, name, description, deadline: addDays(today(), deadline), columns: defaultColumns(), createdAt: iso(-45),
  });
  const projects: Project[] = [
    mkProject('p-web', 'w-nw', 'Website Relaunch', 'Rebuild northwind.studio around case studies, with a faster, more accessible front end.', 24),
    mkProject('p-app', 'w-nw', 'Mobile App v2', 'Second release of the client portal app: offline mode, push notifications, new onboarding.', 52),
    mkProject('p-mkt', 'w-nw', 'Q4 Campaign', 'Autumn launch campaign across email, social and the new landing pages.', 15),
    mkProject('p-me', 'w-me', 'Side Projects', 'Small things worth finishing.', 90),
  ];
  const colId = (p: string, i: number) => projects.find(x => x.id === p)!.columns[i].id;
  const tasks: Task[] = [];
  type Opt = { desc?: string; subs?: [string, boolean][]; comments?: [string, string][]; done?: number; created?: number; files?: string[] };
  const T = (p: string, col: number, title: string, priority: Priority, who: string | undefined,
    s: number | null, d: number | null, tags: string[], o: Opt = {}) => {
    const created = o.created ?? -(8 + (tasks.length % 12));
    const t: Task = {
      id: 't-' + (tasks.length + 1), projectId: p, columnId: colId(p, col), title,
      description: o.desc ?? '', priority, assigneeId: who,
      start: s === null ? undefined : addDays(today(), s), due: d === null ? undefined : addDays(today(), d),
      tags, subtasks: (o.subs ?? []).map(([t, done]) => ({ id: uid(), title: t, done })),
      comments: (o.comments ?? []).map(([a, b], i) => ({ id: uid(), authorId: a, body: b, at: iso(-(i + 1), 9 + i) })),
      attachments: (o.files ?? []).map(n => ({ id: uid(), name: n, size: 184000, type: 'application/pdf', at: iso(-2) })),
      history: [{ id: uid(), at: iso(created), actorId: 'u-priya', text: 'created this' }],
      archived: false, createdAt: iso(created), createdBy: 'u-priya',
      completedAt: o.done !== undefined ? iso(o.done, 16) : undefined,
    };
    tasks.push(t);
  };
  const M = 'u-maya', D = 'u-dan', P = 'u-priya', L = 'u-lucas', S = 'u-sofia';
  // Website Relaunch
  T('p-web', 0, 'Localise site into German and French', 'low', L, null, 40, ['content', 'i18n']);
  T('p-web', 0, 'Evaluate headless CMS options', 'medium', P, null, null, ['research'], { desc: 'Compare Sanity, Contentful and Storyblok against editorial workflow, pricing and preview support.' });
  T('p-web', 0, 'Case study template for long-form stories', 'low', M, null, 30, ['design']);
  T('p-web', 1, 'Write homepage hero copy', 'high', S, -1, 3, ['content'], { desc: 'Three options for the headline and supporting line. Keep it under 12 words. Tone: confident, not clever.', comments: [[P, 'Can we test two of these with a handful of clients before we lock it?']] });
  T('p-web', 1, 'Set up analytics events', 'medium', D, null, 6, ['engineering', 'analytics']);
  T('p-web', 1, 'Audit existing URLs for redirects', 'high', P, null, 2, ['seo', 'engineering'], { subs: [['Export current sitemap', true], ['Map old URLs to new', false], ['Review with Lucas', false]] });
  T('p-web', 1, 'Define cookie consent flow', 'medium', L, null, 9, ['legal']);
  T('p-web', 2, 'Design system tokens and components', 'critical', M, -8, 2, ['design'], {
    desc: 'Colour, type, spacing and the first twelve components. Everything engineering needs to start building the templates.',
    subs: [['Colour and type tokens', true], ['Buttons and inputs', true], ['Cards and lists', true], ['Navigation', true], ['Forms and validation', false], ['Documentation site', false]],
    comments: [[D, 'Tokens look great. Can we export them as CSS variables and JSON?'], [M, 'Yes, shipping both this afternoon.']], files: ['tokens-v3.pdf'] });
  T('p-web', 2, 'Build pricing page', 'high', D, -4, 1, ['engineering'], { subs: [['Layout', true], ['Plan comparison table', false], ['FAQ accordion', false]] });
  T('p-web', 2, 'Photography shortlist for About page', 'low', S, -3, 5, ['brand']);
  T('p-web', 2, 'Migrate blog posts', 'medium', L, -6, -1, ['content', 'engineering'], { desc: '48 posts. Check images, internal links and canonical tags after import.', subs: [['Import script', true], ['Fix broken images', false], ['QA internal links', false]] });
  T('p-web', 3, 'Navigation redesign', 'high', M, -10, -2, ['design'], { comments: [[P, 'Mobile menu feels heavy. Can we try a bottom sheet?'], [M, 'On it, will post a prototype tomorrow.']], files: ['nav-prototype.pdf'] });
  T('p-web', 3, 'Contact form accessibility pass', 'critical', P, -2, 0, ['accessibility'], { subs: [['Keyboard order', true], ['Error announcements', false], ['Colour contrast', true]] });
  T('p-web', 3, 'Performance budget for Core Web Vitals', 'medium', D, -2, 2, ['engineering']);
  [['Competitive audit', 'medium', S, -20], ['Information architecture sitemap', 'high', M, -15], ['Brand colour and type decisions', 'high', M, -12],
   ['Set up staging environment', 'medium', D, -10], ['Stakeholder interviews', 'medium', P, -17], ['Content inventory', 'low', L, -9],
   ['Wireframes for key templates', 'high', M, -6], ['Choose hosting provider', 'low', D, -4], ['Kick-off workshop', 'low', P, -26]]
    .forEach(([t, p, w, c], i) => T('p-web', 4, t as string, p as Priority, w as string, (c as number) - 6, (c as number) + 1, i % 2 ? ['planning'] : ['research'], { created: (c as number) - 5 - (i % 3), done: c as number }));
  // Mobile App v2
  T('p-app', 0, 'Biometric sign-in', 'medium', D, null, 35, ['security']);
  T('p-app', 0, 'Dark theme for all screens', 'low', M, null, null, ['design']);
  T('p-app', 1, 'Offline cache for project list', 'high', D, null, 8, ['engineering'], { subs: [['Storage layer', false], ['Conflict rules', false]] });
  T('p-app', 1, 'Push notification copy', 'low', S, null, 12, ['content']);
  T('p-app', 2, 'New onboarding flow', 'critical', M, -5, 3, ['design', 'ux'], { subs: [['Welcome screens', true], ['Permission prompts', false], ['First project setup', false]], comments: [[P, 'Let’s keep it to three screens max.']] });
  T('p-app', 2, 'Crash reporting integration', 'medium', D, -2, 4, ['engineering']);
  T('p-app', 3, 'Settings screen rebuild', 'medium', M, -9, -3, ['design']);
  T('p-app', 4, 'API v2 contract', 'high', D, -24, -12, ['engineering'], { created: -30, done: -14 });
  T('p-app', 4, 'Usability tests round 1', 'medium', P, -20, -8, ['research'], { created: -28, done: -9 });
  T('p-app', 4, 'App icon refresh', 'low', S, -14, -6, ['brand'], { created: -18, done: -7 });
  // Q4 Campaign
  T('p-mkt', 0, 'Partner webinar outline', 'low', P, null, 25, ['events']);
  T('p-mkt', 1, 'Email sequence: three-part launch', 'high', L, null, 5, ['email', 'content']);
  T('p-mkt', 1, 'Social asset kit', 'medium', S, null, 7, ['brand']);
  T('p-mkt', 2, 'Landing page copy', 'critical', S, -3, 0, ['content'], { subs: [['Hero', true], ['Proof section', false], ['CTA variants', false]] });
  T('p-mkt', 2, 'Campaign budget sign-off', 'high', P, -4, -1, ['planning'], { comments: [[M, 'Finance wants the split by channel.']] });
  T('p-mkt', 3, 'Launch video storyboard', 'medium', M, -7, 1, ['video']);
  T('p-mkt', 4, 'Audience research summary', 'medium', P, -18, -10, ['research'], { created: -24, done: -11 });
  T('p-mkt', 4, 'Campaign naming', 'low', S, -12, -8, ['brand'], { created: -16, done: -8 });
  // Personal
  T('p-me', 1, 'Finish portfolio case study', 'medium', M, null, 10, ['writing']);
  T('p-me', 2, 'Sketch plant-watering reminder app', 'low', M, -2, 14, ['idea']);
  T('p-me', 4, 'Renew domain names', 'low', M, -10, -5, ['admin'], { created: -12, done: -5 });

  const activity: ActivityItem[] = [
    ['u-dan', 'moved', 'Contact form accessibility pass', 't-13', 'to In Review', -0.1],
    ['u-sofia', 'commented on', 'Write homepage hero copy', 't-4', '', -0.5],
    ['u-maya', 'completed', 'Wireframes for key templates', 't-' + (tasks.findIndex(t => t.title.startsWith('Wireframes')) + 1), '', -6],
    ['u-priya', 'assigned', 'Audit existing URLs for redirects', 't-6', 'to Priya Raman', -1],
    ['u-lucas', 'moved', 'Migrate blog posts', 't-11', 'to In Progress', -2],
    ['u-dan', 'completed', 'Choose hosting provider', 't-' + (tasks.findIndex(t => t.title.startsWith('Choose')) + 1), '', -4],
    ['u-maya', 'attached a file to', 'Navigation redesign', 't-12', '“nav-prototype.pdf”', -2],
    ['u-priya', 'created', 'Campaign budget sign-off', 't-' + (tasks.findIndex(t => t.title.startsWith('Campaign budget')) + 1), '', -3],
  ].map(([a, v, title, id, d, off]) => ({ id: uid(), at: new Date(Date.now() + (off as number) * 86400000).toISOString(), actorId: a as string, verb: v as string, taskTitle: title as string, taskId: id as string, detail: d as string, projectId: tasks.find(t => t.id === id)?.projectId ?? 'p-web' }));

  const notices: Notice[] = [
    { id: uid(), userId: M, at: iso(0, 8), kind: 'mention', text: 'Daniel Okafor mentioned you in “Design system tokens and components”', taskId: 't-8', projectId: 'p-web', read: false },
    { id: uid(), userId: M, at: iso(-1, 15), kind: 'assign', text: 'Priya Raman assigned you “Settings screen rebuild”', taskId: 't-' + (tasks.findIndex(t => t.title.startsWith('Settings screen')) + 1), projectId: 'p-app', read: false },
    { id: uid(), userId: M, at: iso(-2, 11), kind: 'comment', text: 'Priya Raman commented on “Navigation redesign”', taskId: 't-12', projectId: 'p-web', read: true },
    { id: uid(), userId: M, at: iso(-3, 9), kind: 'complete', text: 'Daniel Okafor completed “Choose hosting provider”', projectId: 'p-web', read: true },
    { id: uid(), userId: D, at: iso(-1, 10), kind: 'assign', text: 'Maya Chen assigned you “Build pricing page”', taskId: 't-9', projectId: 'p-web', read: false },
    { id: uid(), userId: P, at: iso(-1, 14), kind: 'status', text: 'Maya Chen moved “Navigation redesign” to In Review', taskId: 't-12', projectId: 'p-web', read: false },
  ];

  return {
    version: 1, users,
    accounts: users.filter(u => !u.agent).map(u => ({ email: u.email, hash: '', userId: u.id, demo: true })),
    workspaces, projects, tasks, activity, notices, savedFilters: [],
    agents: [{ userId: AGENT_ID, workspaceId: 'w-nw', model: 'Claude', purpose: 'Reads each project, flags unowned or overdue work, and proposes follow-ups.', scope: ['p-web', 'p-app', 'p-mkt'],
      trust: { create_task: 'auto', comment: 'auto', update_task: 'approve', move_task: 'approve', complete_task: 'approve' }, paused: false, moveRules: {}, approves: [] }],
    runs: [], proposals: [],
    session: { userId: null },
    ui: { workspaceId: 'w-nw', projectId: 'p-web', view: 'board', theme: 'system', sidebarCollapsed: false, agentsEnabled: true },
  };
}
