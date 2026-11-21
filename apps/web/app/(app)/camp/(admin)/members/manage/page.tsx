import type { Metadata } from 'next';
import { ManageAccess } from '@/components/views/camp';

export const metadata: Metadata = { title: 'Manage access' };

/** Manage access: change each member's role. The page itself checks members:change_role. */
export default function Page() {
  return <ManageAccess />;
}
