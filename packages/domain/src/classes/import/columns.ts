/** The template's columns, in the order the downloaded file has them. Names are part of the file format: do not rename them. */
export const IMPORT_COLUMNS = [
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
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
