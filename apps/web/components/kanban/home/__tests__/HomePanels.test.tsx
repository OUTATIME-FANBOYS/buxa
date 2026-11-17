import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CampHome } from '@buxa/server/composers/index.server';
import { HomeStats } from '../HomeStats';
import { OnSitePanel } from '../OnSitePanel';
import { StaffTasksPanel } from '../StaffTasksPanel';

Object.assign(globalThis, { React });

const tasks = { total: 4, inProgress: 1, completed: 2, overdue: 1 };
const camp: CampHome = { campId: 'o1', name: 'Lake Camp', firstName: 'Priya', canRename: false, people: 40, onSite: 12, validMemberships: 35 };

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
});

describe('StaffTasksPanel', () => {
  it('summarises the task numbers and links to the boards', () => {
    const html = renderToStaticMarkup(<StaffTasksPanel tasks={tasks} />);
    expect(html).toContain('1 in progress, 2 of 4 done, 1 overdue.');
    expect(html).toContain('Open boards');
    expect(html).toContain('href="/camp/boards"');
  });
});

describe('HomeStats', () => {
  it('renders one stats row with a card per fact', () => {
    const html = renderToStaticMarkup(<HomeStats camp={camp} tasks={tasks} />);
    expect(html.match(/class="stat tone-/g)?.length).toBe(7);
    expect(html).toContain('stats-home');
  });
});
