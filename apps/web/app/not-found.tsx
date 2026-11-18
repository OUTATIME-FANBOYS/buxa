import { ROUTES } from '@/config/routes';
import { Button } from '@/components/components';

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Page not found</h1>
        <p className="muted">There is nothing at this address.</p>
        <Button variant="primary" href={ROUTES.camp}>
          Go to your camp
        </Button>
      </div>
    </main>
  );
}
