import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users, Calendar, MoreVertical, Edit2, BarChart, Trash2, MapPin, Package,
  Sparkles, CalendarDays, Power, Share2, ShieldCheck, ArrowRightLeft,
  Copy, History as HistoryIcon, TrendingUp, TrendingDown, Info, ChevronRight,
  User as UserIcon, Clock,
} from 'lucide-react';
import { useBeatMetrics } from '@/hooks/useBeatMetrics';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

export type BeatAccessType = 'OWNED' | 'CO_OWNER' | 'OPERATIONAL' | 'VIEW_ONLY' | 'COVERAGE';

interface BeatCardProps {
  beat: {
    id: string;
    beat_number: number;
    name: string;
    retailer_count: number;
    category?: string;
    created_at: string;
    territory_name?: string;
    owner_name?: string;
    is_active?: boolean;
    created_by_name?: string | null;
    updated_at?: string | null;
    updated_by_name?: string | null;
  };
  userId: string;
  accessType?: BeatAccessType;
  coverageStartDate?: string | null;
  coverageEndDate?: string | null;
  sharedByName?: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onDetails: () => void;
  onAIInsights: () => void;
  onTransfer?: () => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onShare?: () => void;
  onAssignCoverage?: () => void;
  onTransferOwnership?: () => void;
  onClone?: () => void;
  onHistory?: () => void;
  /** When true bottom button is permanent Delete; when false it is Deactivate */
  isHardDeletable?: boolean;
}

const formatINR = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

function accessBadge(at: BeatAccessType, coverageEndDate?: string | null, coverageStartDate?: string | null) {
  switch (at) {
    case 'OWNED':
      return null; // owner: no badge
    case 'CO_OWNER':
      return <Badge className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-800 border-purple-200">Co-owner</Badge>;
    case 'OPERATIONAL':
      return <Badge className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 border-blue-200">Operational</Badge>;
    case 'VIEW_ONLY':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground">Viewing</Badge>;
    case 'COVERAGE': {
      const today = new Date().toISOString().slice(0, 10);
      const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const isUpcoming = !!coverageStartDate && coverageStartDate.slice(0, 10) > today;
      const label = isUpcoming && coverageStartDate
        ? `Covering from ${fmt(coverageStartDate)}`
        : coverageEndDate
        ? `Covering until ${fmt(coverageEndDate)}`
        : 'Covering';
      const cls = isUpcoming
        ? 'bg-blue-100 text-blue-800 border-blue-200'
        : 'bg-amber-100 text-amber-800 border-amber-200';
      return <Badge className={`text-[10px] px-1.5 py-0.5 ${cls}`}>{label}</Badge>;
    }
  }
}

