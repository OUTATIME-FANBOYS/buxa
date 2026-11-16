import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/** The bare address goes to the camp area. A public landing page belongs here later. */
export default function HomePage(): never {
  redirect(ROUTES.camp);
}
