import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CampHome } from '@buxa/server/composers/index.server';
import type { Task } from '@buxa/shared';
import {
  HomeStats,
  MembershipPanel,
  OnSiteAgePanel,
  UpcomingSessionsPanel,
  YourTasksPanel,
} from '@/components/components/kanban/home';

Object.assign(globalThis, { React });

const camp: CampHome = {
  campId: 'o1',
  name: 'Lake Camp',
  firstName: 'Priya',
  canRename: false,
  people: 40,
  onSite: 12,
  checkedInToday: 20,
  validMemberships: 30,
  upcomingSessions: [],
  checkInsByDay: {
    days: [
      { date: '2026-11-16', count: 5, minors: 1 },
      { date: '2026-11-17', count: 20, minors: 2 },
    ],
    complete: true,
  },
  onSiteByAge: { adults: 10, minors: 2 },
  membershipStatus: { valid: 30, notStarted: 0, expired: 6, none: 4 },
};
const task = (id: string, title: string): Task => ({
  id,
  projectId: 'p1',
  columnId: 'c1',
  title,
  description: '',
  priority: 'medium',
  subtasks: [],
  comments: [],
  attachments: [],
  history: [],
  archived: false,
  createdAt: '2026-11-01T00:00:00Z',
  createdBy: 'u1',
});

describe('OnSiteAgePanel', () => {
  it('shows parents and guardians, and students, on site, with their numbers as text', () => {
    const html = renderToStaticMarkup(<OnSiteAgePanel counts={{ adults: 10, minors: 2 }} />);
    expect(html).toContain('On site: Parent/Guardians and Students');
    expect(html).toContain('Parent/Guardians');
    expect(html).toContain('Students');
    expect(html).not.toContain('Adults');
    expect(html).not.toContain('Minors');
    expect(html).toContain('<ul class="hbars" aria-label="On site now, by age group">');
    expect(html).toContain('<span class="hb-label">Parent/Guardians</span>');
    expect(html).toContain('<span class="hb-label">Students</span>');
    expect(html).toContain('<span class="hb-val">10</span>');
    expect(html).toContain('<span class="hb-val">2</span>');
    expect(html).toContain('<span class="hb-seg seg-brand" style="width:100%"></span>');
    expect(html).toContain('<span class="hb-seg seg-brand" style="width:20%"></span>');
    expect(html).toContain('href="/camp/on-site"');
  });

  it('says nobody is on site when both groups are zero', () => {
    expect(renderToStaticMarkup(<OnSiteAgePanel counts={{ adults: 0, minors: 0 }} />)).toContain(
      'Nobody is checked in right now.',
    );
  });

  it('says age groups are not shown, with no link, when the viewer may not see them', () => {
    const html = renderToStaticMarkup(<OnSiteAgePanel counts={null} />);
    expect(html).toContain('Age groups are not shown for your role.');
    expect(html).not.toContain('/camp/on-site');
  });
});

describe('MembershipPanel', () => {
  it('lists every status with its count and share, in words', () => {
    const html = renderToStaticMarkup(<MembershipPanel counts={{ valid: 30, notStarted: 0, expired: 6, none: 4 }} />);
    expect(html).toContain('Valid</span>');
    expect(html).toContain('>30 <span');
    expect(html).toContain('(75%)');
    expect(html).toContain('(15%)');
    expect(html).toContain('Expired');
    expect(html).toContain('None (includes revoked)');
    expect(html).not.toContain('Not started');
  });

  it('draws the valid share on the shared Ring, at the Reports size, with the summary for screen readers', () => {
    const html = renderToStaticMarkup(<MembershipPanel counts={{ valid: 3, notStarted: 0, expired: 1, none: 0 }} />);
    expect(html).toContain('class="ring"');
    expect(html).toContain('aria-label="Membership status for 4 people: 3 valid, 1 expired."');
    expect(html).toContain('<span class="stat-num">75%</span>');
    expect(html).toContain('<span class="muted small">valid</span>');
    // Valid is three quarters of the ring, drawn from the top with round ends at the Reports stroke width of 8 on a 96px ring.
    const c = 2 * Math.PI * ((96 - 8) / 2);
    expect(html).toContain(`stroke-dasharray="${0.75 * c} ${c}"`);
    expect(html).toContain('stroke="var(--f-ok)"');
    expect(html).toContain('stroke-linecap="round"');
  });

  it('keeps the legend counts beside the ring', () => {
    const html = renderToStaticMarkup(<MembershipPanel counts={{ valid: 3, notStarted: 0, expired: 1, none: 0 }} />);
    expect(html).toContain('aria-label="Membership status, by count"');
    expect(html).toContain('>3 <span');
    expect(html).toContain('(75%)');
    expect(html).toContain('(25%)');
  });

  it('says so when nobody is on the list yet', () => {
    expect(
      renderToStaticMarkup(<MembershipPanel counts={{ valid: 0, notStarted: 0, expired: 0, none: 0 }} />),
    ).toContain('No people are on the camp list yet.');
  });

  it('says memberships are not shown, with no ring, when the viewer may not see them', () => {
    const html = renderToStaticMarkup(<MembershipPanel counts={null} />);
    expect(html).toContain('Memberships are not shown for your role.');
    expect(html).not.toContain('role="img"');
  });
});

describe('UpcomingSessionsPanel', () => {
  it('lists each session in a table with its class, time and place, and a See all link to Classes', () => {
    const html = renderToStaticMarkup(
      <UpcomingSessionsPanel
        sessions={[{ id: 's1', className: 'Archery', startsAt: '2026-11-20T09:00:00Z', location: 'Range 2' }]}
      />,
    );
    expect(html).toContain('<table');
    expect(html).toContain('<th scope="col">Class</th>');
    expect(html).toContain('Archery');
    expect(html).toContain('Range 2');
    expect(html).toContain('See all');
    expect(html).toContain('href="/camp/sessions"');
  });

  it('says so when no sessions are scheduled, and still offers See all', () => {
    const html = renderToStaticMarkup(<UpcomingSessionsPanel sessions={[]} />);
    expect(html).toContain('No upcoming classes are scheduled.');
    expect(html).not.toContain('<table');
  });

  it('says classes are not shown when the viewer may not read them, with no link', () => {
    const html = renderToStaticMarkup(<UpcomingSessionsPanel sessions={null} />);
    expect(html).toContain('Classes are not shown for your role.');
    expect(html).not.toContain('See all');
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
  it('renders one stats row with a card per camp fact, each with its info and change chip', () => {
    const html = renderToStaticMarkup(<HomeStats camp={camp} />);
    expect(html.match(/class="stat tone-/g)?.length).toBe(3);
    expect(html).toContain('stats-home');
    expect(html).toContain('+15 vs yesterday');
    expect(html).toContain('stat-label');
  });
});
