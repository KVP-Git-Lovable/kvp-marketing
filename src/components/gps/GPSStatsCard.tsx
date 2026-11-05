import React from 'react';
import { Card } from '@/components/ui/card';
import { MapPin, CheckCircle, XCircle, Route, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetailerStatus } from './RetailerListModal';

interface GPSStatsCardProps {
  beatName: string | null;
  plannedVisits: number;
  productiveVisits: number;
  unproductiveVisits: number;
  totalKmTraveled: number;
  pendingVisits: number;
  activeFilter?: RetailerStatus | null;
  onPlannedClick?: () => void;
  onProductiveClick?: () => void;
  onUnproductiveClick?: () => void;
  onPendingClick?: () => void;
}

export const GPSStatsCard: React.FC<GPSStatsCardProps> = ({
  beatName,
  plannedVisits,
  productiveVisits,
  unproductiveVisits,
  totalKmTraveled,
  pendingVisits,
  activeFilter,
  onPlannedClick,
  onProductiveClick,
  onUnproductiveClick,
  onPendingClick,
}) => {
  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="space-y-4">
        {/* Beat Name Header */}
        {beatName && (
          <div className="flex items-center gap-2 pb-3 border-b border-border/50">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Today's Beat</p>
              <p className="font-semibold text-lg text-foreground">{beatName}</p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Planned */}
          <div 
            onClick={onPlannedClick}
            className={cn(
              "bg-background/80 rounded-lg p-3 text-center transition-all",
              onPlannedClick && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30",
              activeFilter === 'planned' && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/30"
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <MapPin className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{plannedVisits}</p>
            <p className="text-xs text-muted-foreground">Planned</p>
          </div>

          {/* Productive */}
          <div 
            onClick={onProductiveClick}
            className={cn(
              "bg-background/80 rounded-lg p-3 text-center transition-all",
              onProductiveClick && "cursor-pointer hover:bg-green-50 dark:hover:bg-green-950/30",
              activeFilter === 'productive' && "ring-2 ring-green-500 bg-green-50 dark:bg-green-950/30"
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{productiveVisits}</p>
            <p className="text-xs text-muted-foreground">Productive</p>
          </div>

          {/* Unproductive */}
          <div 
            onClick={onUnproductiveClick}
            className={cn(
              "bg-background/80 rounded-lg p-3 text-center transition-all",
              onUnproductiveClick && "cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30",
              activeFilter === 'unproductive' && "ring-2 ring-red-500 bg-red-50 dark:bg-red-950/30"
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{unproductiveVisits}</p>
            <p className="text-xs text-muted-foreground">Unproductive</p>
          </div>

          {/* Pending */}
          <div 
            onClick={onPendingClick}
            className={cn(
              "bg-background/80 rounded-lg p-3 text-center transition-all",
              onPendingClick && "cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30",
              activeFilter === 'pending' && "ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/30"
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{pendingVisits}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>

          {/* KM Traveled */}
          <div className="bg-background/80 rounded-lg p-3 text-center col-span-2 md:col-span-1">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Route className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{totalKmTraveled.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">KM Traveled</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
