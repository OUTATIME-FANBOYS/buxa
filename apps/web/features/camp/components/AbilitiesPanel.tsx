import type { Role } from '@buxa/domain';
import { Icon } from '@/components/ui';
import { abilitiesFor } from '../lib/abilities';

/** What a role may do here, from the same table the server checks. */
export function AbilitiesPanel({ role }: { role: Role }) {
  return (
    <section className="panel" aria-labelledby="abilities-title">
      <div className="panel-head"><h2 id="abilities-title">What you can do here</h2></div>
      <ul className="abilities">
        {abilitiesFor(role).map(({ label, allowed }) => (
          <li key={label} className={allowed ? 'yes' : 'no'}>
            <Icon name={allowed ? 'check' : 'x'} size={15} /><span>{label}</span>
            <span className="sr-only">{allowed ? ' (allowed)' : ' (not allowed for your role)'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
