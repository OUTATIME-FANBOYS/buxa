import { CAMP_ROLE_LABELS, type CampRole } from '@buxa/domain';
import { CAMP_ROLE_TONE } from '@buxa/shared';
import { Pill } from '@/components/elements';

export function RolePills({ roles }: { roles: readonly CampRole[] }) {
  if (roles.length === 0) {
    return <span className="muted">No roles</span>;
  }

  return (
    <span className="row">
      {roles.map(role => (
        <Pill key={role} tone={CAMP_ROLE_TONE[role as keyof typeof CAMP_ROLE_TONE] ?? 'neutral'} dot={false}>
          {CAMP_ROLE_LABELS[role]}
        </Pill>
      ))}
    </span>
  );
}
