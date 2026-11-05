import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface VisitPointsEntry {
  gameName: string;
  actionName: string;
  points: number;
}

export interface VisitPointsBreakdown {
  totalPoints: number;
  entries: VisitPointsEntry[];
}

interface VisitPointsDisplayProps {
  /**
   * Pre-fetched points breakdown for this retailer/date.
   * Comes from useVisitsDataOptimized.pointsData.byRetailer — no extra DB call here.
   */
  breakdown?: VisitPointsBreakdown | null;
  className?: string;
}

const formatPoints = (n: number) => {
  // Show up to 2 decimals, trim trailing zeros (0.75 → "0.75", 3 → "3")
  return Number(n.toFixed(2)).toString();
};

export function VisitPointsDisplay({ breakdown, className }: VisitPointsDisplayProps) {
  if (!breakdown || breakdown.totalPoints <= 0 || breakdown.entries.length === 0) {
    return null;
  }

  const total = breakdown.totalPoints;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-full"
          aria-label={`Points earned: ${formatPoints(total)}. Tap for breakdown.`}
        >
          <Badge
            variant="secondary"
            className={`bg-gradient-to-r from-amber-500/10 to-yellow-500/10 text-amber-600 border-amber-500/20 hover:from-amber-500/20 hover:to-yellow-500/20 cursor-pointer text-xs px-2 py-1 ${className ?? ""}`}
          >
            <TrendingUp className="w-3 h-3 mr-1" />
            +{formatPoints(total)} pts
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-0 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Points Breakdown</span>
            <span className="text-sm font-bold text-amber-700">+{formatPoints(total)} pts</span>
          </div>
        </div>
        <ul className="max-h-60 overflow-y-auto divide-y">
          {breakdown.entries.map((entry, idx) => (
            <li
              key={`${entry.gameName}-${entry.actionName}-${idx}`}
              className="px-3 py-2 flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-foreground truncate" title={entry.gameName}>
                  {entry.gameName}
                </div>
                {entry.actionName && entry.actionName !== entry.gameName && (
                  <div className="text-[10px] text-muted-foreground truncate" title={entry.actionName}>
                    {entry.actionName}
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-amber-600 shrink-0">
                +{formatPoints(entry.points)}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}