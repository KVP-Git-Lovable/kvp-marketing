import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetailerAction } from '@/utils/deleteDistributor';

/**
 * What to do with a distributor's retailers before deleting it.
 *
 * There are two choices and not three. Deleting the retailers outright is not
 * offered because the database will not do it: a retailer that has ever placed
 * an order cannot be deleted at all, and where one could be, the delete takes
 * its ledger, payments, loyalty and audit log with it. Archiving keeps every
 * row and every link to it — which is what "keep the history" has to mean here.
 */

export interface ResolveRetailersTarget {
  id: string;
  name: string;
  retailerCount: number;
}

interface Props {
  target: ResolveRetailersTarget | null;
  /** Distributors the retailers could move to. The one being deleted is filtered out. */
  candidates: { id: string; name: string }[];
  working: boolean;
  onCancel: () => void;
  onConfirm: (action: RetailerAction, reassignTo?: string) => void;
}

export function ResolveRetailersDialog({
  target,
  candidates,
  working,
  onCancel,
  onConfirm,
}: Props) {
  const [action, setAction] = useState<RetailerAction>('reassign');
  const [moveTo, setMoveTo] = useState<string>('');

  if (!target) return null;

  const others = candidates.filter((c) => c.id !== target.id);
  const plural = target.retailerCount === 1 ? 'retailer' : 'retailers';
  const they = target.retailerCount === 1 ? 'it' : 'they';
  const ready = action === 'archive' || (action === 'reassign' && !!moveTo);

  const choice = (
    value: RetailerAction,
    icon: React.ReactNode,
    title: string,
    body: React.ReactNode,
  ) => (
    <label
      className={cn(
        'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
        action === value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
      )}
    >
      <RadioGroupItem value={value} className="mt-1" />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      </div>
    </label>
  );

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !working) onCancel(); }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target.name} has {target.retailerCount} {plural}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {they === 'it' ? 'It has' : 'They have'} to go somewhere before the distributor
            can be deleted. Whichever you choose, every order, invoice and payment already
            recorded against {they} stays exactly as it is.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <RadioGroup
          value={action}
          onValueChange={(v) => setAction(v as RetailerAction)}
          className="gap-2"
        >
          {choice(
            'reassign',
            <ArrowRightLeft className="h-3.5 w-3.5" />,
            'Move them to another distributor',
            <>They carry on as they are, serving a different distributor.</>,
          )}

          {action === 'reassign' && (
            <div className="pl-10">
              <Label className="text-xs">Move to</Label>
              <Select value={moveTo} onValueChange={setMoveTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a distributor" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {others.length === 0 && (
                <p className="mt-1 text-xs text-warning">
                  There is no other distributor to move them to.
                </p>
              )}
            </div>
          )}

          {choice(
            'archive',
            <Archive className="h-3.5 w-3.5" />,
            'Archive them',
            <>
              {they === 'it' ? 'It is' : 'They are'} marked inactive and detached from any
              distributor. The {plural} and {they === 'it' ? 'its' : 'their'} whole history
              stay in the system — nothing is erased. Deleting {they} outright is not
              offered: the database refuses it once there are orders, and would otherwise
              take the ledger and payments with it.
            </>,
          )}
        </RadioGroup>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={working}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!ready || working}
            onClick={() => onConfirm(action, action === 'reassign' ? moveTo : undefined)}
          >
            {working
              ? 'Working…'
              : action === 'reassign'
                ? `Move ${plural} and delete`
                : `Archive ${plural} and delete`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
