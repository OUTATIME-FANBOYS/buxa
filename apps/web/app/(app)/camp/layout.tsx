import type { ReactNode } from 'react';
import { CampGate } from '@/features/camp/screens/CampGate';

export default function CampLayout({ children }: { children: ReactNode }) {
  return <CampGate>{children}</CampGate>;
}
