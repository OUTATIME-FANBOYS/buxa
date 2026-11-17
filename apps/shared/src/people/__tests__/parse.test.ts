import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checked, dropBlank, field, fieldAll, parseWith } from '../parse';

const form = (entries: [string, string | File][]) => {
  const data = new FormData();
  for (const [k, v] of entries) {
    data.append(k, v);
  }

  return data;
};

describe('people form parsing', () => {
  it('reads one value as a string, treating files and missing values as empty', () => {
    const data = form([['name', 'Ada'], ['photo', new File(['x'], 'x.png')]]);
    expect(field(data, 'name')).toBe('Ada');
    expect(field(data, 'photo')).toBe('');
    expect(field(data, 'missing')).toBe('');
  });
  it('reads repeated values, dropping files', () => {
    expect(fieldAll(form([['role', 'camper'], ['role', 'staff'], ['role', new File(['x'], 'x')]]), 'role')).toEqual(['camper', 'staff']);
  });
  it('a checkbox is true only when ticked as on', () => {
    expect(checked(form([['vegan', 'on']]), 'vegan')).toBe(true);
    expect(checked(form([]), 'vegan')).toBe(false);
  });
  it('dropBlank removes blank optional fields and keeps required ones', () => {
    expect(dropBlank({ a: '', b: '', c: 'x' }, ['a'])).toEqual({ b: '', c: 'x' });
  });
  it('parseWith returns the data, or each field error with the form message', () => {
    const schema = z.object({ name: z.string().min(1, 'Required.') });
    expect(parseWith(schema, { name: 'Ada' })).toEqual({ ok: true, data: { name: 'Ada' } });
    const bad = parseWith(schema, { name: '' });
    expect(bad).toMatchObject({ ok: false, state: { status: 'error', message: 'Check the highlighted fields.', fieldErrors: { name: 'Required.' } } });
  });
  it('parseWith uses the first issue as the message when no field is named', () => {
    const schema = z.string().min(5, 'Too short.');
    expect(parseWith(schema, 'ab')).toMatchObject({ ok: false, state: { message: 'Too short.' } });
  });
});
