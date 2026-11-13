import { Icon } from '../../components/Icon';

export function NotConfigured() {
  return (
    <main className="auth"><div className="auth-card">
      <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
      <h1>Connect Supabase</h1>
      <p className="muted">This app needs two public settings before people can sign in.</p>
      <ol className="steps">
        <li>Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code>.</li>
        <li>Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> from Supabase → Project Settings → API.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
      <p className="muted small">Only the publishable key belongs here. Never add a secret or service_role key to the web app.</p>
      <a className="btn btn-block" href="#/dashboard">Open the staff board without signing in</a>
    </div></main>
  );
}
