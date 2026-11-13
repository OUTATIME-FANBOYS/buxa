import Link from 'next/link';
import { ROUTES } from '@/config/routes';

export default function NotFound() {
  return (
    <main className="auth"><div className="auth-card">
      <h1>Page not found</h1>
      <p className="muted">There is nothing at this address.</p>
      <Link className="btn btn-primary" href={ROUTES.camp}>Go to your camp</Link>
    </div></main>
  );
}
