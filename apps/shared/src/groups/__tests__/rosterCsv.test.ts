import { describe, expect, it } from 'vitest';
import type { Roster } from '@buxa/domain';
import { ROSTER_CSV_HEADER, rosterCsv, rosterFileName } from '../rosterCsv';

function rosterOf(names: { group?: string; room?: string; name: string; role?: 'camper' | 'staff' }[]): Roster {
  const groups = new Map<string, Roster['groups'][number]>();
  for (const entry of names) {
    const groupName = entry.group ?? 'Hawks';
    const roomName = entry.room ?? 'Cabin 1';
    const group = groups.get(groupName) ?? { id: `g-${groupName}`, name: groupName, rooms: [] };
    groups.set(groupName, group);
    let room = group.rooms.find(r => r.name === roomName);
    if (!room) {
      room = { id: `r-${roomName}`, name: roomName, members: [] };
      group.rooms.push(room);
    }
    room.members.push({ personId: `p-${entry.name}`, name: entry.name, role: entry.role ?? 'camper' });
  }

  return { groups: [...groups.values()] };
}

describe('rosterCsv', () => {
  it('writes the header, then one CRLF row per person with group, room, name and role', () => {
    const csv = rosterCsv(rosterOf([{ name: 'Ada Lovelace' }, { name: 'Mo Staff', role: 'staff', room: 'Lodge 2' }]));

    expect(ROSTER_CSV_HEADER).toEqual(['Group', 'Room', 'Name', 'Role']);
    expect(csv).toBe('Group,Room,Name,Role\r\nHawks,Cabin 1,Ada Lovelace,Camper\r\nHawks,Lodge 2,Mo Staff,Staff\r\n');
  });

  it('writes only the header for an empty roster', () => {
    expect(rosterCsv({ groups: [] })).toBe('Group,Room,Name,Role\r\n');
  });

  it('quotes a name with a comma, a quote or a line break, doubling inner quotes', () => {
    const csv = rosterCsv(rosterOf([{ name: 'Lee, "Sam"\nJr' }]));

    expect(csv).toContain('Hawks,Cabin 1,"Lee, ""Sam""\nJr",Camper\r\n');
  });

  it('prefixes a formula-looking name with an apostrophe so a spreadsheet reads it as text', () => {
    const names = ['=HYPERLINK("https://evil.example")', '+1 555 0100', '-Ada', '@SUM(A1)', '\tTabbed', '\rReturned'];
    const csv = rosterCsv(rosterOf(names.map(name => ({ name }))));
    const rows = csv.split('\r\n');

    expect(rows[1]).toContain(`,"'=HYPERLINK(""https://evil.example"")",Camper`);
    expect(rows[2]).toContain(",'+1 555 0100,Camper");
    expect(rows[3]).toContain(",'-Ada,Camper");
    expect(rows[4]).toContain(",'@SUM(A1),Camper");
    expect(csv).toContain(",'\tTabbed,Camper");
    expect(csv).toContain(',"\'\rReturned",Camper');
  });

  it('neutralises a formula-looking group or room name too, not only a person', () => {
    const csv = rosterCsv(rosterOf([{ name: 'Ada', group: '=cmd', room: '@room' }]));

    expect(csv).toContain("'=cmd,'@room,Ada,Camper");
  });

  it('leaves ordinary text, digits and mid-text symbols untouched', () => {
    const csv = rosterCsv(rosterOf([{ name: "O'Brien-Smith 3rd" }]));

    expect(csv).toContain("Hawks,Cabin 1,O'Brien-Smith 3rd,Camper");
  });
});

describe('rosterFileName', () => {
  it('names the download after the session in lowercase dashes', () => {
    expect(rosterFileName('Summer 1 (Ages 6-8)')).toBe('roster-summer-1-ages-6-8.csv');
  });

  it('falls back when the session name has no letters or digits to use', () => {
    expect(rosterFileName('!!!')).toBe('roster-session.csv');
  });
});
