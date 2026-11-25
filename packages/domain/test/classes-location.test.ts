import { describe, expect, it } from 'vitest';
import { findLocationClash, locationClashMessage, sameLocation, type LocatedSpan } from '../src';

type Placed = LocatedSpan & { className: string };

const at = (location: string, startsAt: string, endsAt: string, className = 'Art Camp'): Placed => ({
  className,
  location,
  startsAt,
  endsAt,
});

const monMorning = (location: string, className?: string): Placed =>
  at(location, '2027-04-12T09:00:00+10:00', '2027-04-12T12:00:00+10:00', className);

describe('classes in different locations may overlap in time', () => {
  it('two classes at the same time in different locations do not clash', () => {
    const candidate = monMorning('Studio', 'Pottery Class');
    expect(findLocationClash(candidate, [monMorning('Pool', 'Swim Stars')])).toBeNull();
  });
});

describe('classes in the same location may not overlap in time', () => {
  it('an overlap in the same location clashes, and the clash names the other class', () => {
    const candidate = at('Studio', '2027-04-12T11:00:00+10:00', '2027-04-12T13:00:00+10:00', 'Pottery Class');
    const clash = findLocationClash(candidate, [monMorning('Studio')]);
    expect(clash?.className).toBe('Art Camp');
  });

  it('a class nested inside another in the same location clashes', () => {
    const candidate = at('Studio', '2027-04-12T10:00:00+10:00', '2027-04-12T11:00:00+10:00');
    expect(findLocationClash(candidate, [monMorning('Studio')])).not.toBeNull();
  });

  it('the location is compared case and spacing insensitive, as rooms are', () => {
    const candidate = at('  studio  ', '2027-04-12T10:00:00+10:00', '2027-04-12T11:00:00+10:00');
    expect(findLocationClash(candidate, [monMorning('Studio')])).not.toBeNull();
    expect(sameLocation('Lab   1', 'lab 1')).toBe(true);
    expect(sameLocation('Lab 1', 'Lab 2')).toBe(false);
  });

  it('classes that only touch in the same location do not clash', () => {
    const candidate = at('Studio', '2027-04-12T12:00:00+10:00', '2027-04-12T13:00:00+10:00');
    expect(findLocationClash(candidate, [monMorning('Studio')])).toBeNull();
  });

  it('the same location on a different day does not clash', () => {
    const candidate = at('Studio', '2027-04-13T09:00:00+10:00', '2027-04-13T12:00:00+10:00');
    expect(findLocationClash(candidate, [monMorning('Studio')])).toBeNull();
  });

  it('names the earliest clash when several in the location overlap', () => {
    const candidate = at('Studio', '2027-04-12T09:00:00+10:00', '2027-04-12T13:00:00+10:00');
    const later = at('Studio', '2027-04-12T11:00:00+10:00', '2027-04-12T12:00:00+10:00', 'Later');
    const earlier = at('Studio', '2027-04-12T10:00:00+10:00', '2027-04-12T11:00:00+10:00', 'Earlier');
    expect(findLocationClash(candidate, [later, earlier])?.className).toBe('Earlier');
  });
});

describe('the clash message', () => {
  it('names the class, its location and its times in the camp zone', () => {
    expect(
      locationClashMessage({ name: 'Pottery Class', date: '2027-04-12' }, monMorning('Studio'), 'Australia/Sydney'),
    ).toBe(
      'Pottery Class on 2027-04-12 clashes with Art Camp at Studio (Mon 12 Apr, 09:00-12:00). Two classes in the same location cannot overlap. Choose other times, days or a location; nothing was saved.',
    );
  });
});
