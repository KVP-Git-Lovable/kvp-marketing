 import React, { useState, useRef } from 'react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Trash2 } from 'lucide-react';
 import { useToast } from '@/hooks/use-toast';
 import { supabase } from '@/integrations/supabase/client';
 // xlsx loaded dynamically in handler
 
 interface ImportResult {
   processed: number;
   inserted: number;
   skipped: number;
   errors?: string[];
 }
 
 export const PincodeMasterImport: React.FC = () => {
   const { toast } = useToast();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [isImporting, setIsImporting] = useState(false);
   const [progress, setProgress] = useState(0);
   const [statusMessage, setStatusMessage] = useState('');
   const [totalRecords, setTotalRecords] = useState(0);
   const [processedRecords, setProcessedRecords] = useState(0);
   const [importResult, setImportResult] = useState<ImportResult | null>(null);
 
   const CHUNK_SIZE = 1000; // Records per API call
 
   const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;
 
     // Reset state
     setImportResult(null);
     setProgress(0);
     setProcessedRecords(0);
     setStatusMessage('Reading file...');
     setIsImporting(true);
 
     try {
       const XLSX = await import('xlsx');
       const data = await file.arrayBuffer();
       const workbook = XLSX.read(data, { type: 'array' });
       const sheetName = workbook.SheetNames[0];
       const worksheet = workbook.Sheets[sheetName];
      let jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Check if first row looks like a title row (not actual data)
      // This handles CSVs with a title line before the actual headers
      if (jsonData.length > 0) {
        const firstRow = jsonData[0] as Record<string, unknown>;
        const keys = Object.keys(firstRow);
        // If first row has a single key or no 'pincode' field, it might be a title row
        // Check if second row has proper structure
        if (keys.length === 1 || (!firstRow.pincode && !firstRow.Pincode)) {
          // Re-read skipping the first row by using range option
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
          range.s.r = 1; // Start from row 2 (0-indexed = 1)
          worksheet['!ref'] = XLSX.utils.encode_range(range);
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }
      }
 
       setTotalRecords(jsonData.length);
       setStatusMessage(`Found ${jsonData.length.toLocaleString()} records. Starting import...`);
 
       // Process in chunks
       let totalInserted = 0;
       let totalSkipped = 0;
       const allErrors: string[] = [];
 
       for (let i = 0; i < jsonData.length; i += CHUNK_SIZE) {
         const chunk = jsonData.slice(i, i + CHUNK_SIZE);
         const isFirstChunk = i === 0;
 
         setStatusMessage(`Uploading batch ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(jsonData.length / CHUNK_SIZE)}...`);
 
         const { data: result, error } = await supabase.functions.invoke('import-pincode-master', {
           body: {
             records: chunk,
             clearExisting: isFirstChunk, // Only clear on first batch
           },
         });
 
         if (error) {
           console.error('Import error:', error);
           allErrors.push(`Batch ${Math.floor(i / CHUNK_SIZE) + 1}: ${error.message}`);
         } else if (result) {
           totalInserted += result.inserted || 0;
           totalSkipped += result.skipped || 0;
           if (result.errors) {
             allErrors.push(...result.errors);
           }
         }
 
         const processed = Math.min(i + CHUNK_SIZE, jsonData.length);
         setProcessedRecords(processed);
         setProgress((processed / jsonData.length) * 100);
       }
 
       setImportResult({
         processed: jsonData.length,
         inserted: totalInserted,
         skipped: totalSkipped,
         errors: allErrors.length > 0 ? allErrors : undefined,
       });
 
       setStatusMessage('Import completed!');
       toast({
         title: 'Import Complete',
         description: `Successfully imported ${totalInserted.toLocaleString()} of ${jsonData.length.toLocaleString()} records.`,
       });
 
     } catch (error) {
       console.error('File processing error:', error);
       setStatusMessage('Import failed');
       toast({
         title: 'Import Failed',
         description: error instanceof Error ? error.message : 'Failed to process file',
         variant: 'destructive',
       });
     } finally {
       setIsImporting(false);
       if (fileInputRef.current) {
         fileInputRef.current.value = '';
       }
     }
   };
 
   const handleClearData = async () => {
     if (!confirm('Are you sure you want to delete all pincode master data? This cannot be undone.')) {
       return;
     }
 
     try {
       setStatusMessage('Clearing data...');
       setIsImporting(true);
 
      const { error } = await (supabase as any)
        .from('pincode_master')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
 
       if (error) throw error;
 
       setImportResult(null);
       setStatusMessage('Data cleared successfully');
       toast({
         title: 'Data Cleared',
         description: 'All pincode master data has been deleted.',
       });
     } catch (error) {
       console.error('Clear error:', error);
       toast({
         title: 'Clear Failed',
         description: error instanceof Error ? error.message : 'Failed to clear data',
         variant: 'destructive',
       });
     } finally {
       setIsImporting(false);
     }
   };
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2">
           <FileSpreadsheet className="h-5 w-5" />
           Pincode Master Import
         </CardTitle>
         <CardDescription>
           Upload a CSV or Excel file containing India PIN code data (officename, territory_po, pincode, district, statename, latitude, longitude)
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Upload Section */}
         <div className="flex gap-4">
           <input
             ref={fileInputRef}
             type="file"
             accept=".csv,.xlsx,.xls"
             onChange={handleFileSelect}
             className="hidden"
             disabled={isImporting}
           />
           <Button
             onClick={() => fileInputRef.current?.click()}
             disabled={isImporting}
             className="flex-1"
           >
             {isImporting ? (
               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
             ) : (
               <Upload className="h-4 w-4 mr-2" />
             )}
             {isImporting ? 'Importing...' : 'Select File to Import'}
           </Button>
           <Button
             variant="outline"
             onClick={handleClearData}
             disabled={isImporting}
             className="text-destructive hover:text-destructive"
           >
             <Trash2 className="h-4 w-4 mr-2" />
             Clear All Data
           </Button>
         </div>
 
         {/* Progress Section */}
         {(isImporting || statusMessage) && (
           <div className="space-y-2">
             <div className="flex justify-between text-sm text-muted-foreground">
               <span>{statusMessage}</span>
               {totalRecords > 0 && (
                 <span>
                   {processedRecords.toLocaleString()} / {totalRecords.toLocaleString()}
                 </span>
               )}
             </div>
             {isImporting && <Progress value={progress} className="h-2" />}
           </div>
         )}
 
         {/* Results Section */}
         {importResult && (
           <div className="rounded-lg border p-4 space-y-2">
             <div className="flex items-center gap-2">
               {importResult.errors && importResult.errors.length > 0 ? (
                 <XCircle className="h-5 w-5 text-amber-500" />
               ) : (
                 <CheckCircle className="h-5 w-5 text-emerald-500" />
               )}
               <span className="font-medium">Import Results</span>
             </div>
             <div className="grid grid-cols-3 gap-4 text-sm">
               <div>
                 <span className="text-muted-foreground">Total Processed:</span>
                 <p className="font-medium">{importResult.processed.toLocaleString()}</p>
               </div>
               <div>
                 <span className="text-muted-foreground">Successfully Inserted:</span>
                <p className="font-medium text-primary">{importResult.inserted.toLocaleString()}</p>
               </div>
               <div>
                 <span className="text-muted-foreground">Skipped (Invalid):</span>
                <p className="font-medium text-muted-foreground">{importResult.skipped.toLocaleString()}</p>
               </div>
             </div>
             {importResult.errors && importResult.errors.length > 0 && (
              <div className="mt-2 text-sm">
                 <p className="font-medium">Errors:</p>
                <ul className="list-disc list-inside text-destructive">
                   {importResult.errors.slice(0, 5).map((err, i) => (
                     <li key={i}>{err}</li>
                   ))}
                   {importResult.errors.length > 5 && (
                     <li>...and {importResult.errors.length - 5} more</li>
                   )}
                 </ul>
               </div>
             )}
           </div>
         )}
       </CardContent>
     </Card>
   );
 };