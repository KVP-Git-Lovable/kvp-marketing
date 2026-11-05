import { supabase } from "@/integrations/supabase/client";

interface ReservationItem {
  product_id: string;
  quantity: number;
}

interface ReservationResult {
  success: boolean;
  error?: string;
  reservedItems?: ReservationItem[];
  shortItems?: { product_id: string; requested: number; available: number }[];
}

/**
 * Reserve stock from distributor inventory for a packing list
 * This moves stock from available to reserved
 */
export async function reserveStockForPackingList(
  distributorId: string,
  packingListId: string,
  items: ReservationItem[]
): Promise<ReservationResult> {
  try {
    const reservedItems: ReservationItem[] = [];
    const shortItems: { product_id: string; requested: number; available: number }[] = [];

    for (const item of items) {
      // Get current inventory
      const { data: inventory, error: fetchError } = await supabase
        .from('distributor_inventory')
        .select('id, quantity, reserved_quantity, available_quantity')
        .eq('distributor_id', distributorId)
        .eq('product_id', item.product_id)
        .single();

      if (fetchError || !inventory) {
        shortItems.push({
          product_id: item.product_id,
          requested: item.quantity,
          available: 0
        });
        continue;
      }

      const availableQty = inventory.available_quantity || 
        (inventory.quantity - (inventory.reserved_quantity || 0));

      if (availableQty < item.quantity) {
        shortItems.push({
          product_id: item.product_id,
          requested: item.quantity,
          available: availableQty
        });
        // Reserve what's available
        if (availableQty > 0) {
          const { error: updateError } = await supabase
            .from('distributor_inventory')
            .update({
              reserved_quantity: (inventory.reserved_quantity || 0) + availableQty
            })
            .eq('id', inventory.id);

          if (!updateError) {
            reservedItems.push({ product_id: item.product_id, quantity: availableQty });
          }
        }
      } else {
        // Reserve full quantity
        const { error: updateError } = await supabase
          .from('distributor_inventory')
          .update({
            reserved_quantity: (inventory.reserved_quantity || 0) + item.quantity
          })
          .eq('id', inventory.id);

        if (!updateError) {
          reservedItems.push(item);
        }
      }
    }

    return {
      success: shortItems.length === 0,
      reservedItems,
      shortItems: shortItems.length > 0 ? shortItems : undefined
    };
  } catch (error) {
    console.error('Error reserving stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reserve stock'
    };
  }
}

/**
 * Release reserved stock back to available (e.g., when packing list is cancelled)
 */
export async function releaseReservedStock(
  distributorId: string,
  packingListId: string,
  items: ReservationItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const item of items) {
      const { data: inventory, error: fetchError } = await supabase
        .from('distributor_inventory')
        .select('id, reserved_quantity')
        .eq('distributor_id', distributorId)
        .eq('product_id', item.product_id)
        .single();

      if (fetchError || !inventory) continue;

      const newReserved = Math.max(0, (inventory.reserved_quantity || 0) - item.quantity);

      await supabase
        .from('distributor_inventory')
        .update({ reserved_quantity: newReserved })
        .eq('id', inventory.id);
    }

    return { success: true };
  } catch (error) {
    console.error('Error releasing reserved stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release reserved stock'
    };
  }
}

/**
 * Transfer reserved stock to van stock when dispatching
 * Note: Actual van stock integration is handled by vanStockSync utilities
 */
export async function transferReservedToVanStock(
  distributorId: string,
  packingListId: string,
  agentId: string,
  items: ReservationItem[],
  stockDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const item of items) {
      // Reduce from distributor inventory
      const { data: inventory } = await supabase
        .from('distributor_inventory')
        .select('id, quantity, reserved_quantity')
        .eq('distributor_id', distributorId)
        .eq('product_id', item.product_id)
        .single();

      if (inventory) {
        await supabase
          .from('distributor_inventory')
          .update({
            quantity: Math.max(0, inventory.quantity - item.quantity),
            reserved_quantity: Math.max(0, (inventory.reserved_quantity || 0) - item.quantity)
          })
          .eq('id', inventory.id);
      }
    }

    // Van stock transfer is handled by existing vanStockSync utilities
    return { success: true };
  } catch (error) {
    console.error('Error transferring stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to transfer stock'
    };
  }
}

/**
 * Deduct stock from van after delivery
 * Note: This is a simplified version - actual implementation uses vanStockSync
 */
export async function deductVanStockAfterDelivery(
  agentId: string,
  stockDate: string,
  deliveredItems: ReservationItem[]
): Promise<{ success: boolean; error?: string }> {
  // Stock deduction is handled by the existing vanStockSync utilities
  // This function serves as a placeholder for the delivery workflow
  console.log('Delivery completed for agent:', agentId, 'items:', deliveredItems.length);
  return { success: true };
}

/**
 * Calculate aggregated product quantities from orders
 */
export function aggregateOrderItems(
  orders: Array<{ items: Array<{ product_id: string; product_name: string; quantity: number; unit?: string }> }>
): Array<{ product_id: string; product_name: string; quantity: number; unit?: string }> {
  const aggregated = new Map<string, { product_id: string; product_name: string; quantity: number; unit?: string }>();

  for (const order of orders) {
    for (const item of order.items || []) {
      const existing = aggregated.get(item.product_id);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        aggregated.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit: item.unit
        });
      }
    }
  }

  return Array.from(aggregated.values());
}
