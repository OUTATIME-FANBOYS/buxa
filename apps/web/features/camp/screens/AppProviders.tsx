'use client';

import type { ReactNode } from 'react';
import { UiProvider } from '@/components/ui';
import { AuthProvider } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { NotConfigured } from './NotConfigured';

/** The providers sign-in and the camp area share. Without Supabase settings it shows the setup page instead. */
export function AppProviders({ children }: { children: ReactNode }) {
  if (!supabase) return <NotConfigured />;
  return <AuthProvider client={supabase}><UiProvider>{children}</UiProvider></AuthProvider>;
}
