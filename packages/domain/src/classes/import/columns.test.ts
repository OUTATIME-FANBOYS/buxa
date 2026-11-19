import { describe, expect, it } from 'vitest';
import { IMPORT_COLUMNS } from './columns';

describe('import template columns', () => {
  it('are exactly the eleven columns of the spec, in order', () => {
    expect(IMPORT_COLUMNS).toEqual([
      'external_key',
      'class_name',
      'starts_at',
      'ends_at',
      'location',
      'age_min',
      'age_max',
      'capacity',
      'instructor_names',
      'ratio_campers',
      'ratio_instructors',
    ]);
    expect(IMPORT_COLUMNS).toHaveLength(11);
  });
});
