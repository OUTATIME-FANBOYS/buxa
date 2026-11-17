import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CampHome } from '@buxa/server/composers/index.server';
import type { Task } from '@buxa/shared';
import { HomeStats, OnSitePanel, UpcomingClassesPanel, YourTasksPanel } from '@/components/components/kanban/home/export';

Object.assign(globalThis, { React });

const camp: CampHome = {
  campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false,
  people: 40, onSite: 12, checkedInToday: 20, validMemberships: 35, upcomingSessions: [],
};
const task = (id: string, title: string): Task => ({
  id, projectId: 'p1', columnId: 'c1', title, description: '', priority: 'medium', tags: [], subtasks: [], comments: [],
  attachments: [], history: [], archived: false, createdAt: '2026-11-01T00:00:00Z', createdBy: 'u1',
});

describe('OnSitePanel', () => {
  it('shows the count with a link to On site', () => {
    const html = renderToStaticMarkup(<OnSitePanel count={12} />);
    expect(html).toContain('On site now');
    expect(html).toContain('12</span> people checked in');
    expect(html).toContain('href="/camp/on-site"');
  });

  it('uses the singular for one person', () => {
    expect(renderToStaticMarkup(<OnSitePanel count={1} />)).toContain('person checked in');
  });

  it('says attendance is not shown, with no link, when the viewer may not read it', () => {
    const html = renderToStaticMarkup(<OnSitePanel count={null} />);
    expect(html).toContain('Attendance is not shown for your role.');
    expect(html).not.toContain('/camp/on-site');
  });
});

describe('UpcomingClassesPanel', () => {
  it('lists each session with its class, time and place', () => {
    const html = renderToStaticMarkup(<UpcomingClassesPanel sessions={[{ id: 's1', className: 'Archery', startsAt: '2026-11-20T09:00:00Z', location: 'Range 2' }]} />);
    expect(html).toContain('Archery');
    expect(html).toContain('Range 2');
    expect(html).toContain('href="/camp/classes"');
  });

  it('says so when no sessions are scheduled', () => {
    expect(renderToStaticMarkup(<UpcomingClassesPanel sessions={[]} />)).toContain('No upcoming classes are scheduled.');
  });

  it('says classes are not shown when the viewer may not read them', () => {
    expect(renderToStaticMarkup(<UpcomingClassesPanel sessions={null} />)).toContain('Classes are not shown for your role.');
  });
});

describe('YourTasksPanel', () => {
  it('lists the tasks given and says the tasks are kept in this browser', () => {
    const html = renderToStaticMarkup(<YourTasksPanel tasks={[task('t1', 'Restock first aid')]} />);
    expect(html).toContain('Restock first aid');
    expect(html).toContain('kept in this browser');
  });

  it('says so when nothing is assigned', () => {
    expect(renderToStaticMarkup(<YourTasksPanel tasks={[]} />)).toContain('No tasks are assigned to you.');
  });
});

describe('HomeStats', () => {
  it('renders one stats row with a card per camp fact', () => {
    const html = renderToStaticMarkup(<HomeStats camp={camp} />);
    expect(html.match(/class="stat tone-/g)?.length).toBe(4);
    expect(html).toContain('stats-home');
  });
});
