import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface BeatDayData {
  date: Date;
  ownerName: string;
  ownerId: string;
  completedVisits: number;
  productiveVisits: number;
  revenue: number;
  productivity: number;
}

interface BeatVisitCalendarProps {
  beatId: string;
  beatName: string;
}

export const BeatVisitCalendar = ({ beatId, beatName }: BeatVisitCalendarProps) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<Map<string, BeatDayData[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      
      const rangeStart = startOfMonth(currentDate);
      const rangeEnd = endOfMonth(currentDate);

      // Fetch beat plans for this beat in the date range
      const { data: beatPlans, error: beatPlansError } = await supabase
        .from('beat_plans')
        .select('plan_date, user_id')
        .eq('beat_id', beatId)
        .gte('plan_date', format(rangeStart, 'yyyy-MM-dd'))
        .lte('plan_date', format(rangeEnd, 'yyyy-MM-dd'));

      if (beatPlansError) throw beatPlansError;

      // Get unique user IDs from beat plans
      const userIds = [...new Set(beatPlans?.map(bp => bp.user_id) || [])];
      
      // Fetch user profiles for owners
      const userProfileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        profiles?.forEach(p => {
          userProfileMap.set(p.id, p.full_name || 'Unknown');
        });
      }

      // Get retailers for this beat
      const { data: retailers } = await supabase
        .from('retailers')
        .select('id')
        .eq('beat_id', beatId);

      const retailerIds = retailers?.map(r => r.id) || [];

      if (retailerIds.length === 0) {
        setCalendarData(new Map());
        return;
      }

      // Fetch visits for retailers in this beat
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('id, planned_date, status, user_id, retailer_id')
        .in('retailer_id', retailerIds)
        .gte('planned_date', format(rangeStart, 'yyyy-MM-dd'))
        .lte('planned_date', format(rangeEnd, 'yyyy-MM-dd'));

      if (visitsError) throw visitsError;

      // Fetch orders for retailers in this beat
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, created_at, retailer_id, user_id, status')
        .in('retailer_id', retailerIds)
        .eq('status', 'confirmed')
        .gte('created_at', format(rangeStart, 'yyyy-MM-dd'))
        .lt('created_at', format(addMonths(rangeEnd, 0), 'yyyy-MM-dd') + 'T23:59:59');

      if (ordersError) throw ordersError;

      // Group data by date and user
      const dataByDateAndUser = new Map<string, Map<string, BeatDayData>>();

      // Process visits
      visits?.forEach(visit => {
        const dateKey = visit.planned_date;
        const userId = visit.user_id;
        
        if (!dataByDateAndUser.has(dateKey)) {
          dataByDateAndUser.set(dateKey, new Map());
        }
        
        const dateData = dataByDateAndUser.get(dateKey)!;
        
        if (!dateData.has(userId)) {
          dateData.set(userId, {
            date: new Date(dateKey),
            ownerName: userProfileMap.get(userId) || 'Unknown',
            ownerId: userId,
            completedVisits: 0,
            productiveVisits: 0,
            revenue: 0,
            productivity: 0
          });
        }
        
        const userData = dateData.get(userId)!;
        
        if (visit.status === 'productive' || visit.status === 'unproductive' || visit.status === 'store_closed') {
          userData.completedVisits++;
        }
        
        if (visit.status === 'productive') {
          userData.productiveVisits++;
        }
      });

      // Process orders - group by date and user
      orders?.forEach(order => {
        const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
        const userId = order.user_id;
        
        if (!dataByDateAndUser.has(orderDate)) {
          dataByDateAndUser.set(orderDate, new Map());
        }
        
        const dateData = dataByDateAndUser.get(orderDate)!;
        
        if (!dateData.has(userId)) {
          dateData.set(userId, {
            date: new Date(orderDate),
            ownerName: userProfileMap.get(userId) || 'Unknown',
            ownerId: userId,
            completedVisits: 0,
            productiveVisits: 0,
            revenue: 0,
            productivity: 0
          });
        }
        
        dateData.get(userId)!.revenue += Number(order.total_amount || 0);
      });

      // Calculate productivity and flatten to array per date
      const finalData = new Map<string, BeatDayData[]>();
      
      dataByDateAndUser.forEach((userData, dateKey) => {
        const dayDataArray: BeatDayData[] = [];
        
        userData.forEach(data => {
          if (data.completedVisits > 0) {
            data.productivity = (data.productiveVisits / data.completedVisits) * 100;
          }
          dayDataArray.push(data);
        });
        
        finalData.set(dateKey, dayDataArray);
      });

      setCalendarData(finalData);
    } catch (error) {
      console.error('Error fetching beat calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (beatId) {
      fetchCalendarData();
    }
  }, [beatId, currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  const handleDateClick = (date: Date) => {
    navigate(`/today-summary?date=${format(date, 'yyyy-MM-dd')}`);
  };

  const getColorClass = (dayDataArray: BeatDayData[] | undefined) => {
    if (!dayDataArray || dayDataArray.length === 0) return 'bg-background border-border';
    
    const totalCompleted = dayDataArray.reduce((sum, d) => sum + d.completedVisits, 0);
    const totalProductive = dayDataArray.reduce((sum, d) => sum + d.productiveVisits, 0);
    const totalRevenue = dayDataArray.reduce((sum, d) => sum + d.revenue, 0);
    
    if (totalCompleted === 0) return 'bg-background border-border';
    
    const productivity = (totalProductive / totalCompleted) * 100;
    
    // Color coding based on revenue thresholds
    if (totalRevenue >= 10000) return 'bg-success/30 border-success/50';
    if (totalRevenue >= 5000) return 'bg-success/20 border-success/40';
    if (productivity >= 50) return 'bg-primary/20 border-primary/40';
    if (productivity >= 30) return 'bg-warning/20 border-warning/40';
    if (productivity > 0) return 'bg-destructive/20 border-destructive/40';
    return 'bg-muted border-muted-foreground/20';
  };

  const formatRevenue = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}k`;
    return `₹${amount}`;
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="overflow-x-auto -mx-2 px-2">
        <div className="min-w-[560px] md:min-w-0">
          <div className="grid grid-cols-7 gap-0.5 md:gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="text-center text-[10px] md:text-xs font-semibold text-muted-foreground py-1">
                {day}
              </div>
            ))}
            
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayDataArray = calendarData.get(dateKey);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
              const hasData = dayDataArray && dayDataArray.length > 0;
              
              const totalCompleted = dayDataArray?.reduce((sum, d) => sum + d.completedVisits, 0) || 0;
              const totalProductive = dayDataArray?.reduce((sum, d) => sum + d.productiveVisits, 0) || 0;
              const totalRevenue = dayDataArray?.reduce((sum, d) => sum + d.revenue, 0) || 0;

              return (
                <button
                  key={dateKey}
                  onClick={() => handleDateClick(day)}
                  disabled={!isCurrentMonth || !hasData}
                  className={cn(
                    "min-h-[72px] md:min-h-[85px] p-1 md:p-1.5 border rounded-md transition-all",
                    "hover:shadow-md active:scale-95 md:hover:scale-[1.02]",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100",
                    getColorClass(dayDataArray),
                    isToday && "ring-2 ring-primary ring-offset-1"
                  )}
                >
                  <div className="text-left space-y-0.5">
                    <div className={cn(
                      "text-xs md:text-sm font-bold leading-none",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    
                    {isCurrentMonth && hasData && (
                      <div className="text-[8px] md:text-[10px] space-y-0.5 leading-tight">
                        {/* Owner(s) */}
                        <div className="flex items-center gap-0.5 text-foreground">
                          <Users size={8} className="flex-shrink-0" />
                          <span className="truncate font-medium" title={dayDataArray?.map(d => d.ownerName).join(', ')}>
                            {dayDataArray && dayDataArray.length === 1 
                              ? (dayDataArray[0].ownerName.length > 8 
                                  ? dayDataArray[0].ownerName.substring(0, 8) + '..' 
                                  : dayDataArray[0].ownerName)
                              : `${dayDataArray?.length} users`
                            }
                          </span>
                        </div>
                        
                        {/* Visits */}
                        <div className="text-muted-foreground">
                          C:{totalCompleted} P:{totalProductive}
                        </div>
                        
                        {/* Revenue */}
                        {totalRevenue > 0 && (
                          <div className="text-success font-bold">
                            {formatRevenue(totalRevenue)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft size={16} />
        </Button>
        
        <h3 className="text-sm md:text-base font-semibold">
          {format(currentDate, 'MMMM yyyy')}
        </h3>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/30 border border-success/50" />
          <span>₹10k+</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/20 border border-success/40" />
          <span>₹5k+</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary/20 border border-primary/40" />
          <span>50%+ Prod.</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning/20 border border-warning/40" />
          <span>30%+ Prod.</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/40" />
          <span>&lt;30% Prod.</span>
        </div>
      </div>

      {/* Calendar Grid */}
      {renderCalendar()}

      {/* Summary for the month */}
      {calendarData.size > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Days Visited</p>
            <p className="font-bold text-sm">{calendarData.size}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Total Revenue</p>
            <p className="font-bold text-sm text-success">
              {formatRevenue(
                Array.from(calendarData.values())
                  .flat()
                  .reduce((sum, d) => sum + d.revenue, 0)
              )}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Productive Visits</p>
            <p className="font-bold text-sm text-primary">
              {Array.from(calendarData.values())
                .flat()
                .reduce((sum, d) => sum + d.productiveVisits, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
