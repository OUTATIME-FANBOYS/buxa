import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Down for maintenance' };

/** Shown instead of the app when the start-up safety check refuses to serve (see server/availability.ts). */
export default function MaintenancePage() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Buxa is down for maintenance</h1>
        <p className="muted">
          The app is paused while a safety setting is checked. Nothing you do is lost. Please try again later.
        </p>
      </div>
    </main>
  );
}
