/** "1:8" is one instructor for every eight campers. Stored and reported; automatic enforcement is not part of phase 2. */
export interface InstructorRatio { instructors: number; campers: number }

export interface RatioReport {
  ratio: InstructorRatio;
  enrolled: number;
  assignedInstructors: number;
  requiredInstructors: number;
  shortfall: number;
  withinRatio: boolean;
  /** Null when no instructor is assigned yet. */
  campersPerInstructor: number | null;
}

/** Compares the enrolled campers with the instructors assigned to a session. Returns null when the class has no ratio. */
export function instructorRatio(ratio: InstructorRatio | null, enrolled: number, assignedInstructors: number): RatioReport | null {
  if (ratio === null) return null;
  const requiredInstructors = Math.ceil(enrolled / ratio.campers);
  const shortfall = Math.max(0, requiredInstructors - assignedInstructors);
  return {
    ratio,
    enrolled,
    assignedInstructors,
    requiredInstructors,
    shortfall,
    withinRatio: shortfall === 0,
    campersPerInstructor: assignedInstructors > 0 ? enrolled / assignedInstructors : null,
  };
}
