// Retailer Status Registry - Tracks which retailers need status refresh
// Only retailers with actual backend changes will be marked for refresh

type StatusChangeCallback = (retailerId: string) => void;

class RetailerStatusRegistry {
  private pendingRefreshRetailers: Set<string> = new Set();
  private listeners: Map<string, StatusChangeCallback> = new Map();
  private initialCheckDone: Set<string> = new Set();

  // Register a retailer card to listen for changes
  register(retailerId: string, callback: StatusChangeCallback): () => void {
    this.listeners.set(retailerId, callback);
    
    // CRITICAL FIX: If this retailer is already marked for refresh, 
    // immediately notify the callback so newly mounted cards get updated
    if (this.pendingRefreshRetailers.has(retailerId)) {
      console.log(`[StatusRegistry] Retailer ${retailerId} has pending refresh on register - notifying immediately`);
      // Use setTimeout to ensure state is fully initialized before callback
      setTimeout(() => callback(retailerId), 0);
    }
    
    // Return unregister function
    return () => {
      this.listeners.delete(retailerId);
      this.initialCheckDone.delete(retailerId);
    };
  }

  // Mark initial status check as done for a retailer
  markInitialCheckDone(retailerId: string): void {
    this.initialCheckDone.add(retailerId);
  }

  // Check if initial status check is done for a retailer
  hasInitialCheckDone(retailerId: string): boolean {
    return this.initialCheckDone.has(retailerId);
  }

  // Mark a specific retailer as needing refresh (called after order/no-order submission)
  markForRefresh(retailerId: string): void {
    console.log(`[StatusRegistry] Marking retailer ${retailerId} for refresh`);
    this.pendingRefreshRetailers.add(retailerId);
    
    // Notify the specific retailer card if registered
    const callback = this.listeners.get(retailerId);
    if (callback) {
      console.log(`[StatusRegistry] Notifying retailer ${retailerId} to refresh`);
      callback(retailerId);
    }
  }

  // Mark multiple retailers for refresh
  markMultipleForRefresh(retailerIds: string[]): void {
    retailerIds.forEach(id => this.markForRefresh(id));
  }

  // Check if a retailer needs refresh
  needsRefresh(retailerId: string): boolean {
    return this.pendingRefreshRetailers.has(retailerId);
  }

  // Clear refresh flag after successful refresh
  clearRefreshFlag(retailerId: string): void {
    this.pendingRefreshRetailers.delete(retailerId);
  }

  // Clear all pending refreshes
  clearAll(): void {
    this.pendingRefreshRetailers.clear();
  }

  // Get all retailers pending refresh
  getPendingRefreshRetailers(): string[] {
    return Array.from(this.pendingRefreshRetailers);
  }

  // Reset for date change - clears initial check flags
  resetForDateChange(): void {
    this.initialCheckDone.clear();
    this.pendingRefreshRetailers.clear();
    console.log('[StatusRegistry] Reset for date change');
  }
}

export const retailerStatusRegistry = new RetailerStatusRegistry();
