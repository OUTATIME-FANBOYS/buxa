/** One line the logger writes: the logger's output is a JSON object per line, so a test reads each line as this. */
export type LogLine = Record<string, unknown>;

/** Narrows a parsed log line. Anything that is not a JSON object is not a log line. */
export const isLogLine = (v: unknown): v is LogLine => typeof v === 'object' && v !== null && !Array.isArray(v);
