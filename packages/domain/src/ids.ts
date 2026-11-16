const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string. The single definition used by the API, the database layer and the web app. */
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
