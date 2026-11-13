'use client';

import { createContext, useContext } from 'react';
import type { Membership } from '@buxa/contracts';

export const CurrentCampContext = createContext<Membership | null>(null);

/** The camp the person is working in. Only valid on camp pages, which the camp layout renders once a camp exists. */
export function useCurrentCamp(): Membership {
  const camp = useContext(CurrentCampContext);
  if (!camp) throw new Error('useCurrentCamp must be used on a page inside a camp');
  return camp;
}
