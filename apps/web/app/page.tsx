import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/** The bare address goes to the camp area. There is no public landing page, so nothing else is shown here. */
export default function HomePage(): never {
  redirect(ROUTES.camp);
}
