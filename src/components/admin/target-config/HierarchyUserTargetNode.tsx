import React, { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, User, MapPin, Calendar, Store, Package, Truck, Map, CalendarDays, TrendingUp } from 'lucide-react';
import { UserBeatTargets } from './UserBeatTargets';
import { UserMonthlyTargets } from './UserMonthlyTargets';
import { UserRetailerTargets } from './UserRetailerTargets';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const FY_MONTHS_LIST = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

export interface HierarchyNodeData {
  userId: string;
  fullName: string;
  profilePictureUrl: string | null;
  managerId: string | null;
  level: number;
  allocationPercentage: number;
  quantityTarget: number;
  revenueTarget: number;
  visitsTarget: number;
  children: HierarchyNodeData[];
}

export interface EnabledParameters {
  product: boolean;
  retailer: boolean;
  beat: boolean;
  distributor: boolean;
  territory: boolean;
  monthly: boolean;
}

export interface EnabledBasis {
  quantity: boolean;
  revenue: boolean;
  visits: boolean;
}

interface HierarchyUserTargetNodeProps {
  node: HierarchyNodeData | SimpleNodeData;
  enabledParameters: EnabledParameters;
  enabledBasis: EnabledBasis;
  quantityUnit: string;
  fyYear: number;
  selectedTargetType: 'quantity' | 'revenue' | 'visits';
  onTargetChange: (userId: string, field: string, value: number) => void;
  depth?: number;
  isExpanded?: boolean;
  hideHeader?: boolean;
  targetStartMonth?: number;
  targetEndMonth?: number;
}

// Simplified node data for AllocationTable
interface SimpleNodeData {
  userId: string;
  fullName: string;
  profilePictureUrl: string | null;
  level: number;
  quantityTarget: number;
  revenueTarget: number;
  visitsTarget: number;
  children: any[];
}

