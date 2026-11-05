import { supabase } from '@/integrations/supabase/client';
import { moveToRecycleBin, removeFromRecycleBin } from '@/utils/recycleBinUtils';
import { describeDeleteBlockers } from '@/utils/distributorDeleteBlockers';

/**
 * Delete a distributor, or explain why it cannot be deleted.
 *
 * One copy, used by the Distributor Master list and the detail screen, so the
 * two cannot drift into disagreeing about what a delete does.
 *
 * Three things have to go right, and each of them failed somewhere before:
 *
 *  - Sixteen tables refuse a delete that would orphan their rows. Asking first
 *    turns a constraint name into a sentence, and keeps the ordinary refusal
 *    away from the recycle bin entirely.
 *  - The row has to actually go. `Field staff can delete distributors` allows
 *    the delete only when the caller does not belong to a distributor, and a
 *    policy that refuses returns no error and no rows — so a delete that
 *    removed nothing used to report success. The deleted row is read back to
 *    tell the difference.
 *  - Nothing was removed on a failure, so the bin entry has to go with it,
 *    or the bin ends up holding records of deletions that never happened.
 */

/**
 * The permission the delete RLS policy asks for, named once so the screens and
 * the database cannot disagree about who may delete.
 *
 * The policy this replaced was called "Field staff can delete distributors" and
 * allowed anyone not belonging to a distributor — 16 of 20 real users, 10 of
 * them field sales executives. `can_delete` on this object is held only by the
 * System Administrator profile, and granting it to another profile is a
 * decision made in the permission screens, not in code.
 */
export const DISTRIBUTOR_DELETE_PERMISSION = {
  object: 'module_distributor_master',
  action: 'delete',
} as const;

export type DeleteDistributorResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

/** What to do with the retailers that are standing in the way. */
export type RetailerAction = 'reassign' | 'archive';

/**
 * Take a distributor out of the network without destroying what it did.
 *
 * The answer to "delete it completely, but keep the history". It cannot truly
 * be deleted once it has traded — 38 foreign keys point at it, 16 refusing the
 * delete and 22 that would destroy inventory, ledgers, payments and warehouses
 * to allow it. The row is a name and a few contact fields, and it is the only
 * thing making all of that history readable. So it stays, and stops being
 * visible: archived distributors drop out of every list, count and picker.
 * Reversible, because nothing was destroyed.
 */
export async function archiveDistributor(
  distributor: { id: string; name: string },
  retailerAction: 'leave' | RetailerAction = 'leave',
  reassignTo?: string,
): Promise<DeleteDistributorResult> {
  const { error } = await supabase.rpc('archive_distributor', {
    p_distributor_id: distributor.id,
    p_retailer_action: retailerAction,
    p_reassign_to: reassignTo ?? null,
  });

  if (!error) return { ok: true };

  const raw = error.message ?? '';
  if (raw.includes('NOT_PERMITTED')) {
    return {
      ok: false,
      reason: `${distributor.name} was not archived — only administrators can do that. Nothing was changed.`,
    };
  }
  return { ok: false, reason: `Could not archive ${distributor.name}: ${raw}` };
}

/** Put an archived distributor back into the network. */
export async function unarchiveDistributor(
  distributor: { id: string; name: string },
): Promise<DeleteDistributorResult> {
  const { error } = await supabase.rpc('unarchive_distributor', {
    p_distributor_id: distributor.id,
  });

  if (!error) return { ok: true };

  const raw = error.message ?? '';
  if (raw.includes('NOT_PERMITTED')) {
    return {
      ok: false,
      reason: `${distributor.name} was not restored — only administrators can do that.`,
    };
  }
  return { ok: false, reason: `Could not restore ${distributor.name}: ${raw}` };
}

/**
 * Clear the retailers out of the way and delete the distributor, in one
 * transaction — so there is no state where the retailers have moved and the
 * distributor is still there.
 *
 * `archive` is not a delete and is not named one on the screen. A retailer
 * cannot be deleted once it has an order, and where it could be, the delete
 * would cascade away its ledger, payments, loyalty and audit log. Keeping the
 * row, detached and marked inactive, is the only form of "remove it" that
 * leaves the history standing.
 */
export async function deleteDistributorWithRetailers(
  distributor: { id: string; name: string },
  action: RetailerAction,
  reassignTo?: string,
): Promise<DeleteDistributorResult> {
  const { error } = await supabase.rpc('delete_distributor_with_retailers', {
    p_distributor_id: distributor.id,
    p_retailer_action: action,
    p_reassign_to: reassignTo ?? null,
  });

  if (!error) return { ok: true };

  // The function raises named errors rather than letting a constraint surface,
  // so each one can be said in words here.
  const raw = error.message ?? '';

  if (raw.includes('NOT_PERMITTED')) {
    return {
      ok: false,
      reason: `${distributor.name} was not deleted — only administrators can remove a distributor. Nothing was changed.`,
    };
  }
  if (raw.includes('STILL_BLOCKED')) {
    return {
      ok: false,
      reason:
        `${distributor.name} still has other things attached, so nothing was changed. ` +
        `Open it to see what is left.`,
    };
  }
  if (raw.includes('BAD_TARGET') || raw.includes('NO_SUCH_TARGET')) {
    return { ok: false, reason: 'Choose which distributor the retailers should move to.' };
  }

  return { ok: false, reason: `Failed to delete ${distributor.name}: ${raw}` };
}

export async function deleteDistributor(distributor: {
  id: string;
  name: string;
}): Promise<DeleteDistributorResult> {
  let binEntryId: string | null = null;

  try {
    const blocked = await describeDeleteBlockers(distributor.id, distributor.name);
    if (blocked) return { ok: false, reason: blocked };

    binEntryId = await moveToRecycleBin({
      tableName: 'distributors',
      recordId: distributor.id,
      recordData: distributor,
      moduleName: 'Distributors',
      recordName: distributor.name,
    });

    // select() so the deleted row comes back: without it a delete that removed
    // nothing is indistinguishable from one that worked.
    const { data, error } = await supabase
      .from('distributors')
      .delete()
      .eq('id', distributor.id)
      .select('id');

    if (error) throw error;

    if (!data || data.length === 0) {
      if (binEntryId) await removeFromRecycleBin(binEntryId);
      return {
        ok: false,
        reason:
          `${distributor.name} was not deleted — only administrators can remove a ` +
          `distributor. Nothing was changed.`,
      };
    }

    return { ok: true };
  } catch (error: unknown) {
    if (binEntryId) await removeFromRecycleBin(binEntryId);
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `Failed to delete ${distributor.name}: ${message}` };
  }
}
