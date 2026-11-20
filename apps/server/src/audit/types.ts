/** The details an audit row carries. They are stored as JSON, so each is a plain value or a list of plain values. */
export type AuditData = Record<string, string | number | boolean | null | string[]>;
