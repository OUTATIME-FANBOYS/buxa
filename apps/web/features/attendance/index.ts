/**
 * The attendance feature's public surface for pages. Server screens are imported here; client components are used through their
 * screens. The CSV encoder is exported for the attendance service (server/services) so every export shares one rule.
 */
export { CheckInScreen } from './screens/CheckInScreen';
export { OnSiteScreen } from './screens/OnSiteScreen';
export { AttendanceScreen } from './screens/AttendanceScreen';
export { encodeCsv, csvCell, neutraliseFormula, type CsvCell } from './lib/csv';
