/**
 * The app's name and the two brand colours the installed app uses: the manifest, the browser's theme colour and the layout metadata
 * read them from here. `styles/tokens.css` defines the same two colours as `--accent` and `--bg`; `brand.test.ts` fails if they differ.
 */
export const BRAND = {
  name: 'Buxa',
  description: 'Camp and membership management.',
  /** Stormy Teal: the accent, and the browser and home-screen theme colour. */
  themeColour: '#0F7173',
  /** Platinum: the page background, shown while the installed app starts. */
  background: '#E7ECEF',
} as const;
