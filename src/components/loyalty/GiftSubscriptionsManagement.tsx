import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Target, Gift, Star, Search, User, Calendar, TrendingUp, Check, X, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface GiftSubscription {
  id: string;
  retailer_id: string;
  gift_id: string;
  subscribed_at: string;
  target_date: string | null;
  status: string;
  progress_points: number;
  points_at_subscription: number;
  achieved_at: string | null;
  notes: string | null;
  gift?: {
    gift_name: string;
    points_required: number;
    gift_type: string;
  };
  retailer?: {
    retailer_name: string;
    owner_name: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: "Active", color: "bg-blue-500/10 text-blue-600", icon: <Target className="h-3 w-3" /> },
  achieved: { label: "Achieved", color: "bg-green-500/10 text-green-600", icon: <Check className="h-3 w-3" /> },
  redeemed: { label: "Redeemed", color: "bg-purple-500/10 text-purple-600", icon: <Gift className="h-3 w-3" /> },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-600", icon: <X className="h-3 w-3" /> },
  expired: { label: "Expired", color: "bg-gray-500/10 text-gray-600", icon: <Clock className="h-3 w-3" /> },
};

export function GiftSubscriptionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubscription, setSelectedSubscription] = useState<GiftSubscription | null>(null);
  const queryClient = useQueryClient();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["retailer-gift-subscriptions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("retailer_gift_subscriptions")
        .select(`
          *,
          gift:retailer_loyalty_gifts(gift_name, points_required, gift_type),
          retailer:retailers(retailer_name, owner_name)
        `)
        .order("subscribed_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as GiftSubscription[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      if (status === "achieved") {
        updateData.achieved_at = new Date().toISOString();
      } else if (status === "cancelled") {
        updateData.cancelled_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("retailer_gift_subscriptions")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscriptions"] });
      toast.success("Subscription updated");
      setSelectedSubscription(null);
    },
    onError: () => toast.error("Failed to update subscription"),
  });

  const filteredSubscriptions = subscriptions?.filter((sub) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      sub.retailer?.retailer_name?.toLowerCase().includes(search) ||
      sub.gift?.gift_name?.toLowerCase().includes(search)
    );
  });

  const getProgress = (sub: GiftSubscription) => {
    if (!sub.gift?.points_required) return 0;
    return Math.min(100, (sub.progress_points / sub.gift.points_required) * 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Gift Subscriptions</h2>
          <p className="text-sm text-muted-foreground">
            Track retailer progress toward their chosen gifts
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search retailer or gift..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="achieved">Achieved</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading subscriptions...</div>
      ) : filteredSubscriptions?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No subscriptions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSubscriptions?.map((sub) => {
            const status = STATUS_CONFIG[sub.status] || STATUS_CONFIG.active;
            const progress = getProgress(sub);
            
            return (
              <Card 
                key={sub.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedSubscription(sub)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {sub.retailer?.retailer_name || "Unknown Retailer"}
                      </CardTitle>
                    </div>
                    <Badge className={status.color}>
                      {status.icon}
                      <span className="ml-1">{status.label}</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" />
                    <span className="font-medium">{sub.gift?.gift_name || "Unknown Gift"}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {sub.progress_points.toLocaleString()} / {sub.gift?.points_required?.toLocaleString() || 0} pts
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Started {format(new Date(sub.subscribed_at), "dd MMM yyyy")}</span>
                    </div>
                    {sub.target_date && (
                      <div className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        <span>Target {format(new Date(sub.target_date), "dd MMM")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedSubscription} onOpenChange={() => setSelectedSubscription(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Subscription Details</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">
                    {selectedSubscription.retailer?.retailer_name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Owner: {selectedSubscription.retailer?.owner_name || "N/A"}
                </p>
              </div>

              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{selectedSubscription.gift?.gift_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span>{selectedSubscription.gift?.points_required?.toLocaleString()} points required</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">
                    {selectedSubscription.progress_points.toLocaleString()} / {selectedSubscription.gift?.points_required?.toLocaleString()}
                  </span>
                </div>
                <Progress value={getProgress(selectedSubscription)} className="h-3" />
                <p className="text-xs text-center text-muted-foreground">
                  {Math.round(getProgress(selectedSubscription))}% complete
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Subscribed</span>
                  <p className="font-medium">
                    {format(new Date(selectedSubscription.subscribed_at), "dd MMM yyyy")}
                  </p>
                </div>
                {selectedSubscription.target_date && (
                  <div>
                    <span className="text-muted-foreground">Target Date</span>
                    <p className="font-medium">
                      {format(new Date(selectedSubscription.target_date), "dd MMM yyyy")}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Points at Start</span>
                  <p className="font-medium">{selectedSubscription.points_at_subscription.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={STATUS_CONFIG[selectedSubscription.status]?.color || ""}>
                    {STATUS_CONFIG[selectedSubscription.status]?.label}
                  </Badge>
                </div>
              </div>

              {selectedSubscription.status === "active" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedSubscription.id, 
                      status: "achieved" 
                    })}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Mark Achieved
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => updateStatusMutation.mutate({ 
                      id: selectedSubscription.id, 
                      status: "cancelled" 
                    })}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}

              {selectedSubscription.status === "achieved" && (
                <Button
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate({ 
                    id: selectedSubscription.id, 
                    status: "redeemed" 
                  })}
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Mark as Redeemed
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
