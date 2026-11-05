import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RetailerLoyaltyModal } from "./RetailerLoyaltyModal";

interface LoyaltyPointsBadgeProps {
  retailerId: string;
  retailerName?: string;
  showModal?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LoyaltyPointsBadge({ 
  retailerId, 
  retailerName,
  showModal = true,
  size = "md" 
}: LoyaltyPointsBadgeProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: totalPoints = 0 } = useQuery({
    queryKey: ["retailer-loyalty-points", retailerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select("points")
        .eq("retailer_id", retailerId);
      
      if (error) throw error;
      return data?.reduce((sum, p) => sum + p.points, 0) || 0;
    },
    enabled: !!retailerId,
  });

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSize = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const handleClick = (e: React.MouseEvent) => {
    if (showModal) {
      e.stopPropagation();
      setIsModalOpen(true);
    }
  };

  if (totalPoints === 0) return null;

  return (
    <>
      <Badge
        variant="secondary"
        className={`${sizeClasses[size]} bg-yellow-100 text-yellow-800 hover:bg-yellow-200 cursor-pointer flex items-center gap-1`}
        onClick={handleClick}
      >
        <Star className={`${iconSize[size]} text-yellow-600 fill-yellow-500`} />
        <span className="font-semibold">{totalPoints.toLocaleString()}</span>
        <span className="hidden sm:inline">pts</span>
      </Badge>

      {showModal && (
        <RetailerLoyaltyModal
          retailerId={retailerId}
          retailerName={retailerName}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
