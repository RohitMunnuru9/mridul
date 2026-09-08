/**
 * Homepage mood tiles.
 *
 * The rows themselves now live in Supabase; this file keeps only the type, and
 * the icon key stays a string so the data layer never imports a React
 * component. The map from key to icon lives with the markup, in the rail.
 */

export type MoodTile = {
  id: string;
  label: string;
  note: string;
  /** Resolves against the live listing filters, so a tile cannot dead-end. */
  href: string;
  icon: string;
  tone: string;
  position: number;
};
