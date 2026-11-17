import { describe, expect, it } from 'vitest';
import { IMPORT_IDLE } from '../importState';
import { TEMPLATE_FILE_NAME } from '../copy';

describe('classes import page and template', () => {
  it('starts the import page idle', () => {
    expect(IMPORT_IDLE).toEqual({ status: 'idle' });
  });

  it('names the blank template as a CSV file', () => {
    expect(TEMPLATE_FILE_NAME).toMatch(/\.csv$/);
  });
});
