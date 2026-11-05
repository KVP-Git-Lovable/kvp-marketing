import { Button } from '@/components/ui/button';
import { fullNameProps } from "@/lib/displayName";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Edit, Trash2, Archive, ArchiveRestore, Eye, EyeOff,
  Phone, Mail, MapPin, FileText, Users, ChevronRight, Network, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DistributorType } from '@/hooks/useDistributorTypes';
import { resolveTypeCode } from '@/hooks/useDistributorTypes';

/**
 * Everything about the distributor picked in the tree.
 *
 * The figures come from distributor_network_summary rather than being counted
 * in the browser, because retailers_select scopes rows to the viewer's own
 * beats — counting here reports 0 for a distributor with ten, which is the bug
 * that sent someone deleting a distributor the database then refused.
 */

export interface DetailRow {
  id: string;
  name: string;
  parent_id: string | null;
  type_id: string | null;
  distribution_level: string | null;
  status: string;
  archived_at: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  partnership_status: string | null;
}

export interface NetworkCounts {
  retailers: number;
  warehouses: number;
  orders_placed: number;
  children: number;
}

interface Props {
  row: DetailRow | null;
  parent: DetailRow | null;
  children: DetailRow[];
  counts?: NetworkCounts;
  types: DistributorType[];
  canDelete: boolean;
  isHidden: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onToggleHidden: () => void;
}

function Figure({ value, label, muted }: { value: number; label: string; muted?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div
          className={cn(
            'text-2xl font-bold leading-none tabular-nums tracking-tight',
            muted && 'text-muted-foreground/50',
          )}
        >
          {value.toLocaleString('en-IN')}
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export function DistributorDetailPane({
  row, parent, children, counts, types,
  canDelete, isHidden, busy,
  onOpen, onSelect, onEdit, onDelete, onArchive, onRestore, onToggleHidden,
}: Props) {
  if (!row) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center p-8">
        <div className="text-center">
          <Network className="mx-auto mb-3 h-9 w-9 text-muted-foreground/40" />
          <p className="text-sm font-medium">Pick a distributor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose one from the network to see what it serves and what sits under it.
          </p>
        </div>
      </div>
    );
  }

  const typeCode = resolveTypeCode(row, types);
  const typeName = types.find((t) => t.code === typeCode)?.name;
  const c = counts ?? { retailers: 0, warehouses: 0, orders_placed: 0, children: 0 };

  return (
    <div className="space-y-6 p-5 sm:p-6">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* The name is the way into the full record. Underlined at rest
                rather than on hover: a link that only appears when the pointer
                crosses it is invisible to anyone who does not happen to pass
                over it, and invisible on touch altogether. */}
            <h2 className="min-w-0 max-w-full text-xl font-bold tracking-tight">
              <button
                type="button"
                onClick={() => onOpen(row.id)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-sm underline decoration-muted-foreground/40 decoration-2 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="truncate" {...fullNameProps(row.name)} />
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only">— open the full record</span>
              </button>
            </h2>
            {row.archived_at ? (
              <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300">
                <Archive className="h-3 w-3" /> Archived
              </Badge>
            ) : (
              <Badge variant="secondary" className="capitalize">{row.status}</Badge>
            )}
            {typeName ? (
              <Badge variant="outline">{typeName}</Badge>
            ) : (
              <Badge variant="outline" className="text-warning">No type set</Badge>
            )}
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">
            {parent ? (
              <>
                Under{' '}
                <button
                  type="button"
                  onClick={() => onSelect(parent.id)}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  <span {...fullNameProps(parent.name)} />
                </button>
              </>
            ) : typeCode === 'OEM' ? (
              'The company at the top of the network'
            ) : (
              <span className="font-medium text-warning">Not linked to the company</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Edit className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onToggleHidden}>
            {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {isHidden ? 'Unhide' : 'Hide'}
          </Button>
          {canDelete && row.archived_at && (
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={onRestore}>
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </Button>
          )}
          {canDelete && !row.archived_at && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Figure value={c.retailers} label="Retailers served" muted={c.retailers === 0} />
        <Figure value={c.children} label={c.children === 1 ? 'Distributor under it' : 'Distributors under it'} muted={c.children === 0} />
        <Figure value={c.warehouses} label={c.warehouses === 1 ? 'Warehouse' : 'Warehouses'} muted={c.warehouses === 0} />
        <Figure value={c.orders_placed} label="Primary orders placed" muted={c.orders_placed === 0} />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Contact
        </h3>
        <Card>
          <CardContent className="space-y-2.5 p-4 text-sm">
            {row.contact_person && (
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{row.contact_person}</span>
              </div>
            )}
            {row.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`tel:${row.phone}`} className="text-primary">{row.phone}</a>
              </div>
            )}
            {row.email && (
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${row.email}`} className="text-primary">{row.email}</a>
              </div>
            )}
            {row.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{row.address}</span>
              </div>
            )}
            {row.gst_number && (
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">GST: {row.gst_number}</span>
              </div>
            )}
            {!row.contact_person && !row.phone && !row.email && !row.address && (
              <p className="text-muted-foreground">No contact details recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {children.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Directly beneath it
          </h3>
          <Card>
            <CardContent className="divide-y p-0">
              {/* Same rule as the heading: the name opens the record. The
                  chevron is the other thing you might want — moving the
                  selection without leaving the page. Two sibling buttons
                  rather than one inside the other, which is not valid markup
                  and leaves the inner one unreachable by keyboard. */}
              {children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(child.id)}
                    className="min-w-0 flex-1 truncate rounded-sm text-left text-sm font-medium underline decoration-muted-foreground/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="truncate" {...fullNameProps(child.name)} />
                    <span className="sr-only">— open the full record</span>
                  </button>
                  {child.archived_at && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">Archived</Badge>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {types.find((t) => t.code === resolveTypeCode(child, types))?.name ?? 'No type'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(child.id)}
                    aria-label={`Show ${child.name} in the network`}
                    className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