// Daily Avg Tab Component
function DailyAvgTab({
  quantityTarget,
  revenueTarget,
  visitsTarget,
  quantityUnit,
  enabledBasis,
  targetStartMonth,
  targetEndMonth,
}: {
  quantityTarget: number;
  revenueTarget: number;
  visitsTarget: number;
  quantityUnit: string;
  enabledBasis: EnabledBasis;
  targetStartMonth: number;
  targetEndMonth: number;
}) {
  const [workingDays, setWorkingDays] = useState(25);

  const activeMonthCount = targetEndMonth - targetStartMonth + 1;
  const monthLabel = activeMonthCount === 1
    ? FY_MONTHS_LIST[targetStartMonth - 1]
    : `${FY_MONTHS_LIST[targetStartMonth - 1]} - ${FY_MONTHS_LIST[targetEndMonth - 1]}`;

  const formatNumber = (num: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(num);

  // For single month, use the total directly. For multiple months, use per-month average.
  const monthlyQty = activeMonthCount === 1 ? quantityTarget : quantityTarget / activeMonthCount;
  const monthlyRev = activeMonthCount === 1 ? revenueTarget : revenueTarget / activeMonthCount;
  const monthlyVisits = activeMonthCount === 1 ? visitsTarget : visitsTarget / activeMonthCount;

  const avgQtyPerDay = workingDays > 0 ? monthlyQty / workingDays : 0;
  const avgRevPerDay = workingDays > 0 ? monthlyRev / workingDays : 0;
  const avgVisitsPerDay = workingDays > 0 ? monthlyVisits / workingDays : 0;

  return (
    <div className="space-y-3">
      {/* Working Days Card */}
      <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground"># Working Days</p>
            <p className="text-xs text-muted-foreground">Per month ({monthLabel})</p>
          </div>
        </div>
        <Input
          type="number"
          min={1}
          max={31}
          value={workingDays}
          onChange={(e) => setWorkingDays(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-20 h-9 text-right text-base font-bold"
        />
      </div>

      {/* Avg Qty / Day */}
      {enabledBasis.quantity && (
        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
          <div>
            <p className="text-sm font-semibold text-foreground">Avg Qty / Day</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(monthlyQty)} ÷ {workingDays} days
            </p>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatNumber(avgQtyPerDay)} {quantityUnit}
          </p>
        </div>
      )}

      {/* Avg Revenue / Day */}
      {enabledBasis.revenue && (
        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
          <div>
            <p className="text-sm font-semibold text-foreground">Avg Revenue / Day</p>
            <p className="text-xs text-muted-foreground">
              ₹{formatNumber(monthlyRev)} ÷ {workingDays} days
            </p>
          </div>
          <p className="text-xl font-bold text-foreground">
            ₹{formatNumber(avgRevPerDay)}
          </p>
        </div>
      )}

      {/* Avg Visits / Day */}
      {enabledBasis.visits && (
        <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
          <div>
            <p className="text-sm font-semibold text-foreground">Avg Visits / Day</p>
            <p className="text-xs text-muted-foreground">
              {formatNumber(monthlyVisits)} ÷ {workingDays} days
            </p>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatNumber(avgVisitsPerDay)}
          </p>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pt-1">
        Based on 6-day work week (Sundays excluded)
      </p>
    </div>
  );
}

export function HierarchyUserTargetNode({
  node,
  enabledParameters,
  enabledBasis,
  quantityUnit,
  fyYear,
  selectedTargetType,
  onTargetChange,
  depth = 0,
  isExpanded: forceExpanded,
  hideHeader = false,
  targetStartMonth = 1,
  targetEndMonth = 12,
}: HierarchyUserTargetNodeProps) {
  const [isExpandedState, setIsExpandedState] = useState(false);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : isExpandedState;
  const setIsExpanded = forceExpanded !== undefined ? () => {} : setIsExpandedState;
  
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (enabledParameters.beat) return 'beat';
    if (enabledParameters.monthly) return 'monthly';
    if (enabledParameters.retailer) return 'retailer';
    if (enabledParameters.product) return 'product';
    if (enabledParameters.distributor) return 'distributor';
    if (enabledParameters.territory) return 'territory';
    return 'beat';
  });

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(Math.round(num));
  };

  // Month range label
  const monthRangeLabel = useMemo(() => {
    const startName = FY_MONTHS_LIST[targetStartMonth - 1]?.substring(0, 3);
    const endName = FY_MONTHS_LIST[targetEndMonth - 1]?.substring(0, 3);
    if (targetStartMonth === targetEndMonth) return startName;
    return `${startName} - ${endName}`;
  }, [targetStartMonth, targetEndMonth]);

  const activeMonthCount = targetEndMonth - targetStartMonth + 1;

  const getTargetDisplay = () => {
    const parts: string[] = [];
    if (enabledBasis.quantity) {
      parts.push(`${formatNumber(node.quantityTarget)} ${quantityUnit}`);
    }
    if (enabledBasis.revenue) {
      parts.push(`₹${formatNumber(node.revenueTarget)}`);
    }
    if (enabledBasis.visits) {
      parts.push(`${formatNumber(node.visitsTarget)} Visits`);
    }
    return parts.join(' | ');
  };

  // Get active parameter tabs
  const getEnabledTabs = () => {
    const tabs: { value: string; label: string; icon: React.ReactNode }[] = [];
    if (enabledParameters.beat) tabs.push({ value: 'beat', label: 'Beats', icon: <MapPin className="h-4 w-4" /> });
    if (enabledParameters.monthly) tabs.push({ value: 'monthly', label: 'Monthly', icon: <Calendar className="h-4 w-4" /> });
    if (enabledParameters.retailer) tabs.push({ value: 'retailer', label: 'Retailers', icon: <Store className="h-4 w-4" /> });
    if (enabledParameters.product) tabs.push({ value: 'product', label: 'Products', icon: <Package className="h-4 w-4" /> });
    if (enabledParameters.distributor) tabs.push({ value: 'distributor', label: 'Distributors', icon: <Truck className="h-4 w-4" /> });
    if (enabledParameters.territory) tabs.push({ value: 'territory', label: 'Territory', icon: <Map className="h-4 w-4" /> });
    // Always add Daily Avg tab
    tabs.push({ value: 'daily-avg', label: 'Daily Avg', icon: <TrendingUp className="h-4 w-4" /> });
    return tabs;
  };

  const enabledTabs = getEnabledTabs();
  const hasEnabledTabs = enabledTabs.length > 0;

  const renderTabsContent = () => (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        {enabledTabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {enabledParameters.beat && (
        <TabsContent value="beat" className="m-0">
          <UserBeatTargets
            userId={node.userId}
            fyYear={fyYear}
            totalQuantity={node.quantityTarget}
            totalRevenue={node.revenueTarget}
            quantityUnit={quantityUnit}
            selectedTargetType={selectedTargetType}
            enabledBasis={enabledBasis}
          />
        </TabsContent>
      )}

      {enabledParameters.monthly && (
        <TabsContent value="monthly" className="m-0">
          <UserMonthlyTargets
            userId={node.userId}
            fyYear={fyYear}
            totalQuantity={node.quantityTarget}
            totalRevenue={node.revenueTarget}
            totalVisits={node.visitsTarget}
            quantityUnit={quantityUnit}
            selectedTargetType={selectedTargetType}
            enabledBasis={enabledBasis}
            targetStartMonth={targetStartMonth}
            targetEndMonth={targetEndMonth}
          />
        </TabsContent>
      )}

      {enabledParameters.retailer && (
        <TabsContent value="retailer" className="m-0">
          <UserRetailerTargets
            userId={node.userId}
            fyYear={fyYear}
            totalQuantity={node.quantityTarget}
            totalRevenue={node.revenueTarget}
            quantityUnit={quantityUnit}
            selectedTargetType={selectedTargetType}
            enabledBasis={enabledBasis}
          />
        </TabsContent>
      )}

      {enabledParameters.product && (
        <TabsContent value="product" className="m-0">
          <div className="text-sm text-muted-foreground text-center py-8">
            Product breakdown coming soon
          </div>
        </TabsContent>
      )}

      {enabledParameters.distributor && (
        <TabsContent value="distributor" className="m-0">
          <div className="text-sm text-muted-foreground text-center py-8">
            Distributor breakdown coming soon
          </div>
        </TabsContent>
      )}

      {enabledParameters.territory && (
        <TabsContent value="territory" className="m-0">
          <div className="text-sm text-muted-foreground text-center py-8">
            Territory breakdown coming soon
          </div>
        </TabsContent>
      )}

      <TabsContent value="daily-avg" className="m-0">
        <DailyAvgTab
          quantityTarget={node.quantityTarget}
          revenueTarget={node.revenueTarget}
          visitsTarget={node.visitsTarget}
          quantityUnit={quantityUnit}
          enabledBasis={enabledBasis}
          targetStartMonth={targetStartMonth}
          targetEndMonth={targetEndMonth}
        />
      </TabsContent>
    </Tabs>
  );

  // If hideHeader is true, render only the tabs content
  if (hideHeader) {
    return (
      <div>
        {hasEnabledTabs && renderTabsContent()}
      </div>
    );
  }

  return (
    <div className={cn("border-l-2 border-muted", depth > 0 && "ml-6")}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* User Row Header */}
        <div className="flex items-center gap-3 p-3 bg-card hover:bg-muted/50 rounded-lg border mb-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-1 h-auto" disabled={!hasEnabledTabs}>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <Avatar className="h-8 w-8">
            <AvatarImage src={node.profilePictureUrl || undefined} />
            <AvatarFallback>
              {node.fullName?.charAt(0) || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{node.fullName}</span>
              {node.children.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Manager ({node.children.length})
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <Calendar className="h-3 w-3" />
                {monthRangeLabel}
              </Badge>
            </div>
          </div>

          <div className="text-right">
            <span className="text-sm font-semibold text-primary">
              {getTargetDisplay()}
            </span>
          </div>
        </div>

        {/* Expandable Parameter Breakdown */}
        {hasEnabledTabs && (
          <CollapsibleContent>
            <div className="ml-8 mb-4 p-4 bg-muted/30 rounded-lg border">
              {renderTabsContent()}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>

      {/* Render Children */}
      {node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <HierarchyUserTargetNode
              key={child.userId}
              node={child}
              enabledParameters={enabledParameters}
              enabledBasis={enabledBasis}
              quantityUnit={quantityUnit}
              fyYear={fyYear}
              selectedTargetType={selectedTargetType}
              onTargetChange={onTargetChange}
              depth={depth + 1}
              targetStartMonth={targetStartMonth}
              targetEndMonth={targetEndMonth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
