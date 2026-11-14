import { CAMP_ROLE_LABELS, type CampRole } from '@buxa/domain';
import { Pill } from '@/components/ui';

export function RolePills({ roles }: { roles: readonly CampRole[] }) {
  if (roles.length === 0) return <span className="muted">No roles</span>;
  return (
    <span className="row">
      {roles.map(role => <Pill key={role} tone="neutral" dot={false}>{CAMP_ROLE_LABELS[role]}</Pill>)}
    </span>
  );
}
