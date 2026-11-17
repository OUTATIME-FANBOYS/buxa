import { describe, expect, it } from 'vitest';
import { METHOD_LABEL } from '../labels';

describe('METHOD_LABEL', () => {
  it('names each check-in method in the words the log shows', () => {
    expect(METHOD_LABEL).toEqual({ qr: 'Badge', search: 'Name', manual: 'Manual' });
  });
});
