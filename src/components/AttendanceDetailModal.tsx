import { Calendar, Clock, MapPin, Camera, User, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useFaceMatching, type FaceMatchResult } from "@/hooks/useFaceMatching";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";

interface AttendanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  record: any;
}

export const AttendanceDetailModal = ({ isOpen, onClose, selectedDate, record }: AttendanceDetailModalProps) => {
  const { getMatchStatusIcon, getMatchStatusText } = useFaceMatching();
  const [baselinePhoto, setBaselinePhoto] = useState<string | null>(null);
  const [faceMatchResult, setFaceMatchResult] = useState<FaceMatchResult | null>(null);

  useEffect(() => {
    if (record?.rawRecord && isOpen) {
      fetchBaselinePhoto();
      performFaceMatch();
    }
  }, [record, isOpen]);

  const fetchBaselinePhoto = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('profile_picture_url')
        .eq('id', record.rawRecord.user_id)
        .single();

      if (profileData?.profile_picture_url) {
        setBaselinePhoto(profileData.profile_picture_url);
      }
    } catch (error) {
      console.error('Error fetching baseline photo:', error);
    }
  };

  const performFaceMatch = async () => {
    try {
      // Use actual face match data from the database
      if (!record?.rawRecord?.face_match_confidence) {
        setFaceMatchResult(null);
        return;
      }

      const confidence = record.rawRecord.face_match_confidence;
      const status = confidence >= 70 ? 'match' : confidence >= 40 ? 'partial' : 'nomatch';
      const color = status === 'match' ? 'green' : status === 'partial' ? 'amber' : 'red';

      setFaceMatchResult({ status, confidence, color });
    } catch (error) {
      console.error('Error performing face match:', error);
    }
  };

  // Resolve signed URLs for private storage buckets
  const signedBaselinePhoto = useSignedUrl(baselinePhoto);
  const signedAttendancePhoto = useSignedUrl(
    record?.rawRecord?.check_in_photo_url,
    'attendance-photos'
  );

  if (!selectedDate || !record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Attendance Details - {new Date(selectedDate).toLocaleDateString('en-GB')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Check In Time:</span>
              </div>
              <p className="text-lg">{record.checkIn}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Check Out Time:</span>
              </div>
              <p className="text-lg">{record.checkOut}</p>
            </div>
          </div>

          {/* Total Hours */}
          <div className="space-y-2">
            <span className="font-medium">Total Hours Worked:</span>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {record.totalHours}
            </Badge>
          </div>

          {/* Location Details */}
          {record.rawRecord?.check_in_location && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Location Details:</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Latitude:</span>
                    <p className="font-mono">{record.rawRecord.check_in_location.latitude?.toFixed(6)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Longitude:</span>
                    <p className="font-mono">{record.rawRecord.check_in_location.longitude?.toFixed(6)}</p>
                  </div>
                </div>
                {record.rawRecord.check_in_address && (
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="text-sm">{record.rawRecord.check_in_address}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Face Match Section */}
          {(signedBaselinePhoto || signedAttendancePhoto) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Face Verification:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {signedBaselinePhoto && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Baseline Photo:</span>
                    <img 
                      src={signedBaselinePhoto} 
                      alt="Baseline employee photo"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
                {signedAttendancePhoto && (
                  <div className="space-y-2">
                    <span className="text-sm text-muted-foreground">Attendance Photo:</span>
                    <img 
                      src={signedAttendancePhoto} 
                      alt="Attendance photo"
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
              {faceMatchResult && (
                <div className={cn(
                  "p-4 rounded-lg",
                  faceMatchResult.confidence >= 70 && "bg-green-50 dark:bg-green-950",
                  faceMatchResult.confidence >= 40 && faceMatchResult.confidence < 70 && "bg-amber-50 dark:bg-amber-950",
                  faceMatchResult.confidence < 40 && "bg-red-50 dark:bg-red-950"
                )}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {getMatchStatusIcon(faceMatchResult)}
                    </span>
                    <div>
                      <p className="font-medium">{getMatchStatusText(faceMatchResult)}</p>
                      <p className="text-sm text-muted-foreground">
                        Confidence: {faceMatchResult.confidence.toFixed(1)}%
                      </p>
                    </div>
                    <Badge 
                      variant={
                        faceMatchResult.confidence >= 70 ? 'default' : 
                        faceMatchResult.confidence >= 40 ? 'secondary' : 
                        'destructive'
                      }
                      className={cn(
                        "ml-auto",
                        faceMatchResult.confidence >= 70 && "bg-green-500",
                        faceMatchResult.confidence >= 40 && faceMatchResult.confidence < 70 && "bg-amber-500"
                      )}
                    >
                      {faceMatchResult.confidence >= 70 ? 'Match' : 
                       faceMatchResult.confidence >= 40 ? 'Partial' : 'No Match'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <span className="font-medium">Status:</span>
            <Badge variant={record.rawRecord?.status === 'present' ? 'default' : 'secondary'}>
              {record.rawRecord?.status || 'Unknown'}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};