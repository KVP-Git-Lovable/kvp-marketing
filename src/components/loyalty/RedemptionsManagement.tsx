import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Clock, Gift } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RedemptionsManagement() {
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  const { data: redemptions, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-redemptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_redemptions")
        .select(`
          *,
          retailers(name, phone),
          retailer_loyalty_programs(program_name, points_to_rupee_conversion)
        `)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, voucher_code }: { id: string; voucher_code: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("retailer_loyalty_redemptions")
        .update({
          status: "approved",
          voucher_code,
          processed_by: userData?.user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-redemptions"] });
      toast.success("Redemption approved");
      setSelectedRedemption(null);
      setVoucherCode("");
    },
    onError: () => toast.error("Failed to approve redemption"),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("retailer_loyalty_redemptions")
        .update({
          status: "rejected",
          rejection_reason: reason,
          processed_by: userData?.user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-redemptions"] });
      toast.success("Redemption rejected");
      setSelectedRedemption(null);
      setRejectionReason("");
    },
    onError: () => toast.error("Failed to reject redemption"),
  });

  const handleApprove = () => {
    if (!selectedRedemption) return;
    const generatedCode = `VOC-${Date.now().toString(36).toUpperCase()}`;
    approveMutation.mutate({
      id: selectedRedemption.id,
      voucher_code: voucherCode || generatedCode,
    });
  };

  const handleReject = () => {
    if (!selectedRedemption || !rejectionReason) {
      toast.error("Please provide a rejection reason");
      return;
    }
    rejectMutation.mutate({
      id: selectedRedemption.id,
      reason: rejectionReason,
    });
  };

  const filterRedemptions = (status: string) => {
    return redemptions?.filter((r) => r.status === status) || [];
  };

  const RedemptionCard = ({ redemption }: { redemption: any }) => (
    <Card key={redemption.id}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base">{redemption.retailers?.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{redemption.retailers?.phone}</p>
          </div>
          <Badge
            variant={
              redemption.status === "approved"
                ? "default"
                : redemption.status === "rejected"
                ? "destructive"
                : "secondary"
            }
          >
            {redemption.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Points</p>
            <p className="font-semibold">{redemption.points_redeemed}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Value</p>
            <p className="font-semibold">₹{redemption.voucher_amount}</p>
          </div>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Requested</p>
          <p>{new Date(redemption.requested_at).toLocaleString()}</p>
        </div>
        {redemption.voucher_code && (
          <div className="text-sm">
            <p className="text-muted-foreground">Voucher Code</p>
            <p className="font-mono font-semibold">{redemption.voucher_code}</p>
          </div>
        )}
        {redemption.rejection_reason && (
          <div className="text-sm">
            <p className="text-muted-foreground">Rejection Reason</p>
            <p>{redemption.rejection_reason}</p>
          </div>
        )}
        {redemption.status === "pending" && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              className="flex-1"
              onClick={() => setSelectedRedemption(redemption)}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedRedemption(redemption);
                setRejectionReason("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (isLoading) return <div>Loading redemptions...</div>;

  return (
    <>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Redemption Requests</h2>
          <p className="text-sm text-muted-foreground">
            Manage retailer voucher redemption requests
          </p>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({filterRedemptions("pending").length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({filterRedemptions("approved").length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({filterRedemptions("rejected").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-4">
            {filterRedemptions("pending").length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No pending requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filterRedemptions("pending").map((r) => (
                  <RedemptionCard key={r.id} redemption={r} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4 mt-4">
            {filterRedemptions("approved").length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No approved redemptions yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filterRedemptions("approved").map((r) => (
                  <RedemptionCard key={r.id} redemption={r} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4 mt-4">
            {filterRedemptions("rejected").length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No rejected redemptions</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filterRedemptions("rejected").map((r) => (
                  <RedemptionCard key={r.id} redemption={r} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Approve Dialog */}
      <Dialog
        open={selectedRedemption && !rejectionReason}
        onOpenChange={() => setSelectedRedemption(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Redemption</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Voucher Code (auto-generated if empty)</Label>
              <Input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Leave empty to auto-generate"
              />
            </div>
            <div className="text-sm space-y-1">
              <p>
                <strong>Retailer:</strong> {selectedRedemption?.retailers?.name}
              </p>
              <p>
                <strong>Points:</strong> {selectedRedemption?.points_redeemed}
              </p>
              <p>
                <strong>Voucher Amount:</strong> ₹{selectedRedemption?.voucher_amount}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApprove} className="flex-1">
                Approve & Generate Code
              </Button>
              <Button variant="outline" onClick={() => setSelectedRedemption(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={selectedRedemption && !!rejectionReason || (selectedRedemption && rejectionReason === "")}
        onOpenChange={() => {
          setSelectedRedemption(null);
          setRejectionReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Redemption</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejection"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                className="flex-1"
                disabled={!rejectionReason}
              >
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRedemption(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
