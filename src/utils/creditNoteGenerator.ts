import { supabase } from "@/integrations/supabase/client";

// Helper function to format amount with 2 decimal places
const formatExact = (amount: number): string => amount.toFixed(2);

// Helper function to format final total as rounded whole number
const formatRounded = (amount: number): string => Math.round(amount).toString();

// Number to words (Indian system)
const numberToWords = (num: number): string => {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertTwoDigit = (n: number): string => {
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
  };
  const convertThreeDigit = (n: number): string => {
    if (n === 0) return "";
    if (n < 100) return convertTwoDigit(n);
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convertTwoDigit(n % 100) : "");
  };
  if (num < 100) return convertTwoDigit(num);
  if (num < 1000) return convertThreeDigit(num);
  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return convertThreeDigit(thousands) + " Thousand" + (remainder ? " " + convertThreeDigit(remainder) : "");
  }
  if (num < 10000000) {
    const lakhs = Math.floor(num / 100000);
    let remainder = num % 100000;
    let result = convertTwoDigit(lakhs) + " Lakh";
    if (remainder >= 1000) {
      result += " " + convertThreeDigit(Math.floor(remainder / 1000)) + " Thousand";
      remainder = remainder % 1000;
    }
    if (remainder > 0) result += " " + convertThreeDigit(remainder);
    return result;
  }
  return num.toString();
};

export interface CreditNoteItem {
  product_name: string;
  hsn_code: string;
  unit: string;
  quantity: number;
  rate: number;
  total: number;
  taxable_amount: number;
  sgst_amount: number;
  cgst_amount: number;
  original_invoice_number: string;
  barcode?: string;
}

export interface CreditNoteData {
  creditNoteNumber: string;
  creditNoteDate: string;
  referenceInvoices: string[]; // List of original invoice numbers
  company: any;
  retailer: any;
  items: CreditNoteItem[];
  reason: string;
  reasonNotes?: string;
  subTotal: number;
  sgstTotal: number;
  cgstTotal: number;
  totalAmount: number;
}

