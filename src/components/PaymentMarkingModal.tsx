import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IndianRupee, Camera } from "lucide-react";
import { CameraCapture } from "./CameraCapture";

interface OpenInvoice {
  id: string;
  invoice_number: string | null;
  order_date: string | null;
  total_amount: number | null;
  credit_pending_amount: number | null;
}

interface PaymentMarkingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailerId: string;
  currentPendingAmount: number;
  onPaymentMarked: (newPendingAmount: number) => void;
}

export const PaymentMarkingModal = ({
  open,
  onOpenChange,
  retailerId,
  currentPendingAmount,
  onPaymentMarked
}: PaymentMarkingModalProps) => {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // A payment can arrive in more than one mode at once -- 1000 by UPI and 200
  // in cash is one payment, not two. The modes are a set, and each carries its
  // own amount once there is more than one.
  const [selectedMethods, setSelectedMethods] = useState<string[]>(["cash"]);
  const [legAmounts, setLegAmounts] = useState<Record<string, string>>({});
  const isSplit = selectedMethods.length > 1;
  // Everything that only makes sense for a single mode (the proof photo and its
  // labels) still reads one method: the first one chosen.
  const paymentMethod = selectedMethods[0] ?? "cash";
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedProof, setCapturedProof] = useState<Blob | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);

  // The rep should see what this money will clear before they confirm it.
  // apply_retailer_payment_fifo settles oldest-first, so list them that way.
  useEffect(() => {
    if (!open || !retailerId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, invoice_number, order_date, total_amount, credit_pending_amount")
        .eq("retailer_id", retailerId)
        .eq("is_credit_order", true)
        .not("status", "in", "(cancelled,replaced)")
        .gt("credit_pending_amount", 0)
        .order("order_date", { ascending: true });
      if (cancelled) return;
      if (error) {
        // Non-fatal: the payment itself still works, the rep just loses the preview.
        console.error("Could not load open invoices", error);
        setOpenInvoices([]);
        return;
      }
      setOpenInvoices((data as unknown as OpenInvoice[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open, retailerId]);

  const handleCameraCapture = async (blob: Blob) => {
    setCapturedProof(blob);
    const preview = URL.createObjectURL(blob);
    setProofPreview(preview);
    setCameraOpen(false);
  };

  const uploadPaymentProof = async (): Promise<string | null> => {
    if (!capturedProof) return null;

    const fileName = `payment-proof-${retailerId}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from("order-documents")
      .upload(fileName, capturedProof, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading payment proof:", error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("order-documents")
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const PAYMENT_METHODS = [
    { value: "cash", label: "Cash" },
    { value: "cheque", label: "Cheque" },
    { value: "upi", label: "UPI" },
    { value: "neft", label: "NEFT" },
  ];
  // Modes that offer a proof photo. Attaching one is always allowed...
  const PROOF_METHODS = ["cheque", "upi", "neft"];
  // ...but only a cheque is held back until the photo is there. A UPI or NEFT
  // transfer is already evidenced by the transaction itself, so the rep can
  // record it and attach the screenshot or not.
  const PROOF_REQUIRED_METHODS = ["cheque"];
  const requiresProof = selectedMethods.some(m => PROOF_METHODS.includes(m));
  const proofRequired = selectedMethods.some(m => PROOF_REQUIRED_METHODS.includes(m));
  /** The mode the proof photo is for -- the first one that offers one. */
  const proofFor = selectedMethods.find(m => PROOF_METHODS.includes(m)) ?? paymentMethod;

  const legTotal = selectedMethods.reduce(
    (sum, m) => sum + (parseFloat(legAmounts[m] ?? "") || 0), 0);

  const toggleMethod = (m: string) => {
    setSelectedMethods(prev => {
      if (prev.includes(m)) {
        // Never leave nothing selected -- the last one stays put.
        if (prev.length === 1) return prev;
        const next = prev.filter(x => x !== m);
        setLegAmounts(a => { const { [m]: _drop, ...rest } = a; return rest; });
        return next;
      }
      return [...prev, m];
    });
  };

  // Records the collection + runs FIFO allocation against credit orders.
  /**
   * Records the collection(s) and runs FIFO allocation against credit orders.
   *
   * Single and split go down the same path: one server call that writes every
   * leg and allocates them inside one transaction. Inserting the legs from here
   * instead is how a payment ends up half recorded, with an allocation that
   * never ran against the rest.
   */
  const recordCollectionAndAllocate = async (
    legs: Array<{ method: string; amount: number }>,
    proofUrl: string | null
  ): Promise<{ newPendingAmount: number; allocatedCount: number }> => {
    const { data, error } = await (supabase as any).rpc(
      "record_payment_collection_split",
      {
        p_retailer_id: retailerId,
        p_splits: legs.map(l => ({ method: l.method, amount: l.amount })),
        p_proof_url: proofUrl,
      }
    );

    if (error) {
      console.error("[PaymentMarkingModal] split collection failed:", error);
      throw error;
    }

    const result = (data as any) || {};
    return {
      newPendingAmount: Number(result.new_pending_amount ?? 0),
      allocatedCount: Number(result.allocations ?? 0),
    };
  };

  /** The chosen modes as legs. One mode takes the whole amount; several split
   *  it by what was typed against each, and must add up to it. */
  const buildLegs = (amount: number): Array<{ method: string; amount: number }> | null => {
    if (!isSplit) return [{ method: paymentMethod, amount }];
    const legs = selectedMethods
      .map(m => ({ method: m, amount: parseFloat(legAmounts[m] ?? "") || 0 }))
      .filter(l => l.amount > 0);
    if (legs.length < 2) {
      toast.error("Enter an amount against at least two modes, or pick just one mode");
      return null;
    }
    // Rounding: amounts are entered to the rupee, so anything beyond a paisa
    // apart is a real mismatch rather than a float artefact.
    if (Math.abs(legs.reduce((t, l) => t + l.amount, 0) - amount) > 0.01) {
      toast.error(
        `The modes add up to ₹${legs.reduce((t, l) => t + l.amount, 0).toLocaleString("en-IN")}, ` +
        `but the payment is ₹${amount.toLocaleString("en-IN")}`
      );
      return null;
    }
    return legs;
  };

  const handleFullPayment = async () => {
    if (proofRequired && !capturedProof) {
      toast.error("Please capture cheque photo");
      return;
    }

    setLoading(true);
    try {
      let proofUrl = null;
      if (capturedProof) {
        proofUrl = await uploadPaymentProof();
      }

      const legs = buildLegs(isSplit ? legTotal : currentPendingAmount);
      if (!legs) { setLoading(false); return; }

      const { newPendingAmount, allocatedCount } = await recordCollectionAndAllocate(
        legs,
        proofUrl
      );

      toast.success(
        allocatedCount > 0
          ? `Payment marked. Settled ${allocatedCount} order(s).`
          : "Full payment marked successfully!"
      );
      onPaymentMarked(newPendingAmount);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error marking full payment:", error);
      toast.error("Failed to mark payment");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomPayment = async () => {
    const amount = parseFloat(paymentAmount);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > currentPendingAmount) {
      toast.error("Payment amount cannot exceed pending amount");
      return;
    }

    if (proofRequired && !capturedProof) {
      toast.error("Please capture cheque photo");
      return;
    }

    setLoading(true);
    try {
      let proofUrl = null;
      if (capturedProof) {
        proofUrl = await uploadPaymentProof();
      }

      const legs = buildLegs(amount);
      if (!legs) { setLoading(false); return; }

      const { newPendingAmount, allocatedCount } = await recordCollectionAndAllocate(
        legs,
        proofUrl
      );

      toast.success(
        `Payment of ₹${amount.toLocaleString()} marked${
          allocatedCount > 0 ? `. Settled ${allocatedCount} order(s).` : ""
        }`
      );
      onPaymentMarked(newPendingAmount);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error marking custom payment:", error);
      toast.error("Failed to mark payment");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentAmount("");
    setSelectedMethods(["cash"]);
    setLegAmounts({});
    setCapturedProof(null);
    setProofPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="w-5 h-5" />
            Mark Payment Received
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">Current Pending Amount</p>
            <p className="text-2xl font-bold">₹{currentPendingAmount.toLocaleString()}</p>
          </div>

          {openInvoices.length > 0 && (
            <div className="rounded-lg border">
              <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                Applied oldest first to these invoices
              </div>
              <div className="max-h-40 overflow-y-auto">
                {openInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                    <span className="font-mono text-xs">
                      {inv.invoice_number ?? inv.id.slice(0, 8)}
                    </span>
                    {inv.order_date && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(inv.order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <span className="ml-auto text-sm tabular-nums">
                      ₹{Math.round(Number(inv.credit_pending_amount || 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <Label>Payment Method</Label>
              <span className="text-[11px] text-muted-foreground">
                Tap more than one to split
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map(m => (
                <Button
                  key={m.value}
                  type="button"
                  variant={selectedMethods.includes(m.value) ? "default" : "outline"}
                  className="w-full h-auto py-3 whitespace-normal leading-tight text-center"
                  onClick={() => toggleMethod(m.value)}
                  aria-pressed={selectedMethods.includes(m.value)}
                >
                  {m.label}
                </Button>
              ))}
            </div>

            {isSplit && (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-[12px] text-muted-foreground">
                  How much came in by each mode.
                </p>
                {selectedMethods.map(m => (
                  <div key={m} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[13px]">
                      {PAYMENT_METHODS.find(x => x.value === m)?.label ?? m}
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      className="h-9"
                      placeholder="0"
                      value={legAmounts[m] ?? ""}
                      onChange={e => setLegAmounts(a => ({ ...a, [m]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-2 text-[13px]">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold tabular-nums">
                    ₹{legTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                {legTotal > currentPendingAmount && (
                  <p className="text-[12px] text-destructive">
                    That is ₹{(legTotal - currentPendingAmount).toLocaleString("en-IN")} more
                    than the ₹{currentPendingAmount.toLocaleString("en-IN")} outstanding.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Camera Capture for Cheque/UPI/NEFT */}
          {requiresProof && (
            <div className="space-y-2">
              <Label>
                {proofFor === "cheque" ? "Cheque Photo" : proofFor === "upi" ? "UPI Screenshot" : "NEFT Proof"}
                {!proofRequired && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
              </Label>
              {proofPreview ? (
                <div className="space-y-2">
                  <img
                    src={proofPreview}
                    alt="Payment proof preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCameraOpen(true)}
                    className="w-full"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Retake Photo
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCameraOpen(true)}
                  className="w-full"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Capture {proofFor === "cheque" ? "Cheque" : proofFor === "upi" ? "UPI" : "NEFT"} Photo
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleFullPayment}
              disabled={loading || currentPendingAmount === 0}
              className="w-full"
              size="lg"
            >
              Received Full Payment
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="payment-amount">Partial Payment Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="0"
                max={currentPendingAmount}
                step="0.01"
              />
              
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="bg-muted/50 p-3 rounded-lg space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paying Now:</span>
                    <span className="font-semibold">₹{parseFloat(paymentAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining Pending:</span>
                    <span className="font-semibold text-orange-600">
                      ₹{(currentPendingAmount - parseFloat(paymentAmount)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCustomPayment}
                disabled={loading || !paymentAmount || currentPendingAmount === 0}
                variant="outline"
                className="w-full"
              >
                Mark Partial Payment
              </Button>
            </div>
          </div>
        </div>

        <CameraCapture
          isOpen={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={handleCameraCapture}
          title={`Capture ${proofFor === "cheque" ? "Cheque" : proofFor === "upi" ? "UPI" : "NEFT"} Photo`}
          description={`Take a clear photo of the ${proofFor === "cheque" ? "cheque" : proofFor === "upi" ? "UPI transaction" : "NEFT transfer proof"}`}
        />

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
