import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, Clock, Megaphone, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HubKind } from './NotificationHub';

/**
 * One question decides which of the four editors opens: what should set it off?
 *
 * Everything after that question — who receives it, which channels it goes out
 * on — is the same in all four, so the chooser asks only the part that differs
 * and names each kind by its trigger rather than by its table.
 */

const OPTIONS: Array<{
  id: HubKind;
  title: string;
  blurb: string;
  example: string;
  next: string;
  icon: typeof Bell;
  tone: string;
}> = [
  {
    id: 'rule',
    title: 'Alert — when something happens',
    blurb: 'The app watches a module and fires the moment something happens there.',
    example: 'An order is placed · a leave request comes in · a day auto-closes',
    next: 'Next: pick the module and the event, then who hears about it.',
    icon: Bell,
    tone: 'text-sky-600',
  },
  {
    id: 'report',
    title: 'Report — on a schedule',
    blurb: 'A report is built and delivered on a clock you set.',
    example: 'Yesterday’s sales, every weekday at 09:30',
    next: 'Next: build the report, set the clock, choose the channels.',
    icon: Clock,
    tone: 'text-emerald-600',
  },
  {
    id: 'broadcast',
    title: 'Announcement — right now, once',
    blurb: 'You write a message and it goes out immediately. Nothing is stored as a rule.',
    example: '“Van service tomorrow — plan your beat around a 2pm start.”',
    next: 'Next: write it, pick who it reaches, send.',
    icon: Megaphone,
    tone: 'text-amber-600',
  },
  {
    id: 'banner',
    title: 'Banner — when a period closes',
    blurb: 'A standing board built automatically at the end of a week or a month.',
    example: 'The leaderboard podium',
    next: 'Next: review the podiums already built and their schedule.',
    icon: Trophy,
    tone: 'text-violet-600',
  },
];

export function NewNotificationDialog({
  open, onOpenChange, onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (kind: HubKind) => void;
}) {
  const [chosen, setChosen] = useState<HubKind>('rule');
  const picked = OPTIONS.find(o => o.id === chosen)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New notification</DialogTitle>
          <DialogDescription>
            One question decides everything else: what should set it off?
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map(o => {
            const Icon = o.icon;
            const active = chosen === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setChosen(o.id)}
                onDoubleClick={() => onPick(o.id)}
                aria-pressed={active}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon size={15} className={o.tone} />
                  <span className="text-[13.5px] font-semibold">{o.title}</span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{o.blurb}</p>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground/80">{o.example}</p>
              </button>
            );
          })}
        </div>

        {/* The three steps that are identical whichever kind is chosen. Saying so
            here is what makes one hub honest rather than four screens in a trench coat. */}
        <div className="rounded-lg border bg-muted/30 p-3 text-[12px] text-muted-foreground">
          <p className="font-medium text-foreground">{picked.next}</p>
          <p className="mt-1">
            Then the same two questions as every other kind: <strong>who gets it</strong> — named
            people, a role, everyone under a manager, or an address that is not a user — and{' '}
            <strong>how it arrives</strong> — in the app, as a phone push, by email, or on WhatsApp.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onPick(chosen)}>Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
