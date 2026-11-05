import { useState, useEffect, useMemo } from "react";
import { TrendingUp, Calendar as CalendarIcon, BarChart3, IndianRupee, Clock, Package, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, subDays, startOfQuarter, subQuarters, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Retailer {
  id: string;
  name: string;
  type: string;
  phone: string;
  address: string;
  lastVisitDate?: string;
  isSelected: boolean;
  priority?: "high" | "medium" | "low";
  metrics: {
    avgOrders3Months: number;
    avgOrderPerVisit: number;
    visitsIn3Months: number;
  };
}

interface RetailerAnalyticsProps {
  retailer: Retailer;
  onClose: () => void;
  isOpen: boolean;
}

interface VisitData {
  id: string;
  planned_date: string;
  status: string;
  check_in_time: string | null;
  check_out_time: string | null;
}

interface OrderData {
  id: string;
  total_amount: number;
  created_at: string;
  visit_id: string | null;
}

interface FeedbackData {
  id: string;
  visit_id: string;
}

interface DayVisitData {
  date: Date;
  isProductive: boolean;
  isUnproductive: boolean;
  isPlanned: boolean;
  isPast: boolean;
  orderValue: number;
  hasFeedback: boolean;
  visitId?: string;
  status?: string;
}

type DateFilter = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "this_quarter" | "last_quarter" | "this_fy";

export const RetailerAnalytics = ({ retailer, onClose, isOpen }: RetailerAnalyticsProps) => {
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateFilter, setDateFilter] = useState<DateFilter>("this_month");
  const [selectedDayVisit, setSelectedDayVisit] = useState<DayVisitData | null>(null);
  const [dayOrderDetails, setDayOrderDetails] = useState<any[]>([]);

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString()}`;

  // Fetch all data for this retailer
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen || !retailer.id) return;
      setLoading(true);

      try {
        // Fetch all visits for this retailer
        const { data: visitsData } = await supabase
          .from("visits")
          .select("id, planned_date, status, check_in_time, check_out_time")
          .eq("retailer_id", retailer.id)
          .order("planned_date", { ascending: false });

        // Fetch all orders for this retailer
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, total_amount, created_at, visit_id")
          .eq("retailer_id", retailer.id)
          .order("created_at", { ascending: false });

        // Fetch feedback data
        const visitIds = visitsData?.map(v => v.id) || [];
        let feedbacksData: FeedbackData[] = [];
        if (visitIds.length > 0) {
          const { data: fb } = await supabase
            .from("retailer_feedback")
            .select("id, visit_id")
            .in("visit_id", visitIds);
          feedbacksData = fb || [];
        }

        // Fetch order items for product breakdown
        const orderIds = ordersData?.map(o => o.id) || [];
        let itemsData: any[] = [];
        if (orderIds.length > 0) {
          const { data: items } = await supabase
            .from("order_items")
            .select("id, order_id, product_name, quantity, price, total")
            .in("order_id", orderIds);
          itemsData = items || [];
        }

        setVisits(visitsData || []);
        setOrders(ordersData || []);
        setFeedbacks(feedbacksData);
        setOrderItems(itemsData);
      } catch (error) {
        console.error("Error fetching retailer analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, retailer.id]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = subMonths(now, 6);
    const threeMonthsAgo = subMonths(now, 3);

    // Total Lifetime Value
    const totalLifetimeValue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    // Orders in last 6 months
    const ordersLast6Months = orders.filter(o => new Date(o.created_at) >= sixMonthsAgo);
    const totalRevenue6Months = ordersLast6Months.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const avgMonthlyRevenue6Months = totalRevenue6Months / 6;

    // Visits in last 3 months
    const visitsLast3Months = visits.filter(v => new Date(v.planned_date) >= threeMonthsAgo);
    const visitsCount3Months = visitsLast3Months.length;

    // Productive visits
    const productiveVisits = visitsLast3Months.filter(v => v.status === 'productive').length;

    // Average order per visit
    const ordersWithVisits = orders.filter(o => o.visit_id);
    const avgOrderPerVisit = ordersWithVisits.length > 0 
      ? ordersWithVisits.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) / ordersWithVisits.length
      : 0;

    // Last visit
    const lastVisit = visits[0];
    const lastVisitDate = lastVisit?.planned_date;
    
    // Last visit order value
    const lastVisitOrder = lastVisit ? orders.find(o => o.visit_id === lastVisit.id) : null;
    const lastVisitOrderValue = lastVisitOrder ? Number(lastVisitOrder.total_amount || 0) : 0;

    return {
      totalLifetimeValue,
      avgMonthlyRevenue6Months,
      visitsCount3Months,
      productiveVisits,
      avgOrderPerVisit,
      lastVisitDate,
      lastVisitOrderValue,
      totalOrders: orders.length
    };
  }, [visits, orders]);

  // Calendar data
  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const today = new Date();

    const visitMap = new Map<string, VisitData>();
    visits.forEach(v => {
      visitMap.set(v.planned_date, v);
    });

    const orderMap = new Map<string, number>();
    orders.forEach(o => {
      const dateKey = format(new Date(o.created_at), 'yyyy-MM-dd');
      const existing = orderMap.get(dateKey) || 0;
      orderMap.set(dateKey, existing + Number(o.total_amount || 0));
    });

    const feedbackSet = new Set(feedbacks.map(f => f.visit_id));

    return days.map(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const visit = visitMap.get(dateKey);
      const orderValue = orderMap.get(dateKey) || 0;
      const isPast = day < today;
      const isPlanned = !!visit && !isPast;
      const isProductive = visit?.status === 'productive';
      const isUnproductive = visit?.status === 'unproductive' || visit?.status === 'store_closed';
      const hasFeedback = visit ? feedbackSet.has(visit.id) : false;

      return {
        date: day,
        isProductive,
        isUnproductive,
        isPlanned: !!visit && day > today,
        isPast,
        orderValue,
        hasFeedback,
        visitId: visit?.id,
        status: visit?.status
      };
    });
  }, [currentMonth, visits, orders, feedbacks]);

  // Get date range for filter
  const getDateRange = (filter: DateFilter) => {
    const now = new Date();
    switch (filter) {
      case "today":
        return { start: startOfMonth(now), end: now };
      case "yesterday":
        return { start: subDays(now, 1), end: subDays(now, 1) };
      case "this_week":
        return { start: startOfWeek(now), end: now };
      case "this_month":
        return { start: startOfMonth(now), end: now };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "this_quarter":
        return { start: startOfQuarter(now), end: now };
      case "last_quarter":
        const lastQuarter = subQuarters(now, 1);
        return { start: startOfQuarter(lastQuarter), end: endOfMonth(subMonths(startOfQuarter(now), 1)) };
      case "this_fy":
        const fyStart = now.getMonth() >= 3 
          ? new Date(now.getFullYear(), 3, 1) 
          : new Date(now.getFullYear() - 1, 3, 1);
        return { start: fyStart, end: now };
      default:
        return { start: startOfMonth(now), end: now };
    }
  };

  // Revenue by date chart data
  const revenueByDateData = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    const filteredOrders = orders.filter(o => {
      const date = new Date(o.created_at);
      return date >= start && date <= end;
    });

    const grouped = new Map<string, number>();
    filteredOrders.forEach(o => {
      const dateKey = format(new Date(o.created_at), 'dd MMM');
      const existing = grouped.get(dateKey) || 0;
      grouped.set(dateKey, existing + Number(o.total_amount || 0));
    });

    return Array.from(grouped.entries()).map(([date, revenue]) => ({
      date,
      revenue
    })).slice(-15); // Last 15 days/entries
  }, [orders, dateFilter]);

  // Revenue by product chart data
  const revenueByProductData = useMemo(() => {
    const { start, end } = getDateRange(dateFilter);
    const filteredOrderIds = orders
      .filter(o => {
        const date = new Date(o.created_at);
        return date >= start && date <= end;
      })
      .map(o => o.id);

    const filteredItems = orderItems.filter(i => filteredOrderIds.includes(i.order_id));

    const grouped = new Map<string, number>();
    filteredItems.forEach(item => {
      const existing = grouped.get(item.product_name) || 0;
      grouped.set(item.product_name, existing + Number(item.total || 0));
    });

    return Array.from(grouped.entries())
      .map(([product, revenue]) => ({ product: product.length > 15 ? product.slice(0, 15) + '...' : product, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [orders, orderItems, dateFilter]);

  // Handle day click for details
  const handleDayClick = async (dayData: DayVisitData) => {
    setSelectedDayVisit(dayData);
    
    // Fetch order details for that day
    const dateKey = format(dayData.date, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dateKey);
    const dayOrderIds = dayOrders.map(o => o.id);
    
    if (dayOrderIds.length > 0) {
      const items = orderItems.filter(i => dayOrderIds.includes(i.order_id));
      setDayOrderDetails(items);
    } else {
      setDayOrderDetails([]);
    }
  };

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-[95%] max-w-4xl mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics - {retailer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95%] max-w-4xl mx-auto max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {retailer.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start px-4 border-b rounded-none bg-transparent">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">Calendar</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs">Charts</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 space-y-4 mt-0">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-200/50">
                <CardContent className="p-3 text-center">
                  <IndianRupee className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(metrics.totalLifetimeValue)}</p>
                  <p className="text-[10px] text-muted-foreground">Lifetime Value</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
                <CardContent className="p-3 text-center">
                  <BarChart3 className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(metrics.avgMonthlyRevenue6Months)}</p>
                  <p className="text-[10px] text-muted-foreground">Avg Monthly (6M)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200/50">
                <CardContent className="p-3 text-center">
                  <CalendarIcon className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-purple-600">{metrics.visitsCount3Months}</p>
                  <p className="text-[10px] text-muted-foreground">Visits (3M)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200/50">
                <CardContent className="p-3 text-center">
                  <Package className="h-4 w-4 text-amber-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(metrics.avgOrderPerVisit)}</p>
                  <p className="text-[10px] text-muted-foreground">Avg/Visit</p>
                </CardContent>
              </Card>
            </div>

            {/* Last Visit Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Last Visit
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-semibold">
                    {metrics.lastVisitDate ? format(new Date(metrics.lastVisitDate), 'dd MMM yyyy') : 'No visits yet'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Value</p>
                  <p className="font-semibold text-primary">
                    {metrics.lastVisitOrderValue > 0 ? formatCurrency(metrics.lastVisitOrderValue) : 'No order'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold text-foreground">{metrics.totalOrders}</p>
                <p className="text-[10px] text-muted-foreground">Total Orders</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold text-success">{metrics.productiveVisits}</p>
                <p className="text-[10px] text-muted-foreground">Productive (3M)</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-xl font-bold text-foreground">
                  {metrics.visitsCount3Months > 0 
                    ? Math.round((metrics.productiveVisits / metrics.visitsCount3Months) * 100) 
                    : 0}%
                </p>
                <p className="text-[10px] text-muted-foreground">Productivity</p>
              </div>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="p-4 space-y-4 mt-0">
            {/* Calendar Navigation */}
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="p-1 hover:bg-muted rounded">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
              <button onClick={nextMonth} className="p-1 hover:bg-muted rounded">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-success/30 border border-success" />
                <span>Productive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-destructive/30 border border-destructive" />
                <span>Unproductive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500" />
                <span>Planned</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {day}
                </div>
              ))}
              
              {calendarData.map((dayData, i) => {
                const isCurrentMonth = isSameMonth(dayData.date, currentMonth);
                const isToday = format(dayData.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const hasActivity = dayData.isProductive || dayData.isUnproductive || dayData.isPlanned || dayData.orderValue > 0;

                return (
                  <button
                    key={i}
                    onClick={() => hasActivity && handleDayClick(dayData)}
                    disabled={!isCurrentMonth}
                    className={cn(
                      "min-h-[60px] p-1 border rounded text-left transition-all",
                      "disabled:opacity-30 disabled:cursor-not-allowed",
                      isToday && "ring-2 ring-primary",
                      dayData.isProductive && "bg-success/20 border-success/40",
                      dayData.isUnproductive && "bg-destructive/20 border-destructive/40",
                      dayData.isPlanned && !dayData.isPast && "bg-blue-500/20 border-blue-500/40",
                      !hasActivity && "bg-background",
                      hasActivity && "hover:shadow cursor-pointer"
                    )}
                  >
                    <div className="text-xs font-bold">{format(dayData.date, 'd')}</div>
                    {isCurrentMonth && hasActivity && (
                      <div className="text-[8px] space-y-0.5 mt-0.5">
                        {dayData.isProductive && (
                          <div className="flex items-center gap-0.5 text-success">
                            <CheckCircle className="h-2.5 w-2.5" />
                            <span>P</span>
                          </div>
                        )}
                        {dayData.isUnproductive && (
                          <div className="flex items-center gap-0.5 text-destructive">
                            <XCircle className="h-2.5 w-2.5" />
                            <span>U</span>
                          </div>
                        )}
                        {dayData.orderValue > 0 && (
                          <div className="font-bold text-primary">
                            ₹{dayData.orderValue >= 1000 ? (dayData.orderValue/1000).toFixed(0) + 'k' : dayData.orderValue}
                          </div>
                        )}
                        {dayData.hasFeedback && (
                          <div className="text-blue-600">
                            <MessageSquare className="h-2.5 w-2.5" />
                          </div>
                        )}
                        {dayData.isPlanned && !dayData.isPast && (
                          <Badge variant="outline" className="text-[7px] px-1 py-0 h-3">Plan</Badge>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Day Details Modal */}
            {selectedDayVisit && (
              <Card className="mt-4 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{format(selectedDayVisit.date, 'dd MMM yyyy')}</span>
                    <button onClick={() => setSelectedDayVisit(null)} className="text-muted-foreground hover:text-foreground">
                      ✕
                    </button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Status:</span>
                    <Badge variant={selectedDayVisit.isProductive ? "default" : "destructive"}>
                      {selectedDayVisit.status || (selectedDayVisit.isPlanned ? 'Planned' : 'No visit')}
                    </Badge>
                  </div>
                  
                  {selectedDayVisit.orderValue > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Order Value</p>
                      <p className="text-lg font-bold text-primary">{formatCurrency(selectedDayVisit.orderValue)}</p>
                    </div>
                  )}

                  {dayOrderDetails.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Product Breakdown</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {dayOrderDetails.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs bg-muted/50 p-2 rounded">
                            <span className="truncate flex-1">{item.product_name}</span>
                            <span className="text-muted-foreground mx-2">x{item.quantity}</span>
                            <span className="font-semibold">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDayVisit.hasFeedback && (
                    <Badge variant="outline" className="text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Feedback Connected
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="p-4 space-y-4 mt-0">
            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Period:</span>
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_quarter">This Quarter</SelectItem>
                  <SelectItem value="last_quarter">Last Quarter</SelectItem>
                  <SelectItem value="this_fy">This FY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Revenue by Date Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue by Date</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByDateData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={revenueByDateData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                    No data for selected period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Product Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue by Product</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueByProductData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueByProductData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <YAxis type="category" dataKey="product" tick={{ fontSize: 9 }} width={100} />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">
                    No product data for selected period
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
