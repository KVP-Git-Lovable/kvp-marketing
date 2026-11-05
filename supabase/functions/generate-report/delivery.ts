// Delivering a finished report outside the app: email and WhatsApp.
//
// Both channels already exist in this project for other things — Resend sends
// user invitations, Twilio sends invoices over WhatsApp — so this reuses the
// same providers and secrets rather than introducing a third.
//
// Every function here reports a result instead of throwing. A report that
// renders correctly must still land in the app even if an inbox bounces or a
// number is wrong, and one bad address must not stop the next recipient.

export interface DeliveryResult {
  channel: 'email' | 'whatsapp';
  to: string;
  ok: boolean;
  /** Why it did not go. Recorded on the delivery row, so a silent failure
   *  cannot hide behind a green tick. */
  error?: string;
  id?: string;
  /** Which approved template carried the message. An identifier, not a
   *  credential, and the only way to tell from the outside which template a
   *  send actually used -- the SID lives in a secret nobody can read back. */
  template?: string;
}

/**
 * The address reports are sent from.
 *
 * Resend's shared `onboarding@resend.dev` only delivers to the address that
 * owns the Resend account, which is fine for a smoke test and useless for
 * sending a manager their morning report. Set REPORT_EMAIL_FROM to something
 * on a verified domain and real delivery starts working with no code change.
 */
const emailFrom = () =>
  Deno.env.get('REPORT_EMAIL_FROM') || 'Reports <onboarding@resend.dev>';

/** Normalise an Indian mobile number to E.164. Same rule as send-invoice-whatsapp. */
export function toE164(raw: string): string | null {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return /^\+\d{10,15}$/.test(digits) ? digits : null;
  const plain = digits.replace(/^0+/, '');
  if (/^91\d{10}$/.test(plain)) return `+${plain}`;
  if (/^[6-9]\d{9}$/.test(plain)) return `+91${plain}`;
  return null;
}

/** A plain address check — enough to catch a typo, not a validation theory. */
export function isEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(raw ?? '').trim());
}

export async function sendReportEmail(opts: {
  to: string;
  reportName: string;
  periodLabel: string;
  bodyLines: string[];
  /** The rendered file. Absent for a summary-only report. */
  attachment?: { filename: string; bytes: Uint8Array } | null;
}): Promise<DeliveryResult> {
  const to = String(opts.to ?? '').trim();
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { channel: 'email', to, ok: false, error: 'RESEND_API_KEY is not set' };
  if (!isEmail(to)) return { channel: 'email', to, ok: false, error: 'not a valid address' };

  const text = opts.bodyLines.filter(Boolean).join('\n\n');
  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.55;color:#1c2440">
    <p style="margin:0 0 4px;font-size:16px;font-weight:600">${escapeHtml(opts.reportName)}</p>
    <p style="margin:0 0 16px;color:#5a6284">${escapeHtml(opts.periodLabel)}</p>
    ${opts.bodyLines.filter(Boolean).map(l => `<p style="margin:0 0 10px;white-space:pre-wrap">${escapeHtml(l)}</p>`).join('')}
    ${opts.attachment ? '<p style="margin:16px 0 0;color:#5a6284">The full report is attached.</p>' : ''}
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: emailFrom(),
        to: [to],
        subject: `${opts.reportName} — ${opts.periodLabel}`,
        text,
        html,
        ...(opts.attachment
          ? {
              attachments: [{
                filename: opts.attachment.filename,
                // Resend takes base64. Chunked so a multi-megabyte PDF does not
                // blow the argument limit of String.fromCharCode.
                content: base64(opts.attachment.bytes),
              }],
            }
          : {}),
      }),
    });
    if (!res.ok) {
      return { channel: 'email', to, ok: false, error: `${res.status} ${(await res.text()).slice(0, 300)}` };
    }
    const out = await res.json().catch(() => ({}));
    return { channel: 'email', to, ok: true, id: out?.id };
  } catch (e) {
    return { channel: 'email', to, ok: false, error: (e as Error).message };
  }
}

const TWILIO_GATEWAY = 'https://connector-gateway.lovable.dev/twilio';

/**
 * A report over WhatsApp.
 *
 * WhatsApp will not carry a free-form business-initiated message outside a
 * 24-hour reply window, and a scheduled report is almost never inside one, so
 * this must use an APPROVED TEMPLATE. The template's id lives in
 * WHATSAPP_REPORT_CONTENT_SID; without it there is nothing to send and the
 * attempt is recorded as skipped rather than failing the run.
 *
 * The template is expected to take four variables:
 *   {{1}} report name   {{2}} period   {{3}} the summary   {{4}} link to the file
 */
