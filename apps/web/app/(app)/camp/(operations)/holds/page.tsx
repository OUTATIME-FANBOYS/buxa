import type { Metadata } from 'next';
import { CampHolds } from '@/components/views/holds';

export const metadata: Metadata = { title: 'Holds' };

/** The places held across the camp, and each class's waitlist beside them. Read only. */
export default function Page() {
  return <CampHolds />;
}
