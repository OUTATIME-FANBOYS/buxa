'use client';

import { useEffect, useState } from 'react';
import { isDark, setTheme } from '@/logic/common';

/** Light/dark for the current browser. Reads the page after mount, because the server cannot know it. */
export function useDarkMode(): { dark: boolean; toggle: () => void } {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(isDark()); }, []);
  return { dark, toggle: () => { setTheme(!dark); setDark(!dark); } };
}
