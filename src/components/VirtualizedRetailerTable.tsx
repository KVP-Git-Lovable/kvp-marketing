import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Calendar, Pencil, Phone, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Retailer {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  beat_id: string;
  beat_name?: string | null;
  verified?: boolean;
  priority?: string | null;
  status?: string | null;
  created_at?: string;
  owner_name?: string;
  [key: string]: any;
}

interface VirtualizedRetailerTableProps {
  retailers: Retailer[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenDetail: (retailer: Retailer) => void;
  onAddToVisit: (retailer: Retailer) => void;
  loading?: boolean;
  rowHeight?: number;
  visibleRows?: number;
  showOwnerColumn?: boolean;
}

export const VirtualizedRetailerTable: React.FC<VirtualizedRetailerTableProps> = ({
  retailers,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onAddToVisit,
  loading = false,
  rowHeight = 56,
  visibleRows = 15,
  showOwnerColumn = false,
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [expandedAddress, setExpandedAddress] = useState<string | null>(null);
  const [expandedBeat, setExpandedBeat] = useState<string | null>(null);

  // Calculate visible range based on scroll position
  const { startIndex, endIndex, paddingTop, paddingBottom } = useMemo(() => {
    const start = Math.floor(scrollTop / rowHeight);
    const end = Math.min(start + visibleRows + 2, retailers.length); // +2 for buffer
    const safeStart = Math.max(0, start - 1); // -1 for buffer
    
    return {
      startIndex: safeStart,
      endIndex: end,
      paddingTop: safeStart * rowHeight,
      paddingBottom: Math.max(0, (retailers.length - end) * rowHeight),
    };
  }, [scrollTop, rowHeight, visibleRows, retailers.length]);

  // Get only visible retailers
  const visibleRetailers = useMemo(() => {
    return retailers.slice(startIndex, endIndex);
  }, [retailers, startIndex, endIndex]);

  // Throttle ref to prevent excessive scroll updates
  const scrollThrottleRef = useRef<number | null>(null);
  
  // Handle scroll with throttling for performance
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    
    // Throttle to 60fps (16ms) for smooth scrolling
    if (scrollThrottleRef.current) return;
    
    scrollThrottleRef.current = requestAnimationFrame(() => {
      scrollThrottleRef.current = null;
      // Only update if scroll changed significantly (reduces re-renders)
      if (Math.abs(newScrollTop - scrollTop) > rowHeight / 2) {
        setScrollTop(newScrollTop);
      }
    });
  }, [scrollTop, rowHeight]);
  
  // Cleanup throttle on unmount
  useEffect(() => {
    return () => {
      if (scrollThrottleRef.current) {
        cancelAnimationFrame(scrollThrottleRef.current);
      }
    };
  }, []);

  // Total height for scroll area
  const totalHeight = retailers.length * rowHeight;
  const containerHeight = visibleRows * rowHeight;

  if (loading && retailers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Loading retailers...
      </div>
    );
  }

  if (retailers.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No retailers found
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={retailers.length > 0 && selectedIds.length === retailers.length}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            {showOwnerColumn && <TableHead>Owner</TableHead>}
            <TableHead>Phone Number</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Beat</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      
      {/* Virtualized scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ height: Math.min(containerHeight, totalHeight) }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <Table style={{ position: 'absolute', top: paddingTop, width: '100%' }}>
            <TableBody>
              {visibleRetailers.map((r) => {
                const shortAddress = r.address.length > 30 ? r.address.substring(0, 30) + '...' : r.address;
                const isAddressExpanded = expandedAddress === r.id;
                
                const beatDisplay = r.beat_name || r.beat_id;
                const shortBeat = beatDisplay && beatDisplay.length > 15 ? beatDisplay.substring(0, 15) + '...' : beatDisplay;
                const isBeatExpanded = expandedBeat === r.id;
                
                return (
                  <TableRow key={r.id} style={{ height: rowHeight }}>
                    <TableCell className="w-[50px]">
                      <Checkbox
                        checked={selectedIds.includes(r.id)}
                        onCheckedChange={() => onToggleSelect(r.id)}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-medium cursor-pointer hover:text-primary"
                      onClick={() => onOpenDetail(r)}
                    >
                      <div className="flex items-center gap-2">
                        {r.name}
                        {r.verified && (
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </TableCell>
                    {showOwnerColumn && (
                      <TableCell className="text-sm text-muted-foreground">
                        {r.owner_name || '-'}
                      </TableCell>
                    )}
                    <TableCell>
                      {r.phone ? (
                        <a 
                          href={`tel:${r.phone.replace(/\s+/g, '')}`}
                          className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone size={14} />
                          {r.phone}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell 
                      className="max-w-[200px] cursor-pointer hover:text-primary"
                      onClick={() => setExpandedAddress(isAddressExpanded ? null : r.id)}
                    >
                      {isAddressExpanded ? r.address : shortAddress}
                    </TableCell>
                    <TableCell 
                      className="max-w-[150px] cursor-pointer hover:text-primary"
                      onClick={() => setExpandedBeat(isBeatExpanded ? null : r.id)}
                    >
                      {isBeatExpanded ? beatDisplay : shortBeat}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => navigate(`/order-entry?phoneOrder=true&retailerId=${r.id}&retailer=${encodeURIComponent(r.name)}`)}
                          className="h-8 w-8 p-0"
                          title="Phone Order"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => onAddToVisit(r)} 
                          className="h-8 w-8 p-0"
                          title="Add to visit"
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => onOpenDetail(r)} 
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* Footer showing count */}
      <div className="text-sm text-muted-foreground py-2 text-center border-t">
        Showing {Math.min(visibleRows, retailers.length)} of {retailers.length.toLocaleString()} retailers
      </div>
    </div>
  );
};

export default VirtualizedRetailerTable;
