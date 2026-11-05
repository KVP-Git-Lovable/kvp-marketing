import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Users, User as UserIcon, CalendarDays, CalendarRange, X, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useSubordinates } from '@/hooks/useSubordinates';
import { useMonthlyExpenseSummary } from '@/hooks/useMonthlyExpenseSummary';
import { usePettyCashFund } from '@/hooks/usePettyCashFund';
import MonthNavigator from '@/components/expenses/MonthNavigator';
import ExpenseSummaryCards from '@/components/expenses/ExpenseSummaryCards';
import WeeklyBreakdown from '@/components/expenses/WeeklyBreakdown';
import DailyBreakdown from '@/components/expenses/DailyBreakdown';
import TeamExpenseSummary from '@/components/expenses/TeamExpenseSummary';
import AdditionalExpenses from '@/components/AdditionalExpenses';
import BeatAllowanceManagement from '@/components/BeatAllowanceManagement';
import PettyCashTab from '@/components/expenses/PettyCashTab';

type BreakdownView = 'weekly' | 'daily';

const MyExpenses = () => {
  const { user } = useAuth();
  const { isManager } = useSubordinates();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownView, setBreakdownView] = useState<BreakdownView>('weekly');
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false);

  const { fund, limits, hasPettyCash } = usePettyCashFund();

  const yearMonth = format(selectedMonth, 'yyyy-MM');
  const { data: summary, isLoading } = useMonthlyExpenseSummary(user?.id, yearMonth);

  const tabCount = (isManager ? 2 : 1) + (hasPettyCash ? 1 : 0);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Expenses</h1>
              <ModuleHelpButton categoryId="expenses" />
            </div>
          </div>

          {/* Show tabs if manager OR has petty cash, otherwise direct content */}
          {(isManager || hasPettyCash) ? (
            <Tabs defaultValue="my" className="w-full">
              <TabsList className={`grid w-full h-9`} style={{ gridTemplateColumns: `repeat(${tabCount}, 1fr)` }}>
                <TabsTrigger value="my" className="text-xs gap-1.5">
                  <UserIcon className="h-3.5 w-3.5" />
                  My Expenses
                </TabsTrigger>
                {isManager && (
                  <TabsTrigger value="team" className="text-xs gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Team Summary
                  </TabsTrigger>
                )}
                {hasPettyCash && (
                  <TabsTrigger value="petty-cash" className="text-xs gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Petty Cash
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="my" className="space-y-4 mt-3">
                <MonthNavigator selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
                <MyExpenseContent
                  summary={summary}
                  isLoading={isLoading}
                  onTotalClick={() => setShowBreakdown(true)}
                  onAddExpense={() => setIsAdditionalOpen(true)}
                />
              </TabsContent>

              {isManager && (
                <TabsContent value="team" className="mt-3">
                  <TeamExpenseSummary yearMonth={yearMonth} />
                </TabsContent>
              )}

              {hasPettyCash && fund && (
                <TabsContent value="petty-cash" className="mt-3">
                  <PettyCashTab fund={fund} limits={limits} />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="space-y-4">
              <MonthNavigator selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
              <MyExpenseContent
                summary={summary}
                isLoading={isLoading}
                onTotalClick={() => setShowBreakdown(true)}
                onAddExpense={() => setIsAdditionalOpen(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Dialog */}
      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Expense Breakdown · {format(selectedMonth, 'MMM yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* View Toggle */}
            <div className="flex items-center gap-1.5">
              <Button
                variant={breakdownView === 'weekly' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5 px-3"
                onClick={() => setBreakdownView('weekly')}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                Weekly
              </Button>
              <Button
                variant={breakdownView === 'daily' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs gap-1.5 px-3"
                onClick={() => setBreakdownView('daily')}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Daily
              </Button>
            </div>

            {summary && (
              breakdownView === 'weekly' ? (
                <WeeklyBreakdown weeks={summary.weeklyBreakdown} />
              ) : (
                <DailyBreakdown days={summary.dailyBreakdown} />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Additional Expenses Dialog */}
      <Dialog open={isAdditionalOpen} onOpenChange={setIsAdditionalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AdditionalExpenses />
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

interface MyExpenseContentProps {
  summary: ReturnType<typeof useMonthlyExpenseSummary>['data'];
  isLoading: boolean;
  onTotalClick: () => void;
  onAddExpense: () => void;
}

const MyExpenseContent: React.FC<MyExpenseContentProps> = ({
  summary, isLoading, onTotalClick, onAddExpense
}) => {
  return (
    <>
      {/* Summary Cards */}
      <ExpenseSummaryCards
        ta={summary?.ta || 0}
        da={summary?.da || 0}
        additional={summary?.additionalApproved || 0}
        total={summary?.total || 0}
        presentDays={summary?.presentDays || 0}
        loading={isLoading}
        onTotalClick={onTotalClick}
        isExpanded={false}
        orderValue={summary?.orderValue || 0}
        totalKm={summary?.totalKm || 0}
      />


      {/* Detailed Daily View (old Expense Details) */}
      <BeatAllowanceManagement />
    </>
  );
};

export default MyExpenses;
