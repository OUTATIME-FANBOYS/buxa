/** A class's camp size: the places it offers. Whole numbers from 3 to 30, checked in the form and again on the server. */
export const MIN_CAMP_SIZE = 3;
export const MAX_CAMP_SIZE = 30;

export function isValidCampSize(size: number): boolean {
  return Number.isInteger(size) && size >= MIN_CAMP_SIZE && size <= MAX_CAMP_SIZE;
}
