import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SummaryData {
  da: number;
  ta: number;
  additionalExpenses: number;
  totalExpense: number;
  totalOrder: number;
}

const ExpenseSummaryBoxes = () => {
  const [summaryData, setSummaryData] = useState<SummaryData>({
    da: 0,
    ta: 0,
    additionalExpenses: 0,
    totalExpense: 0,
    totalOrder: 0
  });
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateRangeStart, setDateRangeStart] = useState<Date>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date>();
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month' | 'date-range'>('month');
  const [loading, setLoading] = useState(true);

  const fetchSummaryData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Determine date range based on filter type
      let startDate: Date, endDate: Date;
      
      switch (filterType) {
        case 'day':
          startDate = new Date(selectedDate);
          endDate = new Date(selectedDate);
          break;
        case 'week':
          startDate = new Date(selectedDate);
          startDate.setDate(selectedDate.getDate() - selectedDate.getDay());
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
          break;
        case 'date-range':
          if (!dateRangeStart || !dateRangeEnd) return;
          startDate = new Date(dateRangeStart);
          endDate = new Date(dateRangeEnd);
          break;
        default:
          return;
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // Fetch DA data from attendance
      const { data: employeeData } = await supabase
        .from('employees')
        .select('daily_da_allowance')
        .eq('user_id', user.data.user.id)
        .single();

      const daPerDay = employeeData?.daily_da_allowance || 0;

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('date, status')
        .eq('user_id', user.data.user.id)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      // Fetch TA data from beat allowances
      const { data: beatPlans } = await supabase
        .from('beat_plans')
        .select('plan_date, beat_id, beat_name')
        .eq('user_id', user.data.user.id)
        .gte('plan_date', format(startDate, 'yyyy-MM-dd'))
        .lte('plan_date', format(endDate, 'yyyy-MM-dd'));

      const { data: allowanceData } = await supabase
        .from('beat_allowances')
        .select('*')
        .eq('user_id', user.data.user.id);

      // Fetch additional expenses - only approved ones
      const { data: expensesData } = await (supabase as any)
        .from('additional_expenses')
        .select('amount, expense_date')
        .eq('user_id', user.data.user.id)
        .in('status', ['manager_approved', 'paid'])
        .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
        .lte('expense_date', format(endDate, 'yyyy-MM-dd'));

      // Fetch orders with visits data
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total_amount, visit_id, created_at')
        .eq('user_id', user.data.user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Calculate DA from attendance
      const da = attendanceData?.reduce((sum, record) => {
        return sum + (record.status === 'present' ? daPerDay : 0);
      }, 0) || 0;

      // Calculate TA from beat allowances
      const allowanceMap = new Map();
      allowanceData?.forEach((allowance: any) => {
        const date = allowance.created_at.split('T')[0];
        const key = `${allowance.beat_id}-${date}`;
        allowanceMap.set(key, allowance);
      });

      const ta = beatPlans?.reduce((sum, plan) => {
        const key = `${plan.beat_id}-${plan.plan_date}`;
        const allowance = allowanceMap.get(key);
        return sum + (allowance?.travel_allowance || 0);
      }, 0) || 0;

      const additionalExpenses = expensesData?.reduce((sum, item) => sum + (parseFloat(item.amount?.toString() || '0')), 0) || 0;
      const totalOrder = ordersData?.reduce((sum, item) => sum + (parseFloat(item.total_amount?.toString() || '0')), 0) || 0;
      const totalExpense = da + ta + additionalExpenses;

      setSummaryData({
        da,
        ta,
        additionalExpenses,
        totalExpense,
        totalOrder
      });
    } catch (error) {
      console.error('Error fetching summary data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
  }, [filterType, selectedDate, dateRangeStart, dateRangeEnd]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const summaryBoxes = [
    { label: 'DA', value: summaryData.da, color: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
    { label: 'TA', value: summaryData.ta, color: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' },
    { label: 'Additional Expenses', value: summaryData.additionalExpenses, color: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800' },
    { label: 'Total Expense', value: summaryData.totalExpense, color: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800' },
    { label: 'Total Order', value: summaryData.totalOrder, color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' },
  ];

  return (
    <div className="space-y-4">
      {/* Date Filter Controls */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Select value={filterType} onValueChange={(value: 'day' | 'week' | 'month' | 'date-range') => setFilterType(value)}>
            <SelectTrigger className="w-full sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="date-range">Date Range</SelectItem>
            </SelectContent>
          </Select>

          {filterType !== 'date-range' ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, filterType === 'month' ? "MMM yyyy" : filterType === 'week' ? `MMM dd` : "MMM dd, yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[140px] justify-start text-left font-normal",
                      !dateRangeStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeStart ? format(dateRangeStart, "MMM dd") : <span>Start</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeStart}
                    onSelect={setDateRangeStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[140px] justify-start text-left font-normal",
                      !dateRangeEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRangeEnd ? format(dateRangeEnd, "MMM dd") : <span>End</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRangeEnd}
                    onSelect={setDateRangeEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </Card>

      {/* Summary Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryBoxes.map((box, index) => (
          <Card key={index} className={`${box.color} border`}>
            <CardContent className="p-4">
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{box.label}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {formatCurrency(box.value)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExpenseSummaryBoxes;