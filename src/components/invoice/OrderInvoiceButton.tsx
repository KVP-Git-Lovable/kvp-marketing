import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchAndGenerateInvoice } from "@/utils/invoiceGenerator";

interface OrderInvoiceButtonProps {
  orderId: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
  icon?: React.ReactNode;
}

/**
 * Generates an invoice PDF directly from an order id.
 * Works even when no invoices row exists yet (uses order data fallback).
 */
export const OrderInvoiceButton = ({
  orderId,
  className,
  label = "Download Invoice",
  iconOnly = false,
  icon,
}: OrderInvoiceButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { blob, invoiceNumber } = await fetchAndGenerateInvoice(orderId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoiceNumber || "invoice"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Invoice downloaded");
    } catch (err: any) {
      console.error("Order invoice generation failed", err);
      toast.error(err?.message || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      variant="outline"
      size="sm"
      title={label}
      className={cn(iconOnly && "h-8 w-8 p-0", className)}
    >
      {icon || <Download className={cn("h-4 w-4", !iconOnly && "mr-2")} />}
      {!iconOnly && (loading ? "Generating..." : label)}
    </Button>
  );
};
