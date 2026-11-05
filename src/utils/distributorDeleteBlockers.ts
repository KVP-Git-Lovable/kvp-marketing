import { supabase } from '@/integrations/supabase/client';

/**
 * Why a distributor cannot be deleted, said in words.
 *
 * Sixteen tables reference `distributors` with a blocking foreign key, so a
 * delete that would orphan their rows is refused by the database. That refusal
 * is right — losing the distributor behind 224 retailers would strand all of
 * them — but it arrives as `violates foreign key constraint
 * retailers_distributor_id_fkey on table retailers`, which does not tell anyone
 * what to do about it.
 *
 * The counting is done by `distributor_delete_blockers`, which reads the foreign
 * keys from the catalog rather than from a list, so a table added later is
 * picked up without this file being reopened.
 */

export interface Blocker {
  referencing_table: string;
  referencing_column: string;
  row_count: number;
  /** Up to three names, when the blocking table has any and there are few
   *  enough to list. Null for invoices and notes, which go by number. */
  sample_names?: string | null;
  /** The table the obstacle hangs off, when it is not the distributor itself.
   *  Deleting a distributor cascades into its warehouses, and the warehouses
   *  are what the inventory actually blocks — without saying so, "5 inventory
   *  batches" has no visible connection to the distributor being deleted. */
  via?: string | null;
}

/** What each table is called when it is standing in the way. [singular, plural] */
const LABELS: Record<string, [string, string]> = {
  retailers: ['retailer', 'retailers'],
  distributors: ['distributor under it', 'distributors under it'],
  beats: ['beat', 'beats'],
  vans: ['van', 'vans'],
  warehouses: ['warehouse', 'warehouses'],
  packing_lists: ['packing list', 'packing lists'],
  goods_receipt_notes: ['goods receipt note', 'goods receipt notes'],
  primary_orders: ['primary order', 'primary orders'],
  primary_invoices: ['primary invoice', 'primary invoices'],
  primary_shipments: ['shipment', 'shipments'],
  primary_return_notes: ['return note', 'return notes'],
  delivery_challans: ['delivery challan', 'delivery challans'],
  eway_bills: ['e-way bill', 'e-way bills'],
  van_stock: ['van stock record', 'van stock records'],
  distributor_inventory: ['stock record', 'stock records'],
  distributor_inventory_transactions: ['stock movement', 'stock movements'],
  inventory_batches: ['batch', 'batches'],
  distributor_claims: ['claim', 'claims'],
  distributor_ideas: ['idea', 'ideas'],
  distributor_support_requests: ['support request', 'support requests'],
};

/** "10 retailers", "1 packing list", or the raw table name if it is unknown.
 *
 *  Names come along when the database supplied them. "1 distributor under it"
 *  sends someone hunting for which one — and the child that prompted this was
 *  hidden from the Distributor Master list, so it could not be found by
 *  looking. */
function phrase(b: Blocker): string {
  const label = LABELS[b.referencing_table];
  let out = label
    ? `${b.row_count} ${b.row_count === 1 ? label[0] : label[1]}`
    : `${b.row_count} × ${b.referencing_table.replace(/_/g, ' ')}`;

  return b.sample_names ? `${out} (${b.sample_names})` : out;
}

/** The plural of whatever the obstacles hang off. */
function viaLabel(via: string): string {
  return LABELS[via] ? LABELS[via][1] : via.replace(/_/g, ' ');
}

/** Joins with commas and a final "and", so the sentence reads as one. */
function list(parts: string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * A sentence naming everything in the way, or null when nothing is.
 *
 * Kept separate from the query so the wording can be tested without a database.
 */
export function describeBlockers(blockers: Blocker[], distributorName: string): string | null {
  if (blockers.length === 0) return null;

  // Biggest obstacle first — it is usually the one that takes real work to
  // clear, and the only one worth reading if the list is long.
  const sorted = blockers.slice().sort((a, b) => b.row_count - a.row_count);

  // Grouped by what they hang off, so "under its warehouses" is said once
  // rather than after every one of the three inventory tables.
  const segments: string[] = [];

  const direct = sorted.filter((b) => !b.via);
  if (direct.length > 0) segments.push(list(direct.map(phrase)));

  const groups = new Map<string, Blocker[]>();
  for (const b of sorted) {
    if (!b.via) continue;
    const group = groups.get(b.via);
    if (group) group.push(b);
    else groups.set(b.via, [b]);
  }
  for (const [via, group] of groups) {
    segments.push(`${list(group.map(phrase))} under its ${viaLabel(via)}`);
  }

  const reassign = blockers.some((b) => b.referencing_table === 'retailers')
    ? ' Use Remap on the Distributor Master to move the retailers first.'
    : '';

  return `${distributorName} still has ${segments.join(', plus ')}, so it cannot be deleted.${reassign}`;
}

/**
 * Everything standing in the way, as rows.
 *
 * Returns an empty list on an unexpected error: the delete is then attempted
 * and the database refuses it as it always did. Better a raw message than a
 * wrong claim that something is blocked.
 */
export async function fetchDeleteBlockers(distributorId: string): Promise<Blocker[]> {
  const { data, error } = await supabase.rpc('distributor_delete_blockers', {
    p_distributor_id: distributorId,
  });

  if (error) {
    console.error('Could not check what blocks the delete:', error);
    return [];
  }

  return (data ?? []) as Blocker[];
}

/** The retailers attached directly to the distributor, if they are in the way.
 *
 *  Only the direct ones: retailers reached through something else are not
 *  resolved by moving this distributor's own retailers. */
export function retailerBlocker(blockers: Blocker[]): Blocker | undefined {
  return blockers.find((b) => b.referencing_table === 'retailers' && !b.via);
}

/**
 * A sentence naming everything in the way, or null when the delete can proceed.
 */
export async function describeDeleteBlockers(
  distributorId: string,
  distributorName: string,
): Promise<string | null> {
  return describeBlockers(await fetchDeleteBlockers(distributorId), distributorName);
}