export async function generateCreditNotePDF(data: CreditNoteData): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const { creditNoteNumber, creditNoteDate, referenceInvoices, company, retailer, items, reason, reasonNotes, subTotal, sgstTotal, cgstTotal, totalAmount } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // Dark header background
  doc.setFillColor(31, 41, 55);
  doc.rect(0, 0, pageWidth, 52, "F");

  // Logo
  let companyNameX = 15;
  if (company.logo_url) {
    try {
      const response = await fetch(company.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const imgFormat = company.logo_url.toLowerCase().includes('.png') ? 'PNG' : 'JPEG';
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = base64;
      });
      const maxHeight = 22;
      const maxWidth = 40;
      const aspectRatio = img.width / img.height;
      let logoWidth = maxHeight * aspectRatio;
      let logoHeight = maxHeight;
      if (logoWidth > maxWidth) { logoWidth = maxWidth; logoHeight = maxWidth / aspectRatio; }
      doc.addImage(base64, imgFormat, 15, 12, logoWidth, logoHeight);
      companyNameX = 18 + logoWidth;
    } catch (e) {
      console.warn("Failed to load logo for credit note:", e);
    }
  }

  // Company details (left side of header)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  let headerY = 16;
  doc.text((company.name || "COMPANY NAME").toUpperCase(), companyNameX, headerY);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  headerY = 21;
  if (company.address) {
    const lines = doc.splitTextToSize(company.address, 90);
    doc.text(lines.slice(0, 2), companyNameX, headerY);
    headerY += lines.slice(0, 2).length * 3.5;
  }
  if (company.contact_phone) { doc.text(`Tel: ${company.contact_phone}`, companyNameX, headerY); headerY += 3.5; }
  if (company.email) { doc.text(`Email: ${company.email}`, companyNameX, headerY); headerY += 3.5; }
  doc.text(`GSTIN: ${company.gstin || "XXXXXXXX"}`, companyNameX, headerY);

  // CREDIT NOTE title (right side)
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("CREDIT NOTE", pageWidth - 15, 28, { align: "right" });

  doc.setTextColor(0, 0, 0);

  // Bill To section
  let yPos = 62;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", 15, yPos);
  yPos += 6;
  doc.setFont("helvetica", "normal");
  doc.text(retailer.name || "Customer Name", 15, yPos);
  yPos += 5;
  if (retailer.address) {
    const addressLines = doc.splitTextToSize(retailer.address, 80);
    doc.text(addressLines, 15, yPos);
    yPos += addressLines.length * 4;
  }
  if (retailer.phone) { doc.text(`Phone: ${retailer.phone}`, 15, yPos); yPos += 4; }
  doc.text(`GSTIN: ${retailer.gst_number || retailer.gstin || "XXXXXXXX"}`, 15, yPos);

  // Credit Note details (right side)
  let cnY = 62;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CN #:", pageWidth - 60, cnY);
  doc.setFont("helvetica", "normal");
  doc.text(creditNoteNumber, pageWidth - 15, cnY, { align: "right" });

  cnY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("CREDIT DATE:", pageWidth - 60, cnY);
  doc.setFont("helvetica", "normal");
  doc.text(creditNoteDate, pageWidth - 15, cnY, { align: "right" });

  cnY += 6;
  doc.setFont("helvetica", "bold");
  doc.text("REF INVOICE(S):", pageWidth - 60, cnY);
  doc.setFont("helvetica", "normal");
  const invoiceStr = referenceInvoices.join(", ");
  const invoiceLines = doc.splitTextToSize(invoiceStr, 44);
  doc.text(invoiceLines, pageWidth - 15, cnY, { align: "right", maxWidth: 44 });

  cnY += invoiceLines.length * 4 + 2;
  doc.setFont("helvetica", "bold");
  doc.text("REASON:", pageWidth - 60, cnY);
  doc.setFont("helvetica", "normal");
  const reasonLabel = reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  doc.text(reasonLabel, pageWidth - 15, cnY, { align: "right" });

  // Items table
  const tableData = items.map((item, index) => [
    (index + 1).toString(),
    item.product_name,
    item.hsn_code || "-",
    item.unit || "Piece",
    Number.isInteger(item.quantity) ? item.quantity.toString() : item.quantity.toFixed(2),
    `Rs.${formatExact(item.rate)}`,
    `Rs.${formatExact(item.total)}`,
  ]);

  const tableStartY = Math.max(yPos + 8, cnY + 8, 102);

  autoTable(doc, {
    startY: tableStartY,
    head: [["NO", "PRODUCT", "HSN/SAC", "UNIT", "QTY", "RATE", "AMOUNT"]],
    body: tableData,
    theme: "grid",
    styles: { lineColor: [200, 200, 200], lineWidth: 0.5, fontSize: 8, textColor: [0, 0, 0], cellPadding: 2 },
    headStyles: {
      fillColor: [220, 38, 38], // Red header for credit note
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      lineWidth: 0.5,
      lineColor: [220, 38, 38],
    },
    bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineWidth: 0.5 },
    alternateRowStyles: { fillColor: [254, 242, 242] }, // Light red tint
    columnStyles: {
      0: { cellWidth: 15, halign: "center" as const },
      1: { cellWidth: 'auto' as const, halign: "left" as const },
      2: { cellWidth: 20, halign: "center" as const },
      3: { cellWidth: 18, halign: "center" as const },
      4: { cellWidth: 15, halign: "center" as const },
      5: { cellWidth: 25, halign: "right" as const },
      6: { cellWidth: 28, halign: "right" as const },
    },
    margin: { left: 15, right: 15 },
  });

  // Totals section
  yPos = (doc as any).lastAutoTable.finalY + 6;
  const totalsBoxWidth = 65;
  const totalsBoxX = pageWidth - 15 - totalsBoxWidth;
  const labelOffset = 3;
  const valueOffset = totalsBoxWidth - 3;
  const rowHeight = 5;
  const totalRowHeight = 7;
  const totalsBoxHeight = (3 * rowHeight) + totalRowHeight + 4;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(totalsBoxX, yPos - 1, totalsBoxWidth, totalsBoxHeight);

  let innerY = yPos + 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  doc.text("SUB-TOTAL", totalsBoxX + labelOffset, innerY);
  doc.text(`Rs.${formatExact(subTotal)}`, totalsBoxX + valueOffset, innerY, { align: "right" });

  innerY += rowHeight;
  doc.text("SGST (2.5%)", totalsBoxX + labelOffset, innerY);
  doc.text(`Rs.${formatExact(sgstTotal)}`, totalsBoxX + valueOffset, innerY, { align: "right" });

  innerY += rowHeight;
  doc.text("CGST (2.5%)", totalsBoxX + labelOffset, innerY);
  doc.text(`Rs.${formatExact(cgstTotal)}`, totalsBoxX + valueOffset, innerY, { align: "right" });

  // Total bar (red for credit note)
  innerY += rowHeight + 1;
  doc.setFillColor(220, 38, 38);
  doc.rect(totalsBoxX, innerY - 2, totalsBoxWidth, totalRowHeight, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const totalText = `Total: Rs.${formatRounded(totalAmount)}`;
  const textWidth = doc.getTextWidth(totalText);
  doc.text(totalText, totalsBoxX + totalsBoxWidth / 2 - textWidth / 2, innerY + 3);

  yPos = yPos + totalsBoxHeight + 2;
  doc.setTextColor(0, 0, 0);

  // Amount in words
  yPos += 10;
  const roundedTotal = Math.round(totalAmount);
  const totalInWords = numberToWords(roundedTotal) + " Rupees Only";
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Amount in Words:", 15, yPos);
  doc.setFont("helvetica", "normal");
  yPos += 4;
  doc.text(doc.splitTextToSize(totalInWords, pageWidth - 30), 15, yPos);

  // Reason for Credit section
  if (reasonNotes) {
    yPos += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("REASON FOR CREDIT", 15, yPos);
    yPos += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(reasonNotes, pageWidth - 30);
    doc.text(noteLines, 15, yPos);
    yPos += noteLines.length * 4;
  }

  // Footer
  yPos += 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Authorized Signature", pageWidth - 50, yPos);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - 70, yPos - 10, pageWidth - 15, yPos - 10);

  // Thin footer bar
  const pageHeight = doc.internal.pageSize.height;
  doc.setFillColor(31, 41, 55);
  doc.rect(0, pageHeight - 8, pageWidth, 8, "F");
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text("This is a computer generated credit note", pageWidth / 2, pageHeight - 3, { align: "center" });

  return doc.output("blob");
}

/**
 * Generate the next credit note number in format CN/YY-YY/NNN
 */
export async function getNextCreditNoteNumber(): Promise<string> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const prefix = `CN/${String(fyStart).slice(2)}-${String(fyEnd).slice(2)}/`;

  // Count existing credit notes in this FY
  const { count } = await supabase
    .from('credit_notes')
    .select('*', { count: 'exact', head: true })
    .like('credit_note_number', `${prefix}%`);

  const nextNum = (count || 0) + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}
