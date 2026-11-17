import type { Enrolment, EnrolmentStatus } from '@buxa/contracts';
import { Pill } from '@/components/ui';
import type { Tone } from '@/components/ui/tones';
import { formatCampDateTime } from '@/features/attendance/lib/time';
import { CancelEnrolmentButton } from '../forms/CancelEnrolmentButton';

const STATUS: Record<EnrolmentStatus, { label: string; tone: Tone }> = {
  enrolled: { label: 'Enrolled', tone: 'ok' },
  waitlisted: { label: 'Waitlisted', tone: 'brand' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

/**
 * Who is in one session, by name and status. Contact details are not part of an enrolment, so none are shown. Cancel is offered
 * only to people who manage classes; the service checks the permission again.
 */
export function EnrolmentTable({ classId, enrolments, canManage, timeZone }: {
  classId: string; enrolments: readonly Enrolment[]; canManage: boolean; timeZone: string;
}) {
  return (
    <div className="table-wrap"><table className="table">
      <caption className="sr-only">People enrolled in this session</caption>
      <thead><tr>
        <th scope="col">Camper</th><th scope="col">Status</th><th scope="col">Enrolled</th>
        {canManage && <th scope="col"><span className="sr-only">Actions</span></th>}
      </tr></thead>
      <tbody>
        {enrolments.map(enrolment => {
          const status = STATUS[enrolment.status];
          const live = enrolment.status !== 'cancelled';
          return (
            <tr key={enrolment.id}>
              <td>{enrolment.camperName}</td>
              <td><Pill tone={status.tone}>{status.label}</Pill></td>
              <td>{formatCampDateTime(enrolment.enrolledAt, timeZone)}</td>
              {canManage && (
                <td>{live && <CancelEnrolmentButton classId={classId} enrolmentId={enrolment.id} camperName={enrolment.camperName} />}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table></div>
  );
}
