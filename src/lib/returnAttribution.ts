/**
 * Which returns belong to the distributor whose portal is open.
 *
 * A credit note does not record a distributor. There is no `distributor_id`
 * on `credit_notes`, the originating order carries one only for channels that
 * set it -- field sales leave it null -- and `retailers.distributor_id` is
 * populated for some retailers and not others. So ownership has to be inferred
 * from whatever link exists, and sometimes no link exists at all.
 *
 * The rule here is deliberately one-sided: a return is shown only when it can
 * be positively tied to this distributor. Anything unattributable is withheld.
 * That is the wrong default for completeness and the right one for privacy --
 * these rows carry another distributor's retailer names, credit note numbers
 * and quantities, and the read policy on both tables is currently
 * `USING (true)`, so nothing below this function will catch the mistake.
 *
 * The consequence is visible and intended: a panel that looks emptier than the
 * credit notes suggest is telling you the attribution is missing, not that the
 * returns are.
 */

export interface ReturnOwnershipKeys {
  /**
   * Whose book the note says it belongs to.
   *
   * Written at creation since 28 Oct 2026. When it is set it is the answer and
   * the links below are not consulted -- a note that names a distributor is
   * not someone else's because a retailer later moved. Null on everything
   * raised before that, which is why the links remain.
   */
  distributor_id?: string | null;
  /** The retailer the credit note was raised against, when recorded. */
  retailer_id: string | null | undefined;
  /** The order the credit note was raised from, when recorded. */
  original_order_id: string | null | undefined;
}

/**
 * True when this credit note is positively this distributor's.
 *
 * Either link is enough: a return against our retailer is ours, and so is one
 * against our order. Neither link resolving means unknown, and unknown is
 * withheld rather than shown.
 */
export function isOwnedReturn(
  keys: ReturnOwnershipKeys,
  ownedRetailerIds: ReadonlySet<string>,
  ownedOrderIds: ReadonlySet<string>,
  distributorId?: string | null,
): boolean {
  // A note that records a distributor settles it either way. Falling through
  // to the links would let a retailer reassigned afterwards hand someone
  // else's credit note to this portal.
  if (keys.distributor_id) return keys.distributor_id === distributorId;

  const byRetailer = !!keys.retailer_id && ownedRetailerIds.has(keys.retailer_id);
  const byOrder = !!keys.original_order_id && ownedOrderIds.has(keys.original_order_id);
  return byRetailer || byOrder;
}

/** The subset of `rows` this distributor is entitled to see. */
export function ownedReturns<T extends ReturnOwnershipKeys>(
  rows: readonly T[],
  ownedRetailerIds: ReadonlySet<string>,
  ownedOrderIds: ReadonlySet<string>,
  distributorId?: string | null,
): T[] {
  return rows.filter((r) => isOwnedReturn(r, ownedRetailerIds, ownedOrderIds, distributorId));
}
