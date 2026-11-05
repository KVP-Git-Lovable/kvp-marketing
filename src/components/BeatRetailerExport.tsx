import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, Download, Languages, Loader2 } from "lucide-react";
import { toast } from "sonner";
// jspdf, jspdf-autotable, xlsx loaded dynamically in export handlers
import { downloadPDF } from "@/utils/fileDownloader";
import { supabase } from "@/integrations/supabase/client";

interface Retailer {
  id: string;
  name: string;
  address: string;
  phone?: string;
  category?: string;
  priority?: string;
  last_visit_date?: string;
  order_value?: number;
}

interface BeatRetailerExportProps {
  beatName: string;
  retailers: Retailer[];
}

const columnConfig = {
  name: { label: "Retailer Name", default: true },
  phone: { label: "Phone Number", default: true },
  address: { label: "Address", default: true },
  category: { label: "Category", default: false },
  priority: { label: "Priority", default: false },
  last_visit_date: { label: "Last Visit Date", default: false },
  order_value: { label: "Order Value (₹)", default: false },
};

type ColumnKey = keyof typeof columnConfig;

export const BeatRetailerExport = ({ beatName, retailers }: BeatRetailerExportProps) => {
  const [open, setOpen] = useState(false);
  const [translateAddresses, setTranslateAddresses] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const [selectedColumns, setSelectedColumns] = useState<Record<ColumnKey, boolean>>(
    Object.fromEntries(
      Object.entries(columnConfig).map(([key, config]) => [key, config.default])
    ) as Record<ColumnKey, boolean>
  );

  const handleColumnToggle = (column: ColumnKey) => {
    setSelectedColumns(prev => ({
      ...prev,
      [column]: !prev[column]
    }));
  };

  const translateAddressesToEnglish = async (addresses: string[]): Promise<string[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('translate-address', {
        body: { addresses }
      });

      if (error) {
        console.error('Translation error:', error);
        throw error;
      }

      return data.translatedAddresses || addresses;
    } catch (error) {
      console.error('Failed to translate addresses:', error);
      // Return original addresses if translation fails
      return addresses;
    }
  };

  const getSelectedData = (translatedAddresses?: string[]) => {
    return retailers.map((retailer, index) => {
      const row: Record<string, string | number> = { "S.No": index + 1 };
      
      Object.entries(selectedColumns).forEach(([key, isSelected]) => {
        if (isSelected) {
          const colKey = key as ColumnKey;
          const label = columnConfig[colKey].label;
          let value = retailer[colKey as keyof Retailer];
          
          // Use translated address if available
          if (colKey === 'address' && translatedAddresses) {
            value = translatedAddresses[index] || value;
          } else if (colKey === 'last_visit_date' && value) {
            value = new Date(value as string).toLocaleDateString('en-IN');
          } else if (colKey === 'order_value' && value) {
            value = `₹${(value as number).toLocaleString('en-IN')}`;
          }
          
          row[label] = value ?? '-';
        }
      });
      
      return row;
    });
  };

  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      let translatedAddresses: string[] | undefined;

      // Translate addresses if option is enabled and address column is selected
      if (translateAddresses && selectedColumns.address) {
        setIsTranslating(true);
        toast.info("Translating addresses to English...");
        
        const addresses = retailers.map(r => r.address);
        translatedAddresses = await translateAddressesToEnglish(addresses);
        
        setIsTranslating(false);
      }

      const selectedData = getSelectedData(translatedAddresses);
      
      if (selectedData.length === 0) {
        toast.error("No retailers to export");
        return;
      }

      if (format === 'excel') {
        await exportExcel(selectedData);
      } else {
        await exportPDF(selectedData);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export");
      setIsTranslating(false);
    }
  };

  const exportExcel = async (selectedData: Record<string, string | number>[]) => {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    
    // Header rows
    const titleRow = [`Beat: ${beatName}`];
    const countRow = [`Total Retailers: ${retailers.length}`];
    const dateRow = [`Generated: ${new Date().toLocaleDateString('en-IN')}`];
    const emptyRow = [''];
    
    // Data headers and rows
    const headers = Object.keys(selectedData[0] || {});
    const dataRows = selectedData.map(row => headers.map(header => row[header]));
    
    const allRows = [
      titleRow,
      countRow,
      dateRow,
      emptyRow,
      headers,
      ...dataRows
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(allRows);

    // Auto-size columns - compact widths
    const colWidths = headers.map((header, idx) => ({
      wch: Math.min(
        Math.max(
          header.length,
          ...dataRows.map(row => String(row[idx] || "").length)
        ),
        30
      )
    }));
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, "Retailers");

    const fileName = `${beatName.replace(/[^a-zA-Z0-9]/g, '_')}_Retailers.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast.success("Excel exported successfully");
    setOpen(false);
  };

  const exportPDF = async (selectedData: Record<string, string | number>[]) => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    // Always use landscape for better address visibility
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Beat heading
    doc.setFontSize(16);
    doc.setTextColor(41, 128, 185);
    doc.text(`Beat: ${beatName}`, 14, 15);
    
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Retailers: ${retailers.length}`, 14, 23);
    
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 29);

    // Prepare table data
    const headers = Object.keys(selectedData[0] || {});
    const rows = selectedData.map(row => 
      headers.map(header => String(row[header] || "-"))
    );

    // Find the index of the Address column
    const addressIndex = headers.findIndex(h => h === 'Address');
    const phoneIndex = headers.findIndex(h => h === 'Phone Number');
    const nameIndex = headers.findIndex(h => h === 'Retailer Name');

    // Build column styles dynamically
    const columnStyles: Record<number, { cellWidth: number | 'auto' | 'wrap' }> = {
      0: { cellWidth: 15 }, // S.No
    };
    
    if (nameIndex > 0) {
      columnStyles[nameIndex] = { cellWidth: 70 }; // Retailer Name
    }
    if (phoneIndex > 0) {
      columnStyles[phoneIndex] = { cellWidth: 35 }; // Phone Number
    }
    if (addressIndex > 0) {
      columnStyles[addressIndex] = { cellWidth: 'auto' }; // Address gets remaining space
    }

    // Compact table styling with full width
    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 35,
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        textColor: 255, 
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { top: 35, left: 10, right: 10, bottom: 10 },
      tableWidth: pageWidth - 20,
      columnStyles
    });

    const fileName = `${beatName.replace(/[^a-zA-Z0-9]/g, '_')}_Retailers.pdf`;
    const pdfBlob = doc.output('blob');
    await downloadPDF(pdfBlob, fileName);
    
    toast.success("PDF exported successfully");
    setOpen(false);
  };

  const allSelected = Object.values(selectedColumns).every(val => val);
  const noneSelected = Object.values(selectedColumns).every(val => !val);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Retailers</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Beat: <span className="font-semibold text-foreground">{beatName}</span>
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Select Columns</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const newValue = !allSelected;
                  setSelectedColumns(
                    Object.fromEntries(
                      Object.keys(columnConfig).map(key => [key, newValue])
                    ) as Record<ColumnKey, boolean>
                  );
                }}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </Button>
            </div>
            
            {Object.entries(columnConfig).map(([key, config]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${key}`}
                  checked={selectedColumns[key as ColumnKey]}
                  onCheckedChange={() => handleColumnToggle(key as ColumnKey)}
                />
                <Label
                  htmlFor={`col-${key}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {config.label}
                </Label>
              </div>
            ))}
          </div>

          {/* Translate option */}
          {selectedColumns.address && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="translate-addresses"
                  checked={translateAddresses}
                  onCheckedChange={(checked) => setTranslateAddresses(checked === true)}
                />
                <Label
                  htmlFor="translate-addresses"
                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                >
                  <Languages className="h-4 w-4 text-primary" />
                  Translate addresses to English
                </Label>
              </div>
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                Converts Kannada/Hindi addresses to English using AI
              </p>
            </div>
          )}

          <div className="pt-4 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              {retailers.length} retailer(s) will be exported
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleExport('excel')}
                disabled={noneSelected || isTranslating}
                className="gap-2"
                size="sm"
              >
                {isTranslating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Excel
              </Button>
              
              <Button
                onClick={() => handleExport('pdf')}
                disabled={noneSelected || isTranslating}
                variant="outline"
                className="gap-2"
                size="sm"
              >
                {isTranslating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
