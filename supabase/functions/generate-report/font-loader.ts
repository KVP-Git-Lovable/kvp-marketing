// Fetch and cache a Unicode TTF (Roboto) so jsPDF can render the Indian
// Rupee sign (U+20B9) and other non-WinAnsi glyphs. On failure the caller
// falls back to ASCII "Rs." for currency values.
//
// URLs verified against jsdelivr (Roboto v3 hinted TTFs).

const ROBOTO_URLS: Record<'regular' | 'bold' | 'italic', string> = {
  regular: 'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf',
  bold: 'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Bold.ttf',
  italic: 'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Italic.ttf',
};

export interface UnicodeFont {
  name: string; // jsPDF font family name to use
  regular: string; // base64
  bold: string;
  italic: string;
}

let cache: UnicodeFont | null = null;
let inflight: Promise<UnicodeFont | null> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fetchB64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`font fetch ${res.status}: ${url}`);
  return toBase64(await res.arrayBuffer());
}

export async function loadUnicodeFont(): Promise<UnicodeFont | null> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [regular, bold, italic] = await Promise.all([
        fetchB64(ROBOTO_URLS.regular),
        fetchB64(ROBOTO_URLS.bold),
        fetchB64(ROBOTO_URLS.italic),
      ]);
      cache = { name: 'Roboto', regular, bold, italic };
      return cache;
    } catch (e) {
      console.warn('Unicode font load failed; using ASCII fallback', e);
      return null;
    }
  })();
  return inflight;
}

// Register the fetched font on a jsPDF document under the 'Roboto' family.
/**
 * Mukta, for Devanagari.
 *
 * Roboto carries no Devanagari, so every Hindi beat and retailer name printed as
 * nothing at all — "पुलिस लाइन/100 फिट भीलवाड़ा" reached the page as "/100".
 * Mukta covers Devanagari, Latin and the rupee sign in one file, which matters
 * because these names mix scripts inside a single cell and jsPDF picks one font
 * per run of text.
 *
 * Fetched only when a report actually contains Devanagari: it is ~850 KB across
 * both weights, and most reports never need it.
 */
const MUKTA_URLS: Record<'regular' | 'bold', string> = {
  regular: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mukta/Mukta-Regular.ttf',
  bold: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/mukta/Mukta-Bold.ttf',
};

export interface ScriptFont { name: string; regular: string; bold: string }

let devCache: ScriptFont | null = null;
let devInflight: Promise<ScriptFont | null> | null = null;

export const DEVANAGARI_RE = /[\u0900-\u097F]/;

export async function loadDevanagariFont(): Promise<ScriptFont | null> {
  if (devCache) return devCache;
  if (devInflight) return devInflight;
  devInflight = (async () => {
    try {
      const [regular, bold] = await Promise.all([
        fetchB64(MUKTA_URLS.regular),
        fetchB64(MUKTA_URLS.bold),
      ]);
      devCache = { name: 'Mukta', regular, bold };
      return devCache;
    } catch (e) {
      // The report still renders; the Devanagari just stays blank, as before.
      console.warn('Devanagari font load failed', e);
      return null;
    }
  })();
  return devInflight;
}

export function registerScriptFontOnDoc(doc: any, font: ScriptFont): void {
  doc.addFileToVFS(`${font.name}-Regular.ttf`, font.regular);
  doc.addFont(`${font.name}-Regular.ttf`, font.name, 'normal');
  doc.addFileToVFS(`${font.name}-Bold.ttf`, font.bold);
  doc.addFont(`${font.name}-Bold.ttf`, font.name, 'bold');
  // Mukta ships no italic; jsPDF falls back to the normal face for it.
  doc.addFont(`${font.name}-Regular.ttf`, font.name, 'italic');
}

export function registerFontOnDoc(doc: any, font: UnicodeFont): void {
  doc.addFileToVFS(`${font.name}-Regular.ttf`, font.regular);
  doc.addFont(`${font.name}-Regular.ttf`, font.name, 'normal');
  doc.addFileToVFS(`${font.name}-Bold.ttf`, font.bold);
  doc.addFont(`${font.name}-Bold.ttf`, font.name, 'bold');
  doc.addFileToVFS(`${font.name}-Italic.ttf`, font.italic);
  doc.addFont(`${font.name}-Italic.ttf`, font.name, 'italic');
  doc.setFont(font.name, 'normal');
}
