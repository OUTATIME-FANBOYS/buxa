import { describe, expect, it } from 'vitest';
import { buildRoster, type RosterPlacementSource } from './roster';

const GROUPS = [
  { id: 'g-hawks', name: 'Hawks' },
  { id: 'g-bears', name: 'Bears' },
  { id: 'g-empty', name: 'Empty group' },
];
const ROOMS = [
  { id: 'r-lodge', name: 'Lodge 2' },
  { id: 'r-cabin', name: 'Cabin 10' },
  { id: 'r-field', name: 'Field' },
];

function placed(
  personId: string,
  personName: string,
  groupId: string,
  roomId: string,
  role: RosterPlacementSource['role'] = 'camper',
) {
  return { personId, personName, role, groupId, roomId } satisfies RosterPlacementSource;
}

describe('buildRoster', () => {
  it('sorts groups by name, rooms by name within a group, and members by name', () => {
    const roster = buildRoster(GROUPS, ROOMS, [
      placed('p3', 'Zoe Ng', 'g-hawks', 'r-lodge'),
      placed('p1', 'Ada Lovelace', 'g-bears', 'r-field'),
      placed('p2', 'Grace Hopper', 'g-hawks', 'r-cabin'),
      placed('p4', 'Alan Turing', 'g-hawks', 'r-lodge'),
      placed('p5', 'Ada Byron', 'g-hawks', 'r-lodge'),
    ]);

    expect(roster.groups.map(g => g.name)).toEqual(['Bears', 'Hawks']);
    const hawks = roster.groups[1];
    expect(hawks?.rooms.map(r => r.name)).toEqual(['Cabin 10', 'Lodge 2']);
    expect(hawks?.rooms[1]?.members.map(m => m.name)).toEqual(['Ada Byron', 'Alan Turing', 'Zoe Ng']);
  });

  it('orders numbered room names naturally, so Cabin 2 comes before Cabin 10', () => {
    const roster = buildRoster(
      [{ id: 'g', name: 'Hawks' }],
      [
        { id: 'r10', name: 'Cabin 10' },
        { id: 'r2', name: 'Cabin 2' },
      ],
      [placed('p1', 'Ada', 'g', 'r10'), placed('p2', 'Ben', 'g', 'r2')],
    );

    expect(roster.groups[0]?.rooms.map(r => r.name)).toEqual(['Cabin 2', 'Cabin 10']);
  });

  it('keeps two people with the same name in a stable order, by id', () => {
    const roster = buildRoster(
      [{ id: 'g', name: 'Hawks' }],
      [{ id: 'r', name: 'Lodge' }],
      [placed('p-b', 'Sam Lee', 'g', 'r'), placed('p-a', 'Sam Lee', 'g', 'r')],
    );

    expect(roster.groups[0]?.rooms[0]?.members.map(m => m.personId)).toEqual(['p-a', 'p-b']);
  });

  it('leaves out groups and rooms with nobody placed in them', () => {
    const roster = buildRoster(GROUPS, ROOMS, [placed('p1', 'Ada', 'g-hawks', 'r-cabin')]);

    expect(roster.groups.map(g => g.name)).toEqual(['Hawks']);
    expect(roster.groups[0]?.rooms.map(r => r.name)).toEqual(['Cabin 10']);
  });

  it('skips a placement that names a group or room outside the session', () => {
    const roster = buildRoster(GROUPS, ROOMS, [
      placed('p1', 'Ada', 'g-missing', 'r-cabin'),
      placed('p2', 'Ben', 'g-hawks', 'r-missing'),
    ]);

    expect(roster).toEqual({ groups: [] });
  });

  it('keeps the role of each member and returns an empty roster for no placements', () => {
    const roster = buildRoster(GROUPS, ROOMS, [placed('p1', 'Mo Staff', 'g-bears', 'r-field', 'staff')]);

    expect(roster.groups[0]?.rooms[0]?.members).toEqual([{ personId: 'p1', name: 'Mo Staff', role: 'staff' }]);
    expect(buildRoster(GROUPS, ROOMS, [])).toEqual({ groups: [] });
  });
});
