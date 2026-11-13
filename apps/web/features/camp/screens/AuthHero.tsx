import { Icon } from '@/features/kanban/components/Icon';

/** The brand panel beside the sign-in form. Decorative, so hidden from assistive technology. */
export function AuthHero() {
  return (
    <aside className="auth-hero" aria-hidden="true">
      <div className="brand brand-lg"><span className="logo"><Icon name="kanban" size={18} /></span> Buxa</div>
      <div className="hero-copy">
        <p className="hero-title">Run your camp from one place.</p>
        <ul>
          <li><Icon name="users" size={16} />People, families and staff in one list</li>
          <li><Icon name="calendar" size={16} />Sessions, registration and check-in</li>
          <li><Icon name="kanban" size={16} />A task board for the team behind the scenes</li>
        </ul>
      </div>
    </aside>
  );
}
