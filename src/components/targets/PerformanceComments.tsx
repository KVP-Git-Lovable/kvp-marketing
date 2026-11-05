import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Star } from "lucide-react";

interface PerformanceCommentsProps {
  userId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  isManager?: boolean;
  isHR?: boolean;
}

export const PerformanceComments = ({
  userId,
  periodType,
  periodStart,
  periodEnd,
  isManager = false,
  isHR = false,
}: PerformanceCommentsProps) => {
  const { userProfile } = useAuth();
  const [selfComment, setSelfComment] = useState("");
  const [selfRating, setSelfRating] = useState([5]);
  const [managerComment, setManagerComment] = useState("");
  const [managerRating, setManagerRating] = useState([5]);
  const [hrComment, setHrComment] = useState("");
  const [hrRating, setHrRating] = useState([5]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: any = {
        user_id: userId,
        period_type: periodType,
        period_start: periodStart,
        period_end: periodEnd,
      };

      // Only add fields the user has permission to update
      if (userId === userProfile?.id) {
        payload.self_comment = selfComment;
        payload.self_rating = selfRating[0];
      }

      if (isManager) {
        payload.manager_comment = managerComment;
        payload.manager_rating = managerRating[0];
        payload.manager_id = userProfile?.id;
      }

      if (isHR) {
        payload.hr_comment = hrComment;
        payload.hr_rating = hrRating[0];
        payload.hr_id = userProfile?.id;
      }

      const { error } = await supabase
        .from("performance_comments")
        .upsert(payload, {
          onConflict: "user_id,period_type,period_start",
        });

      if (error) throw error;

      toast.success("Comments saved successfully");
    } catch (error) {
      console.error("Error saving comments:", error);
      toast.error("Failed to save comments");
    } finally {
      setLoading(false);
    }
  };

  const canEditSelf = userId === userProfile?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Performance Comments & Ratings
        </CardTitle>
        <CardDescription>
          Add your comments and ratings for this performance period
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Self Comment */}
        {canEditSelf && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Self Assessment</Label>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-lg">{selfRating[0]}/10</span>
              </div>
            </div>
            <Slider
              value={selfRating}
              onValueChange={setSelfRating}
              max={10}
              min={0}
              step={0.5}
              className="mb-2"
            />
            <Textarea
              placeholder="Add your self-assessment comments here..."
              value={selfComment}
              onChange={(e) => setSelfComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        )}

        {/* Manager Comment */}
        {isManager && (
          <div className="space-y-3 p-4 border rounded-lg bg-chart-2/5">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Manager Evaluation</Label>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-lg">{managerRating[0]}/10</span>
              </div>
            </div>
            <Slider
              value={managerRating}
              onValueChange={setManagerRating}
              max={10}
              min={0}
              step={0.5}
              className="mb-2"
            />
            <Textarea
              placeholder="Add manager evaluation comments here..."
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        )}

        {/* HR Comment */}
        {isHR && (
          <div className="space-y-3 p-4 border rounded-lg bg-chart-3/5">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">HR Review</Label>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                <span className="font-bold text-lg">{hrRating[0]}/10</span>
              </div>
            </div>
            <Slider
              value={hrRating}
              onValueChange={setHrRating}
              max={10}
              min={0}
              step={0.5}
              className="mb-2"
            />
            <Textarea
              placeholder="Add HR review comments here..."
              value={hrComment}
              onChange={(e) => setHrComment(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        )}

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Saving..." : "Save Comments & Ratings"}
        </Button>
      </CardContent>
    </Card>
  );
};
