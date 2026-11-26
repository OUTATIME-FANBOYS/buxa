import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/** The New form is a pop-up on the Registration page now. This address (kept so old links work) goes there. */
export default function Page() {
  redirect(ROUTES.registration);
}
