import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseInput, text } from '../input';

describe('text', () => {
  it('returns string fields and treats anything else as empty', () => {
    const form = new FormData();
    form.set('name', 'Lake');
    form.set('file', new File(['x'], 'x.txt'));
    expect(text(form, 'name')).toBe('Lake');
    expect(text(form, 'file')).toBe('');
    expect(text(form, 'missing')).toBe('');
  });
});

describe('parseInput', () => {
  const schema = z.object({ name: z.string().min(1, 'Name is required.') });
  it('returns the parsed data on success', () => {
    expect(parseInput(schema, { name: 'Lake' })).toEqual({ ok: true, data: { name: 'Lake' } });
  });
  it('maps each field to the first schema message and gives a form-level message', () => {
    const result = parseInput(schema, { name: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.state).toMatchObject({
        status: 'error',
        message: 'Check the highlighted fields.',
        fieldErrors: { name: 'Name is required.' },
      });
    }
  });
});