function MetricTile({
  icon,
  iconClass,
  bgClass,
  label,
  info,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  bgClass: string;
  label: string;
  info: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg p-3 ${bgClass}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/70 ${iconClass}`}>
          {icon}
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={11} className="text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="max-w-[220px] text-xs">{info}</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

export function BeatCard({
  beat,
  userId,
  accessType = 'OWNED',
  coverageStartDate,
  coverageEndDate,
  sharedByName,
  onEdit,
  onDelete,
  onDetails,
  onAIInsights,
  onTransfer,
  onDeactivate,
  onReactivate,
  onShare,
  onAssignCoverage,
  onTransferOwnership,
  onClone,
  onHistory,
  isHardDeletable,
}: BeatCardProps) {
  const { metrics, loading } = useBeatMetrics(beat.id, userId);
  const navigate = useNavigate();
  const { can } = usePermissions();

  const isActive = beat.is_active !== false;
  const isOwner = accessType === 'OWNED';
  const isCoOwner = accessType === 'CO_OWNER';

  const handleBeatNameClick = () => {
    navigate(`/beat/${beat.id}`);
  };

  // Menu visibility per spec
  const showEdit       = isActive && (isOwner || isCoOwner) && can('action_beat_edit', 'edit');
  const showShare      = isActive && isOwner && !!onShare && can('action_beat_share', 'create');
  const showCoverage   = isActive && isOwner && !!onAssignCoverage && can('action_beat_coverage', 'create');
  const showTransfer   = isActive && isOwner && !!onTransferOwnership && can('action_beat_transfer', 'create');
  const showClone      = isActive && isOwner && !!onClone && can('action_beat_clone', 'create');
  const showHistory    = !!onHistory && can('module_my_beats', 'read');
  const showDeactivate = isActive && isOwner && !!onDeactivate && can('action_beat_delete', 'delete');
  const showReactivate = !isActive && !!onReactivate && can('action_beat_reactivate', 'edit');
  const showDelete     = !isActive && !!onDelete && can('action_beat_delete', 'delete');

  const hasAnyMenuItem =
    showEdit || showShare || showCoverage || showTransfer || showClone ||
    showHistory || showDeactivate || showReactivate || showDelete;

  const growth = metrics.revenueGrowth;
  const lastVisitDate = formatDate(metrics.lastVisited);

  return (
    <TooltipProvider delayDuration={150}>
    <Card className="hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin size={17} />
            </span>
            <div className="flex-1 min-w-0">
              <CardTitle
                className="text-base leading-tight cursor-pointer hover:text-primary transition-colors truncate"
                onClick={handleBeatNameClick}
              >
                {beat.name}
              </CardTitle>
              {accessType === 'COVERAGE' && (coverageStartDate || coverageEndDate) ? (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {(() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isUpcoming = !!coverageStartDate && coverageStartDate.slice(0, 10) > today;
                    if (isUpcoming && coverageStartDate) {
                      return `Covering from ${new Date(coverageStartDate).toLocaleDateString()}`;
                    }
                    return coverageEndDate
                      ? `Covering until ${new Date(coverageEndDate).toLocaleDateString()}`
                      : 'Covering';
                  })()}
                </div>
              ) : sharedByName ? (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Shared by {sharedByName}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
            <Badge variant="default" className="text-[10px] px-1.5 py-0.5 font-medium">
              #{beat.beat_number}
            </Badge>
            {accessBadge(accessType, coverageEndDate, coverageStartDate)}
            {!isActive && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">Inactive</Badge>
            )}
            <Badge
              className={`text-[10px] px-1.5 py-0.5 ${
                beat.retailer_count >= 30 ? 'bg-yellow-100 text-yellow-800' :
                beat.retailer_count >= 20 ? 'bg-gray-100 text-gray-800' :
                beat.retailer_count >= 15 ? 'bg-orange-100 text-orange-800' :
                'bg-amber-100 text-amber-800'
              }`}
            >
              {beat.retailer_count >= 30 ? 'Platinum' :
               beat.retailer_count >= 20 ? 'Silver' :
               beat.retailer_count >= 15 ? 'Gold' : 'Bronze'}
            </Badge>
            {hasAnyMenuItem && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreVertical size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {showEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit2 size={14} className="mr-2" /> Edit Beat
                    </DropdownMenuItem>
                  )}
                  {showShare && (
                    <DropdownMenuItem onClick={onShare}>
                      <Share2 size={14} className="mr-2" /> Share Beat
                    </DropdownMenuItem>
                  )}
                  {showCoverage && (
                    <DropdownMenuItem onClick={onAssignCoverage}>
                      <ShieldCheck size={14} className="mr-2" /> Assign Coverage
                    </DropdownMenuItem>
                  )}
                  {showTransfer && (
                    <DropdownMenuItem onClick={onTransferOwnership}>
                      <ArrowRightLeft size={14} className="mr-2" /> Transfer Ownership
                    </DropdownMenuItem>
                  )}
                  {showClone && (
                    <DropdownMenuItem onClick={onClone}>
                      <Copy size={14} className="mr-2" /> Clone Beat
                    </DropdownMenuItem>
                  )}
                  {showHistory && (
                    <DropdownMenuItem onClick={onHistory}>
                      <HistoryIcon size={14} className="mr-2" /> View History
                    </DropdownMenuItem>
                  )}
                  {(showDeactivate || showReactivate || showDelete) && <DropdownMenuSeparator />}
                  {showReactivate && (
                    <DropdownMenuItem onClick={onReactivate} className="text-emerald-600">
                      <Power size={14} className="mr-2" /> Reactivate Beat
                    </DropdownMenuItem>
                  )}
                  {showDeactivate && (
                    <DropdownMenuItem onClick={onDeactivate} className="text-orange-600">
                      <Power size={14} className="mr-2" /> Deactivate Beat
                    </DropdownMenuItem>
                  )}
                  {showDelete && (
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 size={14} className="mr-2" /> Delete Beat
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 gap-2">
          <MetricTile
            icon={<BarChart size={13} />}
            iconClass="text-emerald-600 dark:text-emerald-400"
            bgClass="bg-emerald-50/80 dark:bg-emerald-950/30"
            label="Monthly Sales"
            info="Confirmed order value from this beat's retailers in the current calendar month."
          >
            <div className="text-lg font-bold leading-tight">
              {loading ? '...' : formatINR(metrics.monthlySales)}
            </div>
            {!loading && growth !== 0 && (
              <div className={`flex items-center gap-1 text-[11px] font-medium ${growth > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {growth > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {Math.abs(growth).toFixed(1)}%
                <span className="text-muted-foreground font-normal">vs last month</span>
              </div>
            )}
          </MetricTile>
          <MetricTile
            icon={<Calendar size={13} />}
            iconClass="text-blue-600 dark:text-blue-400"
            bgClass="bg-blue-50/80 dark:bg-blue-950/30"
            label="Last Visit"
            info="Date of the last completed visit to this beat, and the confirmed order value booked that day. Shows the last planned date if no visit is completed yet."
          >
            <div className="text-sm font-bold leading-tight">
              {loading ? '...' : lastVisitDate ? `${lastVisitDate}${metrics.lastVisitIsPlanned ? ' (planned)' : ''}` : 'Never'}
            </div>
            {!loading && lastVisitDate && (
              <div className="text-xs">
                <span className="font-semibold">{formatINR(metrics.lastVisitOrderValue)}</span>
                <span className="text-muted-foreground"> order value</span>
              </div>
            )}
          </MetricTile>
          <MetricTile
            icon={<Package size={13} />}
            iconClass="text-purple-600 dark:text-purple-400"
            bgClass="bg-purple-50/60 dark:bg-purple-950/30"
            label="Avg Order Value"
            info="Confirmed revenue divided by order count over the last 90 days."
          >
            <div className="text-base font-bold leading-tight">
              {loading ? '...' : formatINR(metrics.avgOrderValue)}
            </div>
          </MetricTile>
          <MetricTile
            icon={<Users size={13} />}
            iconClass="text-amber-600 dark:text-amber-400"
            bgClass="bg-amber-50/60 dark:bg-amber-950/30"
            label="Retailers"
            info="Number of retailers currently assigned to this beat."
          >
            <div className="text-base font-bold leading-tight">{beat.retailer_count}</div>
          </MetricTile>
        </div>

        {metrics.isRecurring && (
          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded border border-primary/20">
            <CalendarDays className="h-3 w-3 text-primary" />
            <span className="text-xs font-medium text-primary">Recurring: {metrics.recurringDetails}</span>
          </div>
        )}

        {/* Territory */}
        {beat.territory_name && (
          <button
            type="button"
            onClick={handleBeatNameClick}
            className="w-full flex items-center gap-2 p-2.5 bg-muted/50 rounded-md hover:bg-muted transition-colors text-left"
          >
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Territory</span>
            <span className="text-sm font-medium flex-1 truncate">{beat.territory_name}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        )}

        {/* Details */}
        <div className="rounded-md border p-3">
          <div className="text-xs font-semibold mb-2">Details</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="flex items-start gap-1.5">
              <UserIcon size={12} className="mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-muted-foreground">Created by</div>
                <div className="font-medium">{beat.created_by_name || '—'}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <UserIcon size={12} className="mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-muted-foreground">Owner</div>
                <div className="font-medium">{beat.owner_name || beat.created_by_name || '—'}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Calendar size={12} className="mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-muted-foreground">Created on</div>
                <div className="font-medium">{formatDate(beat.created_at)}</div>
              </div>
            </div>
            <div className="flex items-start gap-1.5">
              <Clock size={12} className="mt-0.5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-muted-foreground">Last modified</div>
                <div className="font-medium">
                  {formatDate(beat.updated_at) || '—'}
                  {beat.updated_by_name && (
                    <span className="text-muted-foreground font-normal"> by {beat.updated_by_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Beat History */}
        {showHistory && (
          <button
            type="button"
            onClick={onHistory}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-md border bg-muted/30 hover:bg-muted transition-colors text-left"
          >
            <HistoryIcon size={16} className="text-primary flex-shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">View Beat History</span>
              <span className="block text-[11px] text-muted-foreground">See all activities, changes and visit history</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        )}

        {/* Quick Actions */}
        <div className="space-y-2">
          <Button size="sm" className="w-full" onClick={onAIInsights}>
            <Sparkles size={14} className="mr-2" />
            AI Insights
          </Button>
        </div>

      </CardContent>
    </Card>
    </TooltipProvider>
  );
}
