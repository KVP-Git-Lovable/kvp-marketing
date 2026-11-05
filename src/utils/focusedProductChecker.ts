/**
 * Utility to check if a focused product is currently active based on its schedule
 */

interface FocusedProductConfig {
  is_focused_product?: boolean;
  focused_type?: string | null;
  focused_due_date?: string | null;
  focused_recurring_config?: any;
  focused_territories?: string[] | null;
}

/**
 * Check if a focused product is currently active based on its schedule configuration
 */
export const isFocusedProductActive = (product: FocusedProductConfig): boolean => {
  // If not marked as focused, return false
  if (!product.is_focused_product) {
    return false;
  }

  // If no type specified, assume it's active (backward compatibility)
  if (!product.focused_type) {
    return true;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (product.focused_type) {
    case 'fixed':
      // Check if we're within the fixed date
      if (!product.focused_due_date) return false;
      const dueDate = new Date(product.focused_due_date);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      return today <= dueDateOnly;

    case 'recurring':
      // Check recurring configuration
      if (!product.focused_recurring_config) return false;
      return isRecurringActive(product.focused_recurring_config);

    case 'open':
      // Always active for open-ended focused products
      return true;

    default:
      return true;
  }
};

/**
 * Check if a recurring schedule is active today
 */
const isRecurringActive = (config: any): boolean => {
  const now = new Date();
  const recurringType = config.recurringType;

  switch (recurringType) {
    case 'daysOfWeek':
      // Check if today's day of week is in the selected days
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
      return config.selectedDays?.includes(dayOfWeek) || false;

    case 'weeksOfMonth':
      // Check if current week of month is in the selected weeks
      const weekOfMonth = Math.ceil(now.getDate() / 7);
      return config.selectedWeeks?.includes(`Week ${weekOfMonth}`) || false;

    case 'monthsOfYear':
      // Check if current month is in the selected months
      const monthOfYear = now.toLocaleDateString('en-US', { month: 'long' });
      return config.selectedMonths?.includes(monthOfYear) || false;

    default:
      return false;
  }
};
