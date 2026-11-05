import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RetailerStatus = 'planned' | 'productive' | 'unproductive' | 'pending';

export interface EnhancedRetailerLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  visitId?: string;
  checkInTime?: string | null;
  status: RetailerStatus;
  hasOrder: boolean;
  sequenceNumber?: number;
  planDate?: string; // 'yyyy-MM-dd'
}

interface RetailerListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: RetailerStatus | null;
  retailers: EnhancedRetailerLocation[];
  onRetailerClick?: (retailer: EnhancedRetailerLocation) => void;
}

const statusConfig: Record<RetailerStatus, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  bgColor: string;
}> = {
  planned: {
    label: 'Planned',
    icon: MapPin,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
  },
  productive: {
    label: 'Productive',
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
  },
  unproductive: {
    label: 'Unproductive',
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
  },
};

export const RetailerListModal: React.FC<RetailerListModalProps> = ({
  open,
  onOpenChange,
  status,
  retailers,
  onRetailerClick,
}) => {
  if (!status) return null;

  const config = statusConfig[status];
  const Icon = config.icon;
  const filteredRetailers = retailers.filter(r => r.status === status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', config.color)} />
            <span>{config.label} Retailers ({filteredRetailers.length})</span>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          {filteredRetailers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {config.label.toLowerCase()} retailers
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRetailers.map((retailer, index) => (
                <div
                  key={retailer.id}
                  onClick={() => onRetailerClick?.(retailer)}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-colors',
                    config.bgColor,
                    'hover:opacity-80'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold',
                      status === 'productive' && 'bg-green-500 text-white',
                      status === 'unproductive' && 'bg-red-500 text-white',
                      status === 'pending' && 'bg-orange-500 text-white',
                      status === 'planned' && 'bg-blue-500 text-white',
                    )}>
                      {retailer.sequenceNumber || index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {retailer.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {retailer.address || 'No address'}
                      </p>
                      {retailer.checkInTime && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Check-in: {new Date(retailer.checkInTime).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <Icon className={cn('h-4 w-4 flex-shrink-0', config.color)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
