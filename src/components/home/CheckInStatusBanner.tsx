import { CheckCircle2, Clock, LogOut, Briefcase, Calendar, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { format, differenceInMinutes } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface CheckInStatusBannerProps {
  attendance: any | null;
  onStartDay?: () => void;
  onEndDay?: () => void;
}

// Live timer hook that updates every minute
const useMarketHoursTimer = (
  attendanceDate: string | null,
  checkInTime: string | null,
  checkOutTime: string | null
) => {
  const [marketHours, setMarketHours] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!checkInTime) {
      setMarketHours(null);
      return;
    }

    const normalizeToAttendanceDate = (isoTime: string, dateStr: string | null): Date => {
      const dt = new Date(isoTime);
      if (!dateStr) return dt;

      // Build a local Date at attendance date, but keep the time (hh:mm:ss) from the timestamp.
      const base = new Date(dateStr + 'T00:00:00');
      base.setHours(dt.getHours(), dt.getMinutes(), dt.getSeconds(), dt.getMilliseconds());
      return base;
    };

    const calculateHours = () => {
      const checkIn = normalizeToAttendanceDate(checkInTime, attendanceDate);
      const endTime = checkOutTime
        ? normalizeToAttendanceDate(checkOutTime, attendanceDate)
        : new Date();

      const minutes = Math.max(0, differenceInMinutes(endTime, checkIn));
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    };

    // Calculate immediately
    setMarketHours(calculateHours());

    // Only set up live timer if not checked out
    if (!checkOutTime) {
      intervalRef.current = setInterval(() => {
        setMarketHours(calculateHours());
      }, 60000); // Update every minute
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [attendanceDate, checkInTime, checkOutTime]);

  return marketHours;
};

export const CheckInStatusBanner = ({ attendance, onStartDay, onEndDay }: CheckInStatusBannerProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const isCheckedIn = attendance?.check_in_time;
  const isCheckedOut = attendance?.check_out_time;
  const isOnLeave = attendance?.on_leave;

  // Use live timer for market hours (auto-updates every minute when connected)
  const marketHours = useMarketHoursTimer(
    attendance?.date || null,
    attendance?.check_in_time || null,
    attendance?.check_out_time || null
  );

  if (isOnLeave) {
    return (
      <Card className="bg-gradient-to-r from-blue-500/10 to-blue-500/5 border-blue-500/20">
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-500">{t('home.onLeave')}</p>
            <p className="text-xs text-muted-foreground">
              {t('home.approvedLeave')}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (isCheckedIn) {
    return (
      <Card className="bg-gradient-to-r from-success/10 to-success/5 border-success/20">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">{t('home.dayStart')}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(attendance.check_in_time), 'h:mm a')}
                </p>
              </div>
            </div>
            
            {!isCheckedOut && onEndDay && (
              <Button 
                onClick={onEndDay}
                variant="outline"
                size="sm"
                className="border-success/30 text-success hover:bg-success/10"
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                {t('home.endMyDay')}
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground ml-13">
            {isCheckedOut && (
              <div className="flex items-center gap-1">
                <LogOut className="h-3 w-3" />
                <span>{t('home.out')}: {format(new Date(attendance.check_out_time), 'h:mm a')}</span>
              </div>
            )}
            {marketHours && (
              <div className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                <span>{t('home.market')}: {marketHours}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-r from-warning/20 to-warning/10 border-warning/30">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-warning/30 flex items-center justify-center">
            <Clock className="h-5 w-5 text-warning-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-foreground">{t('home.dayNotStarted')}</p>
            <p className="text-xs text-muted-foreground">{t('home.startYourDay')}</p>
          </div>
        </div>
        <Button 
          onClick={onStartDay || (() => navigate('/attendance'))}
          className="w-full bg-warning hover:bg-warning/90 text-warning-foreground"
        >
          <LogIn className="h-4 w-4 mr-2" />
          {t('home.startMyDay')}
        </Button>
      </div>
    </Card>
  );
};
