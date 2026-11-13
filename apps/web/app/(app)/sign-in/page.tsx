import type { Metadata } from 'next';
import { SignInPage } from '@/features/camp/screens/SignInPage';

export const metadata: Metadata = { title: 'Sign in' };

export default function Page() {
  return <SignInPage />;
}
