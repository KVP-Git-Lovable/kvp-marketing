import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Archive } from 'lucide-react';

/**
 * What to do with a distributor that cannot be deleted.
 *
 * The things in the way are usually its goods receipt notes, invoices, returns
 * and stock — the record of what it actually did. Deleting the distributor
 * would take them with it by cascade, so the database refusing is the right
 * answer, not an obstacle to work around.
 *
 * Archiving is the real counterpart to deleting for a distributor that has
 * traded: it drops out of every list, count and picker, and every record it is
 * named in still makes sense. Nothing is destroyed, so it can come back.
 */

export interface CannotDeleteTarget {
  id: string;
  name: string;
  /** The sentence naming what is in the way. */
  reason: string;
  /** Already archived, so there is nothing further to offer. */
  alreadyInactive: boolean;
}

interface Props {
  target: CannotDeleteTarget | null;
  working: boolean;
  onCancel: () => void;
  onArchive: () => void;
}

export function CannotDeleteDialog({ target, working, onCancel, onArchive }: Props) {
  if (!target) return null;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !working) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{target.name} cannot be deleted</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{target.reason}</p>
              <p>
                Those are the record of what this distributor did. Deleting it would take
                them with it, so they are worth more than the empty row.
              </p>
              {!target.alreadyInactive && (
                <p>
                  Archiving is what is wanted instead: it disappears from every list, count
                  and picker here, while every order, invoice and stock movement it is
                  named in stays exactly as it is. Nothing is destroyed, so you can bring
                  it back at any time.
                </p>
              )}
              {target.alreadyInactive && (
                <p>This distributor is already archived, so there is nothing further to do here.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={working}>Close</Button>
          {!target.alreadyInactive && (
            <Button onClick={onArchive} disabled={working} className="gap-2">
              <Archive className="h-4 w-4" />
              {working ? 'Archiving…' : 'Archive instead'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
