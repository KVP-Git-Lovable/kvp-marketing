import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Gift, Star, Search, User, Calendar, Check, X, Clock, Package, Truck } from "lucide-react";

interface GiftRedemption {
  id: string;
  retailer_id: string;
  gift_id: string;
  subscription_id: string | null;
  points_redeemed: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  processed_by: string | null;
  fulfillment_notes: string | null;
  delivery_address: string | null;
  voucher_code: string | null;
  rejection_reason: string | null;
  gift?: {
    gift_name: string;
    points_required: number;
    gift_type: string;
  };
  retailer?: {
    retailer_name: string;
    owner_name: string;
    phone: string;
    address: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-600", icon: <Clock className="h-3 w-3" /> },
  approved: { label: "Approved", color: "bg-blue-500/10 text-blue-600", icon: <Check className="h-3 w-3" /> },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-600", icon: <X className="h-3 w-3" /> },
  fulfilled: { label: "Fulfilled", color: "bg-green-500/10 text-green-600", icon: <Truck className="h-3 w-3" /> },
};

export function GiftRedemptionsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [selectedRedemption, setSelectedRedemption] = useState<GiftRedemption | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "fulfill" | null>(null);
  const [fulfillmentNotes, setFulfillmentNotes] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  const { data: redemptions, isLoading } = useQuery({
    queryKey: ["retailer-gift-redemptions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("retailer_gift_redemptions")
        .select(`
          *,
          gift:retailer_loyalty_gifts(gift_name, points_required, gift_type),
          retailer:retailers(retailer_name, owner_name, phone, address)
        `)
        .order("requested_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as GiftRedemption[];
    },
  });

  const processRedemptionMutation = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes, 
      voucherCode: code, 
      rejectionReason: reason 
    }: { 
      id: string; 
      status: string; 
      notes?: string; 
      voucherCode?: string;
      rejectionReason?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const updateData: any = { 
        status,
        processed_at: new Date().toISOString(),
        processed_by: userData?.user?.id,
      };
      
      if (notes) updateData.fulfillment_notes = notes;
      if (code) updateData.voucher_code = code;
      if (reason) updateData.rejection_reason = reason;
      
      const { error } = await supabase
        .from("retailer_gift_redemptions")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // If fulfilled and subscription exists, update subscription status
      if (status === "fulfilled" && selectedRedemption?.subscription_id) {
        await supabase
          .from("retailer_gift_subscriptions")
          .update({ status: "redeemed" })
          .eq("id", selectedRedemption.subscription_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["retailer-gift-subscriptions"] });
      toast.success("Redemption processed successfully");
      handleCloseDialog();
    },
    onError: () => toast.error("Failed to process redemption"),
  });

  const handleCloseDialog = () => {
    setSelectedRedemption(null);
    setActionType(null);
    setFulfillmentNotes("");
    setVoucherCode("");
    setRejectionReason("");
  };

  const handleApprove = () => {
    if (!selectedRedemption) return;
    processRedemptionMutation.mutate({
      id: selectedRedemption.id,
      status: "approved",
    });
  };

  const handleReject = () => {
    if (!selectedRedemption || !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    processRedemptionMutation.mutate({
      id: selectedRedemption.id,
      status: "rejected",
      rejectionReason,
    });
  };

  const handleFulfill = () => {
    if (!selectedRedemption) return;
    processRedemptionMutation.mutate({
      id: selectedRedemption.id,
      status: "fulfilled",
      notes: fulfillmentNotes,
      voucherCode,
    });
  };

  const filteredRedemptions = redemptions?.filter((red) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      red.retailer?.retailer_name?.toLowerCase().includes(search) ||
      red.gift?.gift_name?.toLowerCase().includes(search)
    );
  });

  const pendingCount = redemptions?.filter(r => r.status === "pending").length || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Gift Redemptions
            {pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} pending</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Process and track gift redemption requests
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading redemptions...</div>
      ) : filteredRedemptions?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No redemption requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRedemptions?.map((red) => {
            const status = STATUS_CONFIG[red.status] || STATUS_CONFIG.pending;
            
            return (
              <Card 
                key={red.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  setSelectedRedemption(red);
                  setActionType(null);
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">
                        {red.retailer?.retailer_name || "Unknown Retailer"}
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
                    <span className="font-medium">{red.gift?.gift_name || "Unknown Gift"}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-medium">{red.points_redeemed.toLocaleString()} pts</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(red.requested_at), "dd MMM yyyy")}</span>
                    </div>
                  </div>

                  {red.status === "pending" && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRedemption(red);
                          setActionType("approve");
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRedemption(red);
                          setActionType("reject");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {red.status === "approved" && (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRedemption(red);
                        setActionType("fulfill");
                      }}
                    >
                      <Truck className="h-4 w-4 mr-1" />
                      Mark Fulfilled
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedRedemption && !actionType} onOpenChange={() => handleCloseDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Redemption Details</DialogTitle>
          </DialogHeader>
          {selectedRedemption && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">
                    {selectedRedemption.retailer?.retailer_name}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedRedemption.retailer?.owner_name} • {selectedRedemption.retailer?.phone}
                </p>
                {selectedRedemption.retailer?.address && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedRedemption.retailer.address}
                  </p>
                )}
              </div>

              <div className="p-4 bg-primary/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{selectedRedemption.gift?.gift_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span>{selectedRedemption.points_redeemed.toLocaleString()} points redeemed</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Requested</span>
                  <p className="font-medium">
                    {format(new Date(selectedRedemption.requested_at), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={STATUS_CONFIG[selectedRedemption.status]?.color || ""}>
                    {STATUS_CONFIG[selectedRedemption.status]?.label}
                  </Badge>
                </div>
                {selectedRedemption.processed_at && (
                  <div>
                    <span className="text-muted-foreground">Processed</span>
                    <p className="font-medium">
                      {format(new Date(selectedRedemption.processed_at), "dd MMM yyyy HH:mm")}
                    </p>
                  </div>
                )}
                {selectedRedemption.voucher_code && (
                  <div>
                    <span className="text-muted-foreground">Voucher Code</span>
                    <p className="font-mono font-medium">{selectedRedemption.voucher_code}</p>
                  </div>
                )}
              </div>

              {selectedRedemption.fulfillment_notes && (
                <div>
                  <span className="text-muted-foreground text-sm">Fulfillment Notes</span>
                  <p className="text-sm mt-1">{selectedRedemption.fulfillment_notes}</p>
                </div>
              )}

              {selectedRedemption.rejection_reason && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <span className="text-red-600 text-sm font-medium">Rejection Reason</span>
                  <p className="text-sm mt-1">{selectedRedemption.rejection_reason}</p>
                </div>
              )}

              {selectedRedemption.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => setActionType("approve")}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setActionType("reject")}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}

              {selectedRedemption.status === "approved" && (
                <Button
                  className="w-full"
                  onClick={() => setActionType("fulfill")}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  Mark as Fulfilled
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <Dialog open={actionType === "approve"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Redemption</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to approve this redemption request for{" "}
            <strong>{selectedRedemption?.gift?.gift_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processRedemptionMutation.isPending}>
              {processRedemptionMutation.isPending ? "Processing..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionType === "reject"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Redemption</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Please provide a reason for rejecting this redemption request.
            </p>
            <div>
              <Label htmlFor="rejection_reason">Rejection Reason</Label>
              <Textarea
                id="rejection_reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Insufficient points balance, Gift out of stock..."
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processRedemptionMutation.isPending || !rejectionReason}
            >
              {processRedemptionMutation.isPending ? "Processing..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fulfill Dialog */}
      <Dialog open={actionType === "fulfill"} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Fulfilled</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Mark this gift as delivered/fulfilled to the retailer.
            </p>
            {selectedRedemption?.gift?.gift_type === "voucher" && (
              <div>
                <Label htmlFor="voucher_code">Voucher Code (Optional)</Label>
                <Input
                  id="voucher_code"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="Enter voucher code if applicable"
                />
              </div>
            )}
            <div>
              <Label htmlFor="fulfillment_notes">Fulfillment Notes (Optional)</Label>
              <Textarea
                id="fulfillment_notes"
                value={fulfillmentNotes}
                onChange={(e) => setFulfillmentNotes(e.target.value)}
                placeholder="e.g., Delivered via courier, tracking number..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={handleFulfill} disabled={processRedemptionMutation.isPending}>
              {processRedemptionMutation.isPending ? "Processing..." : "Mark Fulfilled"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
