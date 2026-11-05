// Shared PDF theme palettes for report subscriptions.
// Mirrored (intentionally duplicated) in supabase/functions/generate-report/pdf-renderer.ts
// because edge functions cannot import from src/.

export type PdfThemeId =
  | 'default' | 'amber' | 'blue_black' | 'light_pink'
  | 'teal' | 'forest' | 'ocean' | 'indigo' | 'plum' | 'crimson' | 'graphite'
  | 'custom';

export interface PdfTheme {
  id: PdfThemeId;
  label: string;
  /** Swatch/accent colour shown in the picker and used for rules & separators. */
  accent: string;
  /** Dark masthead background for the "Band" header style. */
  band: string;
  /** Table header background. */
  headFill: string;
  /** Table header text. */
  headText: string;
}

export const PDF_THEMES: PdfTheme[] = [
  { id: 'default', label: 'Company brand', accent: '#534ab7', band: '#111111', headFill: '#f6f6f4', headText: '#464646' },
  { id: 'amber', label: 'Amber', accent: '#f59e0b', band: '#78350f', headFill: '#fef3c7', headText: '#78350f' },
  { id: 'blue_black', label: 'Blue & Black', accent: '#2563eb', band: '#0f172a', headFill: '#dbeafe', headText: '#1e3a8a' },
  { id: 'light_pink', label: 'Light Pink', accent: '#ec4899', band: '#831843', headFill: '#fce7f3', headText: '#831843' },
  { id: 'teal', label: 'Teal', accent: '#0d9488', band: '#134e4a', headFill: '#ccfbf1', headText: '#115e59' },
  { id: 'forest', label: 'Forest', accent: '#16a34a', band: '#14532d', headFill: '#dcfce7', headText: '#166534' },
  { id: 'ocean', label: 'Ocean', accent: '#0284c7', band: '#0c4a6e', headFill: '#e0f2fe', headText: '#075985' },
  { id: 'indigo', label: 'Indigo', accent: '#6366f1', band: '#312e81', headFill: '#e0e7ff', headText: '#3730a3' },
  { id: 'plum', label: 'Plum', accent: '#9333ea', band: '#4c1d95', headFill: '#f3e8ff', headText: '#6b21a8' },
  { id: 'crimson', label: 'Crimson', accent: '#dc2626', band: '#7f1d1d', headFill: '#fee2e2', headText: '#991b1b' },
  { id: 'graphite', label: 'Graphite', accent: '#64748b', band: '#1e293b', headFill: '#f1f5f9', headText: '#334155' },
  { id: 'custom', label: 'Custom', accent: '#534ab7', band: '#1f2937', headFill: '#eef2f7', headText: '#334155' },
];

/** The four colours a custom palette lets you set, in the order the picker shows
 *  them: the header first, because it is the one people mean by "theme". */
export const CUSTOM_THEME_FIELDS = [
  { key: 'band', label: 'Header & figures' },
  { key: 'accent', label: 'Accent & rules' },
  { key: 'headFill', label: 'Table header fill' },
  { key: 'headText', label: 'Table header text' },
] as const;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function getPdfTheme(id?: string, custom?: Partial<PdfTheme> | null): PdfTheme {
  const base = PDF_THEMES.find(t => t.id === id) ?? PDF_THEMES[0];
  if (base.id !== 'custom') return base;
  // Each field falls back on its own, so a half-typed hex leaves the other three
  // alone instead of dropping the whole palette back to the preset.
  const pick = (k: 'accent' | 'band' | 'headFill' | 'headText') => {
    const v = custom?.[k];
    return typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : base[k];
  };
  return {
    ...base,
    accent: pick('accent'), band: pick('band'),
    headFill: pick('headFill'), headText: pick('headText'),
  };
}

// ---------------------------------------------------------------------------
// Document templates. A template sets layout, typography and table density;
// the theme above still sets the colour, so any template works in any theme.
// Mirrored in supabase/functions/generate-report/pdf-renderer.ts.
// ---------------------------------------------------------------------------

export type PdfLayoutId = 'classic' | 'executive' | 'operational' | 'editorial' | 'modern';

export interface PdfLayout {
  id: PdfLayoutId;
  label: string;
  /** One line in the picker: what the template is for, not what it looks like. */
  blurb: string;
}

export const PDF_LAYOUTS: PdfLayout[] = [
  { id: 'executive', label: 'Executive', blurb: 'Serif, hairline rules, plenty of air — for an owner or director' },
  { id: 'operational', label: 'Operational', blurb: 'Dense zebra rows, about twice the rows per page — for a long daily register' },
  { id: 'editorial', label: 'Editorial', blurb: 'Centred masthead and double rule — reads as a printed bulletin' },
  { id: 'modern', label: 'Modern', blurb: 'Rounded cards with one headline figure — the safe default' },
  { id: 'classic', label: 'Classic', blurb: 'The original layout, with the header set by Header style below' },
];

export function getPdfLayout(id?: string): PdfLayout {
  return PDF_LAYOUTS.find(l => l.id === id) ?? PDF_LAYOUTS[PDF_LAYOUTS.length - 1];
}
