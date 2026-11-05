import { supabase } from "@/integrations/supabase/client";

/**
 * Send invoice notification via WhatsApp.
 */
export async function autoSendInvoiceWhatsApp({
  invoiceNumber,
  pdfUrl,
}: {
  invoiceNumber: string;
  pdfUrl?: string;
}): Promise<void> {
  try {
    console.log("📤 Sending invoice WhatsApp for", invoiceNumber);

    const { error } = await supabase.functions.invoke("send-invoice-whatsapp", {
      body: { invoiceNumber, pdfUrl },
    });

    if (error) throw error;
    console.log("✅ Invoice WhatsApp sent");
  } catch (err) {
    console.error("⚠️ WhatsApp send failed:", err);
    throw err;
  }
}
