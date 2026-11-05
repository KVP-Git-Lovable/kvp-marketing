import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
// xlsx loaded dynamically in handlers

interface BulkImportRetailersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ParsedRetailer {
  name: string;
  phone: string;
  address: string;
  beat_name: string;
  retail_type: string;
  category: string;
  parent_type: string;
  distributor_name: string;
}

const REQUIRED_COLUMNS = [
  "Retailer Name",
  "Phone Number", 
  "Address",
  "Beat Name",
  "Retailer Type",
  "Category",
  "Parent Type",
  "Distributor"
];

export const BulkImportRetailersModal = ({ open, onOpenChange, onSuccess }: BulkImportRetailersModalProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRetailer[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([REQUIRED_COLUMNS]);
    // Set column widths
    ws['!cols'] = REQUIRED_COLUMNS.map(col => ({ wch: Math.max(col.length + 5, 18) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Retailers");
    XLSX.writeFile(wb, "Retailer_Import_Template.xlsx");
    toast({ title: "Template downloaded", description: "Fill in the data and upload it back here." });
  };

  const normalizeColumnName = (col: string): string => {
    return col.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const normalizedName = normalizeColumnName(name);
      const index = headers.findIndex(h => normalizeColumnName(h) === normalizedName);
      if (index !== -1) return index;
    }
    return -1;
  };

  const parseExcelFile = async (file: File) => {
    setParseError(null);
    setParsedData([]);
    
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

      if (jsonData.length < 2) {
        setParseError("File must have at least a header row and one data row");
        return;
      }

      const headers = jsonData[0].map(h => String(h || '').trim());
      
      // Find column indices with flexible matching
      const colIndices = {
        name: findColumnIndex(headers, ["Retailer Name", "Name", "RetailerName"]),
        phone: findColumnIndex(headers, ["Phone Number", "Phone", "PhoneNumber", "Mobile", "Contact"]),
        address: findColumnIndex(headers, ["Address", "Location"]),
        beatName: findColumnIndex(headers, ["Beat Name", "BeatName", "Beat"]),
        retailType: findColumnIndex(headers, ["Retailer Type", "RetailerType", "Type", "Retail Type"]),
        category: findColumnIndex(headers, ["Category"]),
        parentType: findColumnIndex(headers, ["Parent Type", "ParentType"]),
        distributor: findColumnIndex(headers, ["Distributor", "Distributor Name", "DistributorName"])
      };

      // Check for missing required columns
      const missingColumns: string[] = [];
      if (colIndices.name === -1) missingColumns.push("Retailer Name");
      if (colIndices.phone === -1) missingColumns.push("Phone Number");
      if (colIndices.address === -1) missingColumns.push("Address");
      if (colIndices.beatName === -1) missingColumns.push("Beat Name");
      if (colIndices.retailType === -1) missingColumns.push("Retailer Type");
      if (colIndices.category === -1) missingColumns.push("Category");
      if (colIndices.parentType === -1) missingColumns.push("Parent Type");
      if (colIndices.distributor === -1) missingColumns.push("Distributor");

      if (missingColumns.length > 0) {
        setParseError(`Missing required columns: ${missingColumns.join(", ")}`);
        return;
      }

      // Parse data rows
      const retailers: ParsedRetailer[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;

        const name = String(row[colIndices.name] || '').trim();
        const beatName = String(row[colIndices.beatName] || '').trim();
        
        // Skip rows without required data
        if (!name || !beatName) continue;

        retailers.push({
          name,
          phone: String(row[colIndices.phone] || '').trim(),
          address: String(row[colIndices.address] || '').trim(),
          beat_name: beatName,
          retail_type: String(row[colIndices.retailType] || '').trim(),
          category: String(row[colIndices.category] || '').trim(),
          parent_type: String(row[colIndices.parentType] || '').trim(),
          distributor_name: String(row[colIndices.distributor] || '').trim()
        });
      }

      if (retailers.length === 0) {
        setParseError("No valid data rows found. Make sure Retailer Name and Beat Name are filled.");
        return;
      }

      setParsedData(retailers);
      setFileName(file.name);
    } catch (error) {
      console.error("Excel parse error:", error);
      setParseError("Failed to parse Excel file. Please check the file format.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
  };

  const handleImport = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    if (parsedData.length === 0) {
      toast({ title: "Error", description: "No data to import", variant: "destructive" });
      return;
    }

    setImporting(true);

    try {
      // Get unique beat names and fetch matching beats
      const uniqueBeatNames = [...new Set(parsedData.map(r => r.beat_name))];
      const { data: beats, error: beatsError } = await supabase
        .from('beats')
        .select('id, beat_id, beat_name')
        .in('beat_name', uniqueBeatNames);

      if (beatsError) {
        console.error("Error fetching beats:", beatsError);
        toast({ title: "Error", description: "Failed to fetch beats", variant: "destructive" });
        setImporting(false);
        return;
      }

      // Create beat name to beat_id mapping
      const beatMap = new Map<string, string>();
      beats?.forEach(beat => {
        beatMap.set(beat.beat_name.toLowerCase(), beat.beat_id);
      });

      // Get unique distributor names and fetch matching distributors
      const uniqueDistributorNames = [...new Set(parsedData.map(r => r.distributor_name).filter(Boolean))];
      let distributorMap = new Map<string, string>();
      
      if (uniqueDistributorNames.length > 0) {
        const { data: distributors, error: distError } = await supabase
          .from('distributors')
          .select('id, name')
          .in('name', uniqueDistributorNames);

        if (!distError && distributors) {
          distributors.forEach(dist => {
            distributorMap.set(dist.name.toLowerCase(), dist.id);
          });
        }
      }

      // Prepare batch insert with beat_id matching
      const payload = parsedData.map(r => {
        const matchedBeatId = beatMap.get(r.beat_name.toLowerCase());
        const matchedDistributorId = r.distributor_name ? distributorMap.get(r.distributor_name.toLowerCase()) : null;
        
        return {
          user_id: user.id,
          name: r.name,
          phone: r.phone || null,
          address: r.address || '',
          beat_id: matchedBeatId || r.beat_name.toLowerCase().replace(/\s+/g, '-'),
          beat_name: r.beat_name,
          retail_type: r.retail_type || null,
          category: r.category || null,
          parent_type: r.parent_type || null,
          distributor_id: matchedDistributorId || null,
          status: 'active',
          entity_type: 'retailer'
        };
      });

      // Check for unmatched beats
      const unmatchedBeats = uniqueBeatNames.filter(name => !beatMap.has(name.toLowerCase()));
      if (unmatchedBeats.length > 0) {
        console.warn("Some beat names didn't match existing beats:", unmatchedBeats);
      }

      const { error } = await supabase
        .from('retailers')
        .insert(payload);

      if (error) {
        console.error('Import error:', error);
        toast({ 
          title: "Import failed", 
          description: error.message, 
          variant: "destructive" 
        });
      } else {
        let successMessage = `Successfully imported ${parsedData.length} retailers`;
        if (unmatchedBeats.length > 0) {
          successMessage += `. Note: ${unmatchedBeats.length} beat names didn't match existing beats.`;
        }
        toast({ 
          title: "Success", 
          description: successMessage
        });
        setParsedData([]);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onOpenChange(false);
        onSuccess();
      }
    } catch (err) {
      console.error('Import error:', err);
      toast({ 
        title: "Error", 
        description: "Failed to import retailers.", 
        variant: "destructive" 
      });
    }

    setImporting(false);
  };

  const handleClose = () => {
    setParsedData([]);
    setFileName(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Import Retailers
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Excel File Format</p>
                <p className="text-xs text-muted-foreground">
                  Upload an Excel file (.xlsx, .xls) with the following required columns:
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-1">
                  {REQUIRED_COLUMNS.map(col => (
                    <li key={col}>{col}</li>
                  ))}
                </ul>
                <Button variant="outline" size="sm" className="mt-3" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="text-sm font-medium mb-2 block">Select Excel File:</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-primary file:text-primary-foreground
                hover:file:bg-primary/90
                cursor-pointer"
            />
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
              <p className="text-sm">{parseError}</p>
            </div>
          )}

          {/* Success Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">
                  {parsedData.length} retailers ready to import from {fileName}
                </p>
              </div>
              
              {/* Preview Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="p-2 text-left font-medium">Name</th>
                        <th className="p-2 text-left font-medium">Phone</th>
                        <th className="p-2 text-left font-medium">Beat</th>
                        <th className="p-2 text-left font-medium">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 10).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2">{r.phone}</td>
                          <td className="p-2">{r.beat_name}</td>
                          <td className="p-2">{r.retail_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 10 && (
                  <p className="text-xs text-muted-foreground p-2 border-t text-center">
                    ... and {parsedData.length - 10} more retailers
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={importing || parsedData.length === 0}
          >
            {importing ? "Importing..." : `Import ${parsedData.length} Retailers`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
