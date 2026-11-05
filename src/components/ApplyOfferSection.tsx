import React, { useMemo } from 'react';
import { Gift, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderRow {
  id: string;
  product?: {
    id: string;
    name: string;
  };
  quantity: number;
}

interface Scheme {
  id: string;
  name: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
}

interface ApplyOfferSectionProps {
  schemes: Scheme[];
  orderRows: OrderRow[];
  onClick: () => void;
  loading?: boolean;
}

export const ApplyOfferSection: React.FC<ApplyOfferSectionProps> = ({
  schemes,
  orderRows,
  onClick,
  loading = false
}) => {
  // Count active schemes
  const activeSchemeCount = useMemo(() => {
    const now = new Date();
    return schemes.filter(scheme => {
      if (!scheme.is_active) return false;
      const startDate = scheme.start_date ? new Date(scheme.start_date) : null;
      // Set end_date to end of day (23:59:59) so scheme is valid for the entire day
      let endDate: Date | null = null;
      if (scheme.end_date) {
        endDate = new Date(scheme.end_date);
        endDate.setHours(23, 59, 59, 999);
      }
      if (startDate && now < startDate) return false;
      if (endDate && now > endDate) return false;
      return true;
    }).length;
  }, [schemes]);

  // Check if any order rows have products (to show applicable offers hint)
  const hasProductsInOrder = useMemo(() => {
    return orderRows.some(row => row.product && row.quantity > 0);
  }, [orderRows]);

  if (loading) {
    return (
      <div className="animate-pulse flex items-center gap-2 py-1.5 px-2">
        <div className="w-4 h-4 bg-muted rounded"></div>
        <div className="h-3 bg-muted rounded w-20"></div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 py-1.5 px-2 rounded-md",
        "bg-primary/10 hover:bg-primary/15 border border-primary/20",
        "transition-all duration-150 group"
      )}
    >
      <Gift className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs font-medium text-primary">
        Apply Offers
        {activeSchemeCount > 0 && (
          <span className="ml-1 text-[10px] bg-primary text-primary-foreground px-1 py-0.5 rounded-full">
            {activeSchemeCount}
          </span>
        )}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors" />
    </button>
  );
};
