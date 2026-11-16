/**
 * The shape of the help text. The text itself lives in the section files beside this one; the components only lay it out.
 * Editing wording means editing a content file, never a component.
 */

/** A grid with a header row, for example the column list of a CSV. */
export interface HelpTable {
  caption: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

/** A few lines of text shown exactly as typed, for example a CSV header row. */
export interface HelpCode {
  caption: string;
  lines: readonly string[];
}

/** One heading inside a section, with its paragraphs, numbered steps, and optionally a table or code sample. */
export interface HelpSubsection {
  /** Anchor for links into this part of the page. Optional. */
  id?: string;
  heading: string;
  paragraphs?: readonly string[];
  steps?: readonly string[];
  table?: HelpTable;
  code?: HelpCode;
  /** Text shown after the table or code sample, for example what the example row means. */
  after?: readonly string[];
}

/** A status shown under a section heading. Used to say a feature is not built yet, so nobody looks for a button that is not there. */
export interface HelpAvailability {
  label: string;
  detail: string;
}

/** One top-level section of the help page. Its `id` is the anchor, so `/camp/help#exports` lands on it. */
export interface HelpSectionContent {
  id: string;
  title: string;
  intro: readonly string[];
  availability?: HelpAvailability;
  subsections: readonly HelpSubsection[];
}
