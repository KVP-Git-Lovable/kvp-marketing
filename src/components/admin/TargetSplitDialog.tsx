import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Equal, Percent, Edit3, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SplitMode = 'even' | 'percentage' | 'manual';

interface ChildAllocation {
  userId: string;
  fullName: string;
  profilePictureUrl: string | null;
  quantityTarget: number;
  revenueTarget: number;
  visitsTarget: number;
  percentage: number;
}

interface TargetSplitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managerName: string;
  managerQuantityTarget: number;
  managerRevenueTarget: number;
  managerVisitsTarget: number;
  quantityUnit: string;
  enabledMetrics: {
    quantity: boolean;
    revenue: boolean;
    visits: boolean;
  };
  children: ChildAllocation[];
  onApply: (updatedChildren: ChildAllocation[]) => void;
}

const formatNumber = (num: number) => new Intl.NumberFormat('en-IN').format(num);
const formatCurrency = (num: number) => {
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${formatNumber(num)}`;
};
const parseNumber = (value: string) => {
  const num = parseFloat(value.replace(/,/g, ''));
  return isNaN(num) ? 0 : num;
};
const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export function TargetSplitDialog({
  open,
  onOpenChange,
  managerName,
  managerQuantityTarget,
  managerRevenueTarget,
  managerVisitsTarget,
  quantityUnit,
  enabledMetrics,
  children: initialChildren,
  onApply,
}: TargetSplitDialogProps) {
  const [splitMode, setSplitMode] = useState<SplitMode>('manual');
  const [localChildren, setLocalChildren] = useState<ChildAllocation[]>([]);

  useEffect(() => {
    if (open) {
      setLocalChildren(initialChildren.map(c => ({ ...c })));
    }
  }, [open, initialChildren]);

  const applyEvenSplit = () => {
    const count = localChildren.length;
    if (count === 0) return;
    setLocalChildren(prev =>
      prev.map(c => ({
        ...c,
        quantityTarget: enabledMetrics.quantity ? Math.floor(managerQuantityTarget / count) : 0,
        revenueTarget: enabledMetrics.revenue ? Math.floor(managerRevenueTarget / count) : 0,
        visitsTarget: enabledMetrics.visits ? Math.floor(managerVisitsTarget / count) : 0,
        percentage: Math.round((100 / count) * 100) / 100,
      }))
    );
  };

  const applyPercentageSplit = () => {
    setLocalChildren(prev =>
      prev.map(c => ({
        ...c,
        quantityTarget: enabledMetrics.quantity ? Math.round(managerQuantityTarget * (c.percentage / 100)) : 0,
        revenueTarget: enabledMetrics.revenue ? Math.round(managerRevenueTarget * (c.percentage / 100)) : 0,
        visitsTarget: enabledMetrics.visits ? Math.round(managerVisitsTarget * (c.percentage / 100)) : 0,
      }))
    );
  };

  useEffect(() => {
    if (splitMode === 'even') applyEvenSplit();
  }, [splitMode]);

  const handleFieldChange = (idx: number, field: keyof ChildAllocation, value: number) => {
    setLocalChildren(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const totals = useMemo(() => {
    const qty = localChildren.reduce((s, c) => s + c.quantityTarget, 0);
    const rev = localChildren.reduce((s, c) => s + c.revenueTarget, 0);
    const vis = localChildren.reduce((s, c) => s + c.visitsTarget, 0);
    const pct = localChildren.reduce((s, c) => s + c.percentage, 0);
    return { qty, rev, vis, pct };
  }, [localChildren]);

  const remainQty = managerQuantityTarget - totals.qty;
  const remainRev = managerRevenueTarget - totals.rev;
  const remainVis = managerVisitsTarget - totals.vis;
  const hasOver = (enabledMetrics.quantity && remainQty < 0) ||
    (enabledMetrics.revenue && remainRev < 0) ||
    (enabledMetrics.visits && remainVis < 0);
  const isFullyDistributed = (!enabledMetrics.quantity || remainQty === 0) &&
    (!enabledMetrics.revenue || remainRev === 0) &&
    (!enabledMetrics.visits || remainVis === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Targets — {managerName}</DialogTitle>
          <DialogDescription>
            Distribute {managerName}'s targets to their direct reports.
          </DialogDescription>
        </DialogHeader>

        {/* Manager's target summary */}
        <div className="flex flex-wrap gap-3 p-3 bg-muted/40 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground">Manager Target:</span>
          {enabledMetrics.quantity && (
            <Badge variant="outline" className="font-mono">
              {formatNumber(managerQuantityTarget)} {quantityUnit}
            </Badge>
          )}
          {enabledMetrics.revenue && (
            <Badge variant="outline" className="font-mono">
              {formatCurrency(managerRevenueTarget)}
            </Badge>
          )}
          {enabledMetrics.visits && (
            <Badge variant="outline" className="font-mono">
              {formatNumber(managerVisitsTarget)} visits
            </Badge>
          )}
        </div>

        {/* Split mode toggle */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Mode:</span>
          <ToggleGroup
            type="single"
            value={splitMode}
            onValueChange={(v) => v && setSplitMode(v as SplitMode)}
            size="sm"
            className="bg-muted/50 p-0.5 rounded-lg"
          >
            <ToggleGroupItem value="even" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <Equal className="h-3.5 w-3.5" />
              <span className="text-xs">Even</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="percentage" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <Percent className="h-3.5 w-3.5" />
              <span className="text-xs">Percentage</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="manual" className="gap-1.5 px-3 py-1.5 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <Edit3 className="h-3.5 w-3.5" />
              <span className="text-xs">Manual</span>
            </ToggleGroupItem>
          </ToggleGroup>
          {splitMode === 'percentage' && (
            <Button variant="outline" size="sm" onClick={applyPercentageSplit} className="h-7 text-xs">
              Apply %
            </Button>
          )}
        </div>

        {/* Children list */}
        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {localChildren.map((child, idx) => (
            <div key={child.userId} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={child.profilePictureUrl || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(child.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium min-w-[100px] truncate">{child.fullName}</span>

              {splitMode === 'percentage' && (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={child.percentage || ''}
                    onChange={(e) => handleFieldChange(idx, 'percentage', parseFloat(e.target.value) || 0)}
                    className="h-7 w-16 text-right text-sm"
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              )}

              {enabledMetrics.quantity && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Qty</span>
                  <Input
                    type="text"
                    value={child.quantityTarget > 0 ? formatNumber(child.quantityTarget) : ''}
                    onChange={(e) => handleFieldChange(idx, 'quantityTarget', parseNumber(e.target.value))}
                    className="h-7 w-20 text-right text-sm"
                    disabled={splitMode === 'even'}
                  />
                </div>
              )}
              {enabledMetrics.revenue && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">₹</span>
                  <Input
                    type="text"
                    value={child.revenueTarget > 0 ? formatNumber(child.revenueTarget) : ''}
                    onChange={(e) => handleFieldChange(idx, 'revenueTarget', parseNumber(e.target.value))}
                    className="h-7 w-24 text-right text-sm"
                    disabled={splitMode === 'even'}
                  />
                </div>
              )}
              {enabledMetrics.visits && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Vis</span>
                  <Input
                    type="text"
                    value={child.visitsTarget > 0 ? formatNumber(child.visitsTarget) : ''}
                    onChange={(e) => handleFieldChange(idx, 'visitsTarget', parseNumber(e.target.value))}
                    className="h-7 w-16 text-right text-sm"
                    disabled={splitMode === 'even'}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Remaining / over-allocation summary */}
        <div className={cn(
          'flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border',
          hasOver ? 'bg-destructive/10 border-destructive/30' : isFullyDistributed ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted/30'
        )}>
          <div className="flex items-center gap-2">
            {hasOver ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : isFullyDistributed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : null}
            <span className="text-sm font-medium">
              {hasOver ? 'Over-allocated' : isFullyDistributed ? 'Fully distributed' : 'Remaining'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {enabledMetrics.quantity && (
              <Badge variant={remainQty < 0 ? 'destructive' : remainQty === 0 ? 'default' : 'secondary'} className="font-mono">
                {formatNumber(remainQty)} {quantityUnit}
              </Badge>
            )}
            {enabledMetrics.revenue && (
              <Badge variant={remainRev < 0 ? 'destructive' : remainRev === 0 ? 'default' : 'secondary'} className="font-mono">
                {formatCurrency(remainRev)}
              </Badge>
            )}
            {enabledMetrics.visits && (
              <Badge variant={remainVis < 0 ? 'destructive' : remainVis === 0 ? 'default' : 'secondary'} className="font-mono">
                {formatNumber(remainVis)} visits
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => { onApply(localChildren); onOpenChange(false); }} disabled={hasOver}>
            Apply Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
