import { BrandMark } from '@/components/elements/export';

/** Shown on the sign-in page when the public Supabase settings are missing, instead of a form that cannot work. */
export function NotConfigured() {
  return (
    <main className="auth"><div className="auth-card">
      <div className="brand brand-lg auth-brand"><span className="logo logo-mark" aria-hidden="true"><BrandMark size={32} /></span> Buxa</div>
      <h1>Connect Supabase</h1>
      <p className="muted">This app needs two public settings before people can sign in.</p>
      <ol className="steps">
        <li>Copy <code>apps/web/.env.example</code> to <code>apps/web/.env.local</code>.</li>
        <li>Fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> from Supabase → Project Settings → API.</li>
        <li>Restart <code>npm run dev</code>.</li>
      </ol>
      <p className="muted small">Only the publishable key belongs here. Never add a secret or service_role key to the web app.</p>
    </div></main>
  );
}
