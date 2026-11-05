import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Info, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdjustmentInfo {
  holidays: number;
  leaves: number;
  workingDays: number;
  totalDays: number;
  adjustmentMode?: 'redistribute' | 'reduce';
  originalTarget?: number;
  adjustedTarget?: number;
}

interface AdjustmentInfoTooltipProps {
  info: AdjustmentInfo;
  className?: string;
}

export function AdjustmentInfoTooltip({ info, className }: AdjustmentInfoTooltipProps) {
  const hasAdjustments = info.holidays > 0 || info.leaves > 0;
  
  if (!hasAdjustments) {
    return null;
  }

  const adjustmentPercent = info.originalTarget && info.adjustedTarget
    ? ((info.adjustedTarget - info.originalTarget) / info.originalTarget * 100).toFixed(1)
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className={cn('inline-flex items-center gap-1 text-muted-foreground hover:text-foreground', className)}>
            <Info className="h-3.5 w-3.5" />
            {hasAdjustments && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                Adj
              </Badge>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <p className="font-medium">Target Adjustment Details</p>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Working Days:
              </div>
              <div className="font-medium">{info.workingDays} / {info.totalDays}</div>
              
              {info.holidays > 0 && (
                <>
                  <div className="text-muted-foreground">Holidays:</div>
                  <div className="text-orange-600">-{info.holidays} days</div>
                </>
              )}
              
              {info.leaves > 0 && (
                <>
                  <div className="text-muted-foreground">Leaves:</div>
                  <div className="text-blue-600">-{info.leaves} days</div>
                </>
              )}
            </div>

            {info.adjustmentMode && (
              <div className="pt-1 border-t">
                <span className="text-muted-foreground">Mode: </span>
                <span className="capitalize">{info.adjustmentMode}</span>
              </div>
            )}

            {adjustmentPercent && (
              <div className="pt-1 border-t">
                <span className="text-muted-foreground">Change: </span>
                <span className={cn(
                  'font-medium',
                  parseFloat(adjustmentPercent) < 0 ? 'text-red-600' : 'text-green-600'
                )}>
                  {parseFloat(adjustmentPercent) > 0 ? '+' : ''}{adjustmentPercent}%
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
