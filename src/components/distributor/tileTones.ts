/**
 * The tinted-tile palette used across the distributor screens.
 *
 * It started on the Overview tiles and is shared from here so the Secondary
 * tab reads as the same product rather than a second opinion about colour.
 * Each tone carries three surfaces: the card, the icon chip, and the figure.
 */
export const TILE_TONES: Record<string, { surface: string; chip: string; figure: string; bar: string }> = {
  violet: {
    surface: 'bg-violet-50/70 border-violet-200/70 dark:bg-violet-950/30 dark:border-violet-900/50',
    chip: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    figure: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500/15',
  },
  sky: {
    surface: 'bg-sky-50/70 border-sky-200/70 dark:bg-sky-950/30 dark:border-sky-900/50',
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    figure: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500/15',
  },
  emerald: {
    surface: 'bg-emerald-50/70 border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-900/50',
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    figure: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500/15',
  },
  amber: {
    surface: 'bg-amber-50/70 border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-900/50',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    figure: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500/15',
  },
  rose: {
    surface: 'bg-rose-50/70 border-rose-200/70 dark:bg-rose-950/30 dark:border-rose-900/50',
    chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
    figure: 'text-rose-700 dark:text-rose-300',
    bar: 'bg-rose-500/15',
  },
  teal: {
    surface: 'bg-teal-50/70 border-teal-200/70 dark:bg-teal-950/30 dark:border-teal-900/50',
    chip: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
    figure: 'text-teal-700 dark:text-teal-300',
    bar: 'bg-teal-500/15',
  },
};
