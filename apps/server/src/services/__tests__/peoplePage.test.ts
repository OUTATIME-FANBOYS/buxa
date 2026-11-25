import { describe, expect, it } from 'vitest';
import type { NewPersonInput } from '@buxa/contracts';
import { personPageFilter } from '../people/personPageFilter';
import { createCamp, type Camp } from './support';

type Role = NewPersonInput['roles'][number];

/** Adds `count` people with one first name and role. Family names count up, so the list order is the creation order. */
async function seed(camp: Camp, count: number, givenName = 'Pat', roles: Role[] = ['participant']) {
  const admin = camp.actor('admin');
  for (let i = 0; i < count; i++) {
    await camp.people.create(admin, { givenName, familyName: `Name${String(i).padStart(3, '0')}`, roles });
  }
}

describe('PeopleService.listPage', () => {
  it('returns 25 people on the first page by default, with the total across every page', async () => {
    const camp = await createCamp();
    await seed(camp, 30);
    const first = await camp.people.listPage(camp.actor('viewer'));
    expect(first).toMatchObject({ page: 1, pageSize: 25, pageCount: 2, total: 30, from: 1, to: 25 });
    expect(first.people).toHaveLength(25);
    expect(first.people[0]?.familyName).toBe('Name000');

    const second = await camp.people.listPage(camp.actor('viewer'), { page: 2 });
    expect(second).toMatchObject({ page: 2, total: 30, from: 26, to: 30 });
    expect(second.people.map(p => p.familyName)).toEqual(['Name025', 'Name026', 'Name027', 'Name028', 'Name029']);
  });

  it('caps the page size at 100', async () => {
    const camp = await createCamp();
    await seed(camp, 101);
    const page = await camp.people.listPage(camp.actor('viewer'), { pageSize: 1000 });
    expect(page).toMatchObject({ pageSize: 100, pageCount: 2, total: 101, to: 100 });
    expect(page.people).toHaveLength(100);
  });

  it('counts the role filter before paging, so the total is the filtered number', async () => {
    const camp = await createCamp();
    await seed(camp, 30);
    await seed(camp, 4, 'Gail', ['guardian']);
    const page = await camp.people.listPage(camp.actor('viewer'), { role: 'guardian', pageSize: 2, page: 2 });
    expect(page).toMatchObject({ page: 2, pageCount: 2, total: 4, from: 3, to: 4 });
    expect(page.people.map(p => p.givenName)).toEqual(['Gail', 'Gail']);
  });

  it('counts every name match, not only the first few the type-ahead search returns', async () => {
    const camp = await createCamp();
    await seed(camp, 30, 'Kim');
    await seed(camp, 5, 'Ben');
    const page = await camp.people.listPage(camp.actor('viewer'), { query: 'kim' });
    expect(page).toMatchObject({ total: 30, pageCount: 2 });
    expect(page.people).toHaveLength(25);
  });

  it('holds a page past the end at the last page', async () => {
    const camp = await createCamp();
    await seed(camp, 30);
    const page = await camp.people.listPage(camp.actor('viewer'), { page: 99 });
    expect(page).toMatchObject({ page: 2, from: 26, to: 30 });
    expect(page.people).toHaveLength(5);
  });

  it('shows one empty page when nobody matches', async () => {
    const camp = await createCamp();
    expect(await camp.people.listPage(camp.actor('viewer'))).toMatchObject({
      people: [],
      total: 0,
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
    });
  });
});

describe('personPageFilter', () => {
  it('trims the search and leaves out the role when none is given', () => {
    expect(personPageFilter({ query: '  Kim ' }, null)).toEqual({ term: 'Kim' });
    expect(personPageFilter({}, null)).toEqual({ term: '' });
  });

  it('carries the role, and keeps only a teacher’s campers when there is a scope', () => {
    const scope = {
      classIds: new Set<string>(),
      camperIds: new Set(['p-1', 'p-2']),
      teaching: { sessionIds: new Set<string>(), seriesIds: new Set<string>() },
    };
    expect(personPageFilter({ role: 'camper', query: 'Lee' }, scope)).toEqual({
      term: 'Lee',
      role: 'camper',
      ids: ['p-1', 'p-2'],
    });
  });
});
