/**
 * One row as the database returns it: a column name to the value in that column. The driver types rows as `any`, so
 * queries are typed with this instead. A test narrows a value before it uses it, or names a narrower row type.
 */
export type Row = Record<string, unknown>;