export async function sendReportWhatsApp(opts: {
  to: string;
  reportName: string;
  periodLabel: string;
  link: string | null;
  summary?: string | null;
}): Promise<DeliveryResult> {
  const raw = String(opts.to ?? '').trim();
  const to = toE164(raw);
  if (!to) return { channel: 'whatsapp', to: raw, ok: false, error: 'not a valid phone number' };

  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const twilioKey = Deno.env.get('TWILIO_API_KEY');
  // The PDF template attaches the file itself; its media URL is fixed up to
  // ".../object/sign/report-files/" and {{5}} carries the rest of the signed URL.
  const pdfSid = Deno.env.get('WHATSAPP_REPORT_PDF_CONTENT_SID');
  const mediaSuffix = signedSuffix(opts.link);
  // Setting the PDF template means every report goes out on it. It used to fall
  // back to the link-only template whenever the suffix could not be derived,
  // which quietly sent some reports on a different template than the one that
  // was configured -- and nothing in the result said which. If the PDF template
  // is set and the link is unusable, that is a fault to report, not to paper over.
  const contentSid = pdfSid || Deno.env.get('WHATSAPP_REPORT_CONTENT_SID');
  if (pdfSid && !mediaSuffix) {
    return {
      channel: 'whatsapp', to, ok: false, template: pdfSid,
      error: opts.link
        ? 'the report link is not a report-files signed URL, so the PDF template has nothing to attach'
        : 'no report file to attach, and the PDF template requires one',
    };
  }
  const from = Deno.env.get('WHATSAPP_FROM') || 'whatsapp:+917411679191';

  if (!lovableKey || !twilioKey) {
    return { channel: 'whatsapp', to, ok: false, error: 'Twilio connector is not configured' };
  }
  if (!contentSid) {
    return {
      channel: 'whatsapp', to, ok: false,
      error: 'WHATSAPP_REPORT_CONTENT_SID is not set — an approved WhatsApp template is required',
    };
  }

  const vars: Record<string, string> = {
    '1': opts.reportName,
    '2': opts.periodLabel,
    '3': flattenForTemplate(opts.summary, 300) || 'No summary for this period.',
    '4': opts.link ?? '',
  };
  if (contentSid === pdfSid && mediaSuffix) vars['5'] = mediaSuffix;

  const form = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: from,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(vars),
  });

  try {
    const res = await fetch(`${TWILIO_GATEWAY}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': twilioKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
    });
    if (!res.ok) {
      return {
        channel: 'whatsapp', to, ok: false, template: contentSid,
        error: `${res.status} ${(await res.text()).slice(0, 300)}`,
      };
    }
    const out = await res.json().catch(() => ({}));
    return { channel: 'whatsapp', to, ok: true, id: out?.sid, template: contentSid };
  } catch (e) {
    return { channel: 'whatsapp', to, ok: false, error: (e as Error).message };
  }
}

/**
 * The AI summary, made safe to hand to a WhatsApp template.
 *
 * Twilio rejects a content variable containing a newline, a tab, or a run of
 * four or more spaces, and the summary is written as prose with paragraph
 * breaks — so passing it through untouched fails the send outright rather than
 * arriving badly formatted. Markdown emphasis goes too: the summary is written
 * for a PDF, and `**bold**` reaches WhatsApp as literal asterisks.
 */
function flattenForTemplate(raw?: string | null, limit = 600): string {
  const flat = String(raw ?? '')
    .replace(/[*_`#]+/g, '')        // markdown emphasis and headings
    .replace(/^\s*[-•]\s*/gm, '')    // list bullets
    .replace(/\s+/g, ' ')            // newlines, tabs and space runs
    .trim();
  if (flat.length <= limit) return flat;
  // Cut at a sentence end where there is one nearby, so the message does not
  // stop mid-clause; the full text is in the file the link points at.
  const cut = flat.slice(0, limit);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (stop > limit * 0.6 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…');
}

/** The part of a report-files signed URL after the template's fixed prefix. */
function signedSuffix(link: string | null): string | null {
  if (!link) return null;
  const marker = '/storage/v1/object/sign/report-files/';
  const i = link.indexOf(marker);
  return i >= 0 ? link.slice(i + marker.length) : null;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** base64 in 8k chunks — fromCharCode takes a bounded argument list. */
function base64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x2000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
