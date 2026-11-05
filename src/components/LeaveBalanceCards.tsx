import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import LeaveApplicationModal from './LeaveApplicationModal';
import { Button } from '@/components/ui/button';
import { CalendarDays } from 'lucide-react';

interface LeaveTypeBalance {
  leave_type_id: string;
  leave_type_name: string;
  opening_balance: number;
  used_balance: number;
  remaining_balance: number;
}

interface LeaveBalanceCardsProps {
  refreshTrigger?: number;
  onApplicationSubmitted?: () => void;
}

// Generate a consistent color based on leave type name
const getLeaveTypeColor = (name: string): string => {
  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600',
    'bg-yellow-100 text-yellow-600',
    'bg-pink-100 text-pink-600',
    'bg-purple-100 text-purple-600',
    'bg-orange-100 text-orange-600',
    'bg-teal-100 text-teal-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const LeaveBalanceCards: React.FC<LeaveBalanceCardsProps> = ({ refreshTrigger, onApplicationSubmitted }) => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<LeaveTypeBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalances = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const currentYear = new Date().getFullYear();

      // Get all active leave types
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      // Get user's leave balances for current year
      const { data: userBalances } = await supabase
        .from('leave_balance')
        .select('leave_type_id, opening_balance, used_balance, remaining_balance')
        .eq('user_id', user.id)
        .eq('year', currentYear);

      if (!leaveTypes) {
        setBalances([]);
        return;
      }

      // Map leave types with their balances
      const result: LeaveTypeBalance[] = leaveTypes.map(lt => {
        const balance = userBalances?.find(b => b.leave_type_id === lt.id);
        return {
          leave_type_id: lt.id,
          leave_type_name: lt.name,
          opening_balance: balance?.opening_balance || 0,
          used_balance: balance?.used_balance || 0,
          remaining_balance: balance?.remaining_balance ?? 0,
        };
      });

      setBalances(result);
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [user?.id, refreshTrigger]);

  const handleApplicationSubmitted = () => {
    fetchBalances();
    onApplicationSubmitted?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No leave types configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Leave Balance</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {balances.map((balance) => {
            const colorClass = getLeaveTypeColor(balance.leave_type_name);
            return (
              <div
                key={balance.leave_type_id}
                className="px-4 py-4 sm:px-6"
              >
                {/* Top row: Icon + Name + Apply button */}
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold ${colorClass}`}>
                    {getInitials(balance.leave_type_name)}
                  </div>
                  <p className="font-medium text-sm flex-1 min-w-0 truncate">{balance.leave_type_name}</p>
                  {balance.remaining_balance > 0 && (
                    <LeaveApplicationModal
                      defaultLeaveTypeId={balance.leave_type_id}
                      onApplicationSubmitted={handleApplicationSubmitted}
                      trigger={
                        <Button variant="outline" size="sm" className="text-xs whitespace-nowrap h-8">
                          Apply Leave
                        </Button>
                      }
                    />
                  )}
                </div>
                {/* Bottom row: Available + Booked stats */}
                <div className="flex items-center gap-6 mt-2 ml-[52px]">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Available</p>
                    <p className={`text-sm font-bold ${balance.remaining_balance > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {balance.remaining_balance} {balance.remaining_balance === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Booked</p>
                    <p className="text-sm font-bold text-foreground">
                      {balance.used_balance} {balance.used_balance === 1 ? 'day' : 'days'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeaveBalanceCards;
