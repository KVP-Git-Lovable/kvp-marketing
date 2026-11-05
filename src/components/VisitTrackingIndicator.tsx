import { CheckCircle2, AlertTriangle, XCircle, MapPin, Clock } from "lucide-react";

interface VisitTrackingIndicatorProps {
  locationStatus: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable';
  checkInTime: string;
  distance: number | null;
  onClick: () => void;
}

export const VisitTrackingIndicator = ({ 
  locationStatus, 
  checkInTime, 
  distance, 
  onClick 
}: VisitTrackingIndicatorProps) => {
  const getIcon = () => {
    switch (locationStatus) {
      case 'at_store':
        return <CheckCircle2 className="h-3 w-3 text-success" />;
      case 'within_range':
        return <AlertTriangle className="h-3 w-3 text-warning" />;
      case 'not_at_store':
        return <XCircle className="h-3 w-3 text-destructive" />;
      default:
        return <MapPin className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (locationStatus) {
      case 'at_store':
        return 'At Store';
      case 'within_range':
        return distance !== null ? `Near (${Math.round(distance)}m)` : 'Near Store';
      case 'not_at_store':
        return 'Not at Store';
      default:
        return 'Location N/A';
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch {
      return '--:--';
    }
  };

  return (
    <button
      onClick={(e) => { 
        e.stopPropagation(); 
        onClick(); 
      }}
      className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-muted/50 hover:bg-muted transition-colors border border-border/50"
    >
      {getIcon()}
      <span className="text-muted-foreground">{getStatusText()}</span>
      <span className="text-muted-foreground/50">•</span>
      <Clock className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">In: {formatTime(checkInTime)}</span>
    </button>
  );
};
