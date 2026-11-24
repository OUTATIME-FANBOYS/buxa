import { describe, expect, it } from 'vitest';
import { GroupInputSchema, RoomInputSchema } from './groups';
import { NewSessionInputSchema } from './classes';

describe('names are stored normalised', () => {
  it('a session name', () => {
    const parsed = NewSessionInputSchema.parse({
      name: '  Autumn Camp　 ',
      startsOn: '2027-07-05',
      endsOn: '2027-07-09',
    });
    expect(parsed.name).toBe('Autumn Camp');
  });

  it('a name that is only space-like characters is refused with the usual message', () => {
    const result = NewSessionInputSchema.safeParse({
      name: ' ​',
      startsOn: '2027-07-05',
      endsOn: '2027-07-09',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Enter a name.');
  });

  it('a group and a room name', () => {
    expect(GroupInputSchema.parse({ name: 'Red Team', capacity: 5, ratioCampers: null, ageRange: null }).name).toBe(
      'Red Team',
    );
    expect(RoomInputSchema.parse({ name: 'Hall　A', location: 'Main', capacity: 5 }).name).toBe('Hall A');
  });
});
