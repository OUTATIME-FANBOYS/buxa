import { describe, expect, it } from 'vitest';
import { badRequest, forbidden, HttpError } from '../../../http/errors';
import { FORBIDDEN, expectedFailure } from '../failures';

describe('people action failures', () => {
  it('a 403 is a role that may not do this', () => {
    expect(expectedFailure(forbidden('no'), 'fallback')).toEqual({ status: 'error', message: FORBIDDEN });
  });
  it('other 4xx show the message the service wrote, or the fallback when it is empty', () => {
    expect(expectedFailure(badRequest('Enter a name.'), 'fallback')).toEqual({
      status: 'error',
      message: 'Enter a name.',
    });
    expect(expectedFailure(badRequest(''), 'Could not save.')).toEqual({ status: 'error', message: 'Could not save.' });
  });
  it('rethrows server errors and anything that is not an HTTP error', () => {
    expect(() => expectedFailure(new HttpError(500, 'boom'), 'fallback')).toThrow('boom');
    expect(() => expectedFailure(new Error('db down'), 'fallback')).toThrow('db down');
  });
});
