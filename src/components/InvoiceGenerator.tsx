import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
// jspdf, jspdf-autotable loaded dynamically in handler
import { downloadPDF } from "@/utils/fileDownloader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


interface InvoiceItem {
  product_name: string;
  quantity: number;
  rate: number;
  total: number;
  unit?: string;
}

interface InvoiceGeneratorProps {
  orderId: string;
  className?: string;
}

export const InvoiceGenerator = ({ orderId, className }: InvoiceGeneratorProps) => {
  const [loading, setLoading] = useState(false);

  const generateInvoice = async () => {
    setLoading(true);
    try {
      // Fetch company details
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (companyError) throw companyError;

      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            product_name,
            quantity,
            rate,
            total,
            unit
          )
        `)
        .eq("id", orderId)
        .single();

      console.log('Order data for invoice:', order);

      if (orderError) throw orderError;

      // Fetch retailer details
      const { data: retailer, error: retailerError } = await supabase
        .from("retailers")
        .select("*")
        .eq("id", order.retailer_id)
        .single();

      if (retailerError) throw retailerError;

      // Fetch distributor details if mapping exists
      let distributorName = "";
      let distributorPhone = "";
      let distributorAddress = "";
      
      const { data: mapping } = await supabase
        .from("distributor_retailer_mappings")
        .select("distributor_id")
        .eq("retailer_id", order.retailer_id)
        .eq("user_id", order.user_id)
        .maybeSingle();

      if (mapping?.distributor_id) {
        const { data: distributor } = await supabase
          .from("retailers")
          .select("name, phone, address")
          .eq("id", mapping.distributor_id)
          .eq("entity_type", "distributor")
          .maybeSingle();

        if (distributor) {
          distributorName = distributor.name;
          distributorPhone = distributor.phone || "";
          distributorAddress = distributor.address || "";
        }
      }

      // Generate PDF
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      let yPos = 15;

      // Add company logo if available
      if (company?.logo_url) {
        try {
          const response = await fetch(company.logo_url);
          const blob = await response.blob();
          const reader = new FileReader();
          await new Promise((resolve) => {
            reader.onloadend = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          const logoData = reader.result as string;
          doc.addImage(logoData, 'PNG', 14, yPos, 30, 30);
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Company details (right side)
      if (company) {
        doc.setFontSize(16);
        doc.setFont(undefined, "bold");
        doc.text(company.name, pageWidth - 14, yPos, { align: "right" });
        
        doc.setFontSize(9);
        doc.setFont(undefined, "normal");
        yPos += 7;
        
        if (company.address) {
          const addressLines = doc.splitTextToSize(company.address, 90);
          addressLines.forEach((line: string) => {
            doc.text(line, pageWidth - 14, yPos, { align: "right" });
            yPos += 4;
          });
        }
        
        if (company.contact_phone) {
          doc.text(`Phone: ${company.contact_phone}`, pageWidth - 14, yPos, { align: "right" });
          yPos += 4;
        }
        
        if (company.email) {
          doc.text(`Email: ${company.email}`, pageWidth - 14, yPos, { align: "right" });
          yPos += 4;
        }
        
        if (company.gstin) {
          doc.text(`GSTIN: ${company.gstin}`, pageWidth - 14, yPos, { align: "right" });
          yPos += 4;
        }
      }

      // Invoice title and number
      yPos = Math.max(yPos, 50);
      doc.setFontSize(20);
      doc.setFont(undefined, "bold");
      doc.setTextColor(59, 130, 246);
      doc.text("TAX INVOICE", 14, yPos);
      doc.setTextColor(0, 0, 0);
      
      yPos += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text(`Invoice No: ${order.id.substring(0, 8)}`, 14, yPos);
      
      const invoiceDate = new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
      doc.text(`Date: ${invoiceDate}`, pageWidth - 14, yPos, { align: "right" });

      yPos += 10;
      
      // Horizontal line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 10;

      // Bill To section (Retailer details)
      doc.setFontSize(11);
      doc.setFont(undefined, "bold");
      doc.text("Bill To:", 14, yPos);
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      yPos += 6;
      
      doc.setFont(undefined, "bold");
      doc.text(retailer.name, 14, yPos);
      doc.setFont(undefined, "normal");
      yPos += 5;
      
      if (retailer.address) {
        const addressLines = doc.splitTextToSize(retailer.address, 85);
        doc.text(addressLines, 14, yPos);
        yPos += addressLines.length * 4;
      }
      
      if (retailer.phone) {
        doc.text(`Phone: ${retailer.phone}`, 14, yPos);
        yPos += 4;
      }
      
      if (retailer.gst_number) {
        doc.text(`GSTIN: ${retailer.gst_number}`, 14, yPos);
        yPos += 4;
      }

      // Ship To / Distributor details (if available) on the right side
      let rightYPos = yPos - (retailer.address ? 25 : 20);
      if (distributorName) {
        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("Ship From:", pageWidth / 2 + 10, rightYPos);
        doc.setFont(undefined, "normal");
        doc.setFontSize(9);
        rightYPos += 6;
        
        doc.setFont(undefined, "bold");
        doc.text(distributorName, pageWidth / 2 + 10, rightYPos);
        doc.setFont(undefined, "normal");
        rightYPos += 5;
        
        if (distributorAddress) {
          const addressLines = doc.splitTextToSize(distributorAddress, 85);
          doc.text(addressLines, pageWidth / 2 + 10, rightYPos);
          rightYPos += addressLines.length * 4;
        }
        
        if (distributorPhone) {
          doc.text(`Phone: ${distributorPhone}`, pageWidth / 2 + 10, rightYPos);
          rightYPos += 4;
        }
      }

      yPos = Math.max(yPos, rightYPos) + 10;

      // Order items table
      const tableData = order.order_items.map((item: InvoiceItem) => [
        item.product_name,
        item.quantity.toString(),
        `Rs. ${item.rate.toFixed(2)}`,
        item.unit || "pcs",
        `Rs. ${item.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Product", "Qty", "Rate", "Unit", "Total"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontSize: 10,
          fontStyle: "bold"
        },
        styles: {
          fontSize: 9,
          cellPadding: 5
        },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 30, halign: "right" },
          3: { cellWidth: 25, halign: "center" },
          4: { cellWidth: 35, halign: "right" }
        }
      });

      // Calculate totals
      const subtotal = order.subtotal || 0;
      const discount = order.discount_amount || 0;
      const amountAfterDiscount = subtotal - discount;
      const cgst = amountAfterDiscount * 0.09;
      const sgst = amountAfterDiscount * 0.09;
      const calculatedTotal = amountAfterDiscount + cgst + sgst;
      const total = order.total_amount || calculatedTotal;
      const previousPendingCleared = (order as any).previous_pending_cleared || 0;

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable.finalY + 10;

      // Totals section with better spacing
      const totalsX = pageWidth - 75;
      let totalsY = finalY;

      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      
      // Subtotal
      doc.text("Subtotal:", totalsX, totalsY);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
      totalsY += 6;

      // Discount
      if (discount > 0) {
        doc.setTextColor(220, 38, 38); // Red for discount
        doc.text("Discount:", totalsX, totalsY);
        doc.text(`- Rs. ${discount.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        doc.setTextColor(0, 0, 0);
        totalsY += 6;
      }

      // Amount after discount (if there was a discount)
      if (discount > 0) {
        doc.text("Amount after Discount:", totalsX, totalsY);
        doc.text(`Rs. ${amountAfterDiscount.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        totalsY += 6;
      }

      // Taxes
      doc.text("CGST (9%):", totalsX, totalsY);
      doc.text(`Rs. ${cgst.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
      totalsY += 6;

      doc.text("SGST (9%):", totalsX, totalsY);
      doc.text(`Rs. ${sgst.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
      totalsY += 8;

      // Draw line above total
      doc.setLineWidth(0.5);
      doc.line(totalsX, totalsY, pageWidth - 14, totalsY);
      totalsY += 7;

      // Total Amount
      doc.setFont(undefined, "bold");
      doc.setFontSize(12);
      doc.text("Total Amount:", totalsX, totalsY);
      doc.text(`Rs. ${total.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });

      // Payment status and previous pending cleared
      if (previousPendingCleared > 0) {
        totalsY += 10;
        
        // Draw separator line
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(totalsX, totalsY, pageWidth - 14, totalsY);
        totalsY += 7;
        
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(34, 197, 94); // Green color
        doc.text("Previous Pending Cleared:", totalsX, totalsY);
        doc.text(`Rs. ${previousPendingCleared.toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        doc.setTextColor(0, 0, 0);
        totalsY += 8;
        
        doc.setFont(undefined, "bold");
        doc.setFontSize(11);
        doc.text("Grand Total Paid:", totalsX, totalsY);
        doc.text(`Rs. ${(total + previousPendingCleared).toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        doc.setFont(undefined, "normal");
      }

      if (order.is_credit_order) {
        totalsY += 10;
        
        // Draw separator line
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(totalsX, totalsY, pageWidth - 14, totalsY);
        totalsY += 7;
        
        doc.setFontSize(10);
        doc.setFont(undefined, "normal");
        doc.setTextColor(34, 197, 94); // Green
        doc.text("Paid Now:", totalsX, totalsY);
        doc.text(`Rs. ${(order.credit_paid_amount || 0).toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        doc.setTextColor(0, 0, 0);
        totalsY += 6;
        
        doc.setTextColor(220, 38, 38); // Red
        doc.setFont(undefined, "bold");
        doc.text("Pending Amount:", totalsX, totalsY);
        doc.text(`Rs. ${(order.credit_pending_amount || 0).toFixed(2)}`, pageWidth - 14, totalsY, { align: "right" });
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, "normal");
      }

      // Terms and Bank Details
      const footerY = doc.internal.pageSize.getHeight() - 45;
      
      if (company?.terms_conditions || company?.bank_name) {
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(14, footerY, pageWidth - 14, footerY);
        
        let footerContentY = footerY + 6;
        doc.setFontSize(8);
        
        if (company.terms_conditions) {
          doc.setFont(undefined, "bold");
          doc.text("Terms & Conditions:", 14, footerContentY);
          doc.setFont(undefined, "normal");
          footerContentY += 4;
          const termsLines = doc.splitTextToSize(company.terms_conditions, 90);
          doc.text(termsLines, 14, footerContentY);
        }
        
        if (company.bank_name) {
          footerContentY = footerY + 6;
          doc.setFont(undefined, "bold");
          doc.text("Bank Details:", pageWidth / 2 + 10, footerContentY);
          doc.setFont(undefined, "normal");
          footerContentY += 4;
          doc.text(`Bank: ${company.bank_name}`, pageWidth / 2 + 10, footerContentY);
          footerContentY += 4;
          if (company.account_holder_name) {
            doc.text(`A/c Name: ${company.account_holder_name}`, pageWidth / 2 + 10, footerContentY);
            footerContentY += 4;
          }
          if (company.bank_account) {
            doc.text(`A/c No: ${company.bank_account}`, pageWidth / 2 + 10, footerContentY);
            footerContentY += 4;
          }
          if (company.ifsc) {
            doc.text(`IFSC: ${company.ifsc}`, pageWidth / 2 + 10, footerContentY);
          }
        }
      }
      
      // Footer
      const finalFooterY = doc.internal.pageSize.getHeight() - 10;
      doc.setFontSize(8);
      doc.setFont(undefined, "italic");
      doc.text("Thank you for your business!", pageWidth / 2, finalFooterY, { align: "center" });

      // Save PDF using cross-platform downloader
      const fileName = `Invoice_${order.id.substring(0, 8)}_${invoiceDate.replace(/\s/g, "_")}.pdf`;
      const pdfBlob = doc.output('blob');
      await downloadPDF(pdfBlob, fileName);
    } catch (error) {
      console.error("Error generating invoice:", error);
      toast.error("Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={generateInvoice}
      className={className}
    >
      <Download className="mr-2 h-4 w-4" />
      {loading ? "Processing..." : "Download Invoice"}
    </Button>
  );
};
