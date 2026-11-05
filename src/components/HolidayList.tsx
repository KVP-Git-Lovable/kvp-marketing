import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface Holiday {
  id: string;
  date: string;
  holiday_name: string;
  description?: string;
  year: number;
}

const HolidayList = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .eq('year', currentYear)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching holidays:', error);
        return;
      }

      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  const isUpcoming = (date: string) => {
    return new Date(date) > new Date();
  };

  const isPast = (date: string) => {
    return new Date(date) < new Date();
  };

  const isToday = (date: string) => {
    const today = new Date().toISOString().split('T')[0];
    return date === today;
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-r from-orange-500/10 to-yellow-600/10 border-orange-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <CalendarDays size={20} />
            Holiday List {currentYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-orange-500/10 to-yellow-600/10 border-orange-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-600">
          <CalendarDays size={20} />
          Holiday List {currentYear}
        </CardTitle>
        <CardDescription>
          Company holidays for the current year
        </CardDescription>
      </CardHeader>
      <CardContent>
        {holidays.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon size={48} className="mx-auto mb-4 text-orange-300" />
            <p className="text-lg font-medium">No holidays configured</p>
            <p className="text-sm">Contact your administrator to add company holidays.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
                  isToday(holiday.date)
                    ? 'bg-green-50 border-green-200'
                    : isUpcoming(holiday.date)
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[80px]">
                    <div className={`text-2xl font-bold ${
                      isToday(holiday.date)
                        ? 'text-green-600'
                        : isUpcoming(holiday.date)
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    }`}>
                      {format(new Date(holiday.date), 'dd')}
                    </div>
                    <div className={`text-xs font-medium ${
                      isToday(holiday.date)
                        ? 'text-green-600'
                        : isUpcoming(holiday.date)
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    }`}>
                      {format(new Date(holiday.date), 'MMM')}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${
                      isToday(holiday.date)
                        ? 'text-green-800'
                        : isUpcoming(holiday.date)
                        ? 'text-blue-800'
                        : 'text-gray-800'
                    }`}>
                      {holiday.holiday_name}
                    </h4>
                    <p className={`text-sm ${
                      isToday(holiday.date)
                        ? 'text-green-600'
                        : isUpcoming(holiday.date)
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    }`}>
                      {format(new Date(holiday.date), 'EEEE, MMMM dd, yyyy')}
                    </p>
                    {holiday.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {holiday.description}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {isToday(holiday.date) ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                      Today
                    </Badge>
                  ) : isUpcoming(holiday.date) ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                      Upcoming
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-600 border-gray-300">
                      Past
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HolidayList;