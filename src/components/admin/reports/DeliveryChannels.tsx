import React from 'react';
import { Bell, Mail, MessageCircle, X, Plus, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export type Channel = 'in_app' | 'email' | 'whatsapp';

const CHANNELS: Array<{ value: Channel; label: string; hint: string; icon: typeof Bell }> = [
  { value: 'in_app', label: 'In the app', hint: 'A notification, and a phone push if that is on', icon: Bell },
  { value: 'email', label: 'Email', hint: 'The report arrives as an attachment', icon: Mail },
  { value: 'whatsapp', label: 'WhatsApp', hint: 'A message with a link to the report', icon: MessageCircle },
];

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Same rule the edge function applies, so what is accepted here is what sends. */
const toE164 = (raw: string): string | null => {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return /^\+\d{10,15}$/.test(digits) ? digits : null;
  const plain = digits.replace(/^0+/, '');
  if (/^91\d{10}$/.test(plain)) return `+${plain}`;
  if (/^[6-9]\d{9}$/.test(plain)) return `+91${plain}`;
  return null;
};

/**
 * Where a report goes.
 *
 * The channels are a multi-select, not a single choice: the same report
 * usually wants to be a notification for the people who live in the app AND an
 * email for the ones who do not. Everyone named under Recipients is reached on
 * every channel that is on; the lists here are for people who are not users of
 * the app at all and so cannot be named there.
 */
export interface DeliveryRecipient {
  id: string;
  name: string;
  phone: string | null;
}

export function DeliveryChannels({
  channels, setChannels,
  pushToPhone, setPushToPhone,
  emails, setEmails,
  numbers, setNumbers,
  recipients = [],
  excluded = [], setExcluded,
}: {
  channels: string[];
  setChannels: React.Dispatch<React.SetStateAction<string[]>>;
  pushToPhone: boolean;
  setPushToPhone: (v: boolean) => void;
  emails: string[];
  setEmails: React.Dispatch<React.SetStateAction<string[]>>;
  numbers: string[];
  setNumbers: React.Dispatch<React.SetStateAction<string[]>>;
  /** The people named under Recipients, so the WhatsApp leg can be narrowed. */
  recipients?: DeliveryRecipient[];
  excluded?: string[];
  setExcluded?: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const on = (c: Channel) => channels.includes(c);

  const toggle = (c: Channel) => {
    setChannels(prev => {
      const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c];
      // A report with no channel renders every morning and reaches nobody, so
      // the last one cannot be switched off.
      return next.length ? next : prev;
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Send it</Label>
        <p className="text-[12px] text-muted-foreground">
          Pick as many as you need. Everyone under Recipients is reached on each one.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {CHANNELS.map(c => {
          const Icon = c.icon;
          const active = on(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => toggle(c.value)}
              aria-pressed={active}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className="text-[13px] font-medium">{c.label}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{c.hint}</p>
            </button>
          );
        })}
      </div>

      {on('in_app') && (
        <div className="flex items-center gap-3">
          <Switch checked={pushToPhone} onCheckedChange={setPushToPhone} id="push" />
          <Label htmlFor="push" className="cursor-pointer text-[13px]">
            Also send a phone push
          </Label>
        </div>
      )}

      {on('email') && (
        <AddressList
          label="Other email addresses"
          hint="For people who do not use the app. Recipients above already get it on their own address."
          placeholder="name@company.com"
          values={emails}
          setValues={setEmails}
          normalise={(v) => (isEmail(v) ? v.trim() : null)}
          invalidMessage="That does not look like an email address."
        />
      )}

      {on('whatsapp') && recipients.length > 0 && setExcluded && (
        <WhatsAppDeliveryList
          recipients={recipients}
          excluded={excluded}
          setExcluded={setExcluded}
        />
      )}

      {on('whatsapp') && (
        <AddressList
          label="Other WhatsApp numbers"
          hint="For people who do not use the app. Indian numbers get +91 added for you."
          placeholder="98765 43210"
          values={numbers}
          setValues={setNumbers}
          normalise={toE164}
          invalidMessage="That does not look like a phone number."
        />
      )}
    </div>
  );
}

/**
 * Who the WhatsApp actually reaches, and who to leave off it.
 *
 * Collapsed by default: the normal case is "everyone named gets it", and that
 * is one line. It opens only when somebody wants to change who. Unticking
 * drops that person from the WhatsApp leg ALONE -- they keep the in-app
 * notification and the email, because this narrows a channel, not the audience.
 */
function WhatsAppDeliveryList({
  recipients, excluded, setExcluded,
}: {
  recipients: DeliveryRecipient[];
  excluded: string[];
  setExcluded: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [open, setOpen] = React.useState(false);

  const willReceive = recipients.filter(
    r => !excluded.includes(r.id) && !!(r.phone ?? '').trim(),
  );
  const noNumber = recipients.filter(r => !(r.phone ?? '').trim());

  const toggle = (id: string) =>
    setExcluded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-3 text-left"
      >
        <span>
          <span className="block text-[12px] font-medium">
            Goes to {willReceive.length} of {recipients.length} on WhatsApp
          </span>
          <span className="block text-[11px] leading-snug text-muted-foreground">
            {noNumber.length > 0
              ? `${noNumber.length} of them ${noNumber.length === 1 ? 'has' : 'have'} no phone number on file`
              : 'Open to leave someone off this channel'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-1 border-t p-2">
          {recipients.map(r => {
            const hasPhone = !!(r.phone ?? '').trim();
            const off = excluded.includes(r.id);
            return (
              <label
                key={r.id}
                className={cn(
                  'flex items-center gap-2 rounded px-1.5 py-1.5',
                  hasPhone ? 'cursor-pointer hover:bg-muted/60' : 'opacity-60',
                )}
              >
                <Checkbox
                  checked={hasPhone && !off}
                  disabled={!hasPhone}
                  onCheckedChange={() => hasPhone && toggle(r.id)}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{r.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {hasPhone ? r.phone : 'no number'}
                </span>
              </label>
            );
          })}
          <p className="px-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">
            Unticking leaves someone off WhatsApp only — they still get the
            notification in the app and the email.
          </p>
        </div>
      )}
    </div>
  );
}

/** A list of typed-in addresses or numbers, kept as chips. */
function AddressList({
  label, hint, placeholder, values, setValues, normalise, invalidMessage,
}: {
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  setValues: React.Dispatch<React.SetStateAction<string[]>>;
  normalise: (v: string) => string | null;
  invalidMessage: string;
}) {
  const [draft, setDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const add = () => {
    const raw = draft.trim();
    if (!raw) return;
    const clean = normalise(raw);
    if (!clean) { setError(invalidMessage); return; }
    setValues(prev => (prev.includes(clean) ? prev : [...prev, clean]));
    setDraft('');
    setError(null);
  };

  return (
    <div className="space-y-1.5 rounded-lg border p-3">
      <Label className="text-[12px]">{label}</Label>
      <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {values.map(v => (
            <span key={v}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11.5px]">
              {v}
              <button type="button" aria-label={`Remove ${v}`}
                      onClick={() => setValues(prev => prev.filter(x => x !== v))}
                      className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1.5 pt-1">
        <Input
          className="h-8 text-[12px]"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          // Enter adds the entry rather than submitting the form around it.
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          onBlur={add}
        />
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
