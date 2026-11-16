import { CAMP } from './roster';
import type { ResetPlan } from './reset';

/** The confirmation the operator reads before a reset: what goes, what stays, and what happens next. Pure, so it can be tested. */
export function describeReset(plan: ResetPlan): string {
  return [
    `This will DELETE these rows of ${CAMP.name} from the local database:`,
    `  ${plan.people} people (campers, guardians and staff)`,
    `  ${plan.households} households`,
    `  ${plan.memberships} memberships`,
    `  ${plan.badges} badges`,
    `  ${plan.checkIns} check-ins`,
    'Kept: the camp itself, its members and the audit log. The camp is then seeded again from the roster.',
  ].join('\n');
}
