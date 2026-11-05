import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarIcon, Download, FileArchive, Loader2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  exportInvoiceFilesAsZip, formatBytes, listInvoiceFilesInRange, triggerBlobDownload,
  type ExportProgress, type InvoiceStorageFile,
} from '@/utils/invoiceStorageExport';
import { useInvoiceCompression } from '@/hooks/useInvoiceCompression';

const toISO = (d: Date) => format(d, 'yyyy-MM-dd');

function DatePickerField({
  label, value, onChange,
}: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(value);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => { if (o) setMonth(value); setOpen(o); }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={label} className="justify-start font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="text-muted-foreground mr-1">{label}:</span>
          {format(value, 'dd MMM yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover" side="bottom" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => { if (d) { onChange(d); setMonth(d); setOpen(false); } }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}


interface InvoiceStorageToolbarProps {
  fromDate: Date;
  toDate: Date;
  onFromDateChange: (d: Date) => void;
  onToDateChange: (d: Date) => void;
  /** Number of invoice records already loaded for the same date range. */
  invoiceCountInRange?: number;
}

export default function InvoiceStorageToolbar({
  fromDate, toDate, onFromDateChange, onToDateChange, invoiceCountInRange = 0,
}: InvoiceStorageToolbarProps) {


  // Export state
  const [scanning, setScanning] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<InvoiceStorageFile[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);

  // Compression state
  const compression = useInvoiceCompression();
  const [compressOpen, setCompressOpen] = useState(false);

  const rangeInvalid = fromDate > toDate;

  const handleScanForExport = async () => {
    if (rangeInvalid) { toast.error('From Date must be on or before To Date'); return; }
    setScanning(true);
    try {
      const files = await listInvoiceFilesInRange(toISO(fromDate), toISO(toDate));
      if (!files.length) {
        if (invoiceCountInRange > 0) {
          // Records exist for these dates but nothing is stored in the bucket:
          // find the newest stored file overall so the user knows the cut-off.
          let latest: string | null = null;
          try {
            const all = await listInvoiceFilesInRange('2000-01-01', toISO(new Date()));
            latest = all.reduce<string | null>(
              (max, f) => (!max || f.created_at > max ? f.created_at : max),
              null,
            );
          } catch {
            latest = null;
          }
          const suffix = latest
            ? ` Physical files exist up to ${format(new Date(latest), 'dd MMM yyyy')}.`
            : '';
          toast.info(
            'Invoices exist for these dates, but physical PDF files are not stored in Supabase Storage for recent invoices.' + suffix,
            { duration: 10000 },
          );
        } else {
          toast.info('No invoice files found in the selected date range');
        }
        return;
      }
      setPendingFiles(files);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not read the invoice files');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmExport = async () => {
    const files = pendingFiles ?? [];
    setPendingFiles(null);
    if (!files.length) return;
    setExporting(true);
    setExportProgress({ done: 0, total: files.length, bytes: 0, totalBytes: files.reduce((s, f) => s + f.size_bytes, 0), percent: 0 });
    try {
      const blob = await exportInvoiceFilesAsZip(files, setExportProgress);
      triggerBlobDownload(blob, `invoices-${toISO(fromDate)}-to-${toISO(toDate)}.zip`);
      toast.success(`Exported ${files.length} invoice files`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Export failed');
    } finally {
      setExporting(false);
      setTimeout(() => setExportProgress(null), 4000);
    }
  };

  const handleStartCompression = async () => {
    if (rangeInvalid) { toast.error('From Date must be on or before To Date'); return; }
    setCompressOpen(true);
    await compression.start(toISO(fromDate), toISO(toDate));
  };

  const pendingCount = pendingFiles?.length ?? 0;
  const pendingBytes = (pendingFiles ?? []).reduce((s, f) => s + f.size_bytes, 0);
  const { stats, savingsPercent } = compression;

  return (
    <div className="space-y-2">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <DatePickerField label="From Date" value={fromDate} onChange={onFromDateChange} />
        <DatePickerField label="To Date" value={toDate} onChange={onToDateChange} />

        <Button
          onClick={handleScanForExport}
          disabled={scanning || exporting}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {scanning || exporting
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <FileArchive className="mr-2 h-4 w-4" />}
          Export Files
        </Button>
        <Button
          onClick={handleStartCompression}
          disabled={compression.running}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          {compression.running
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Minimize2 className="mr-2 h-4 w-4" />}
          Compress Large Invoices (&gt;300KB)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Both actions use the same selected date range. Original invoice files are never
        deleted; compression keeps a backup copy of every file it touches.
      </p>

      {exportProgress && (
        <div className="space-y-1">
          <Progress value={exportProgress.percent} />
          <p className="text-xs text-muted-foreground">
            {exportProgress.done} / {exportProgress.total} files ·{' '}
            {formatBytes(exportProgress.bytes)} of {formatBytes(exportProgress.totalBytes)} ·{' '}
            {exportProgress.percent}%
          </p>
        </div>
      )}


      {/* Export confirmation */}
      <AlertDialog open={!!pendingFiles} onOpenChange={(o) => !o && setPendingFiles(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export {pendingCount} invoice files?</AlertDialogTitle>
            <AlertDialogDescription>
              {format(fromDate, 'dd MMM yyyy')} – {format(toDate, 'dd MMM yyyy')} ·{' '}
              {pendingCount} files · {formatBytes(pendingBytes)} total.
              They will be packed into a ZIP download with their original filenames and folders.
              Nothing is changed or removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmExport}>
              <Download className="mr-2 h-4 w-4" /> Start Export
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compression progress */}
      <Dialog
        open={compressOpen}
        onOpenChange={(o) => { if (!o && !compression.running) { setCompressOpen(false); compression.reset(); } }}
      >
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Compressing large invoices</DialogTitle>
            <DialogDescription>
              {format(fromDate, 'dd MMM yyyy')} – {format(toDate, 'dd MMM yyyy')} · files larger than 300KB
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Progress
              value={stats.totalTarget ? Math.round((stats.processed / stats.totalTarget) * 100) : (compression.finished ? 100 : 0)}
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-muted-foreground">Processed</span>
              <span className="text-right font-medium">{stats.processed} / {stats.totalTarget}</span>
              <span className="text-muted-foreground">Compressed</span>
              <span className="text-right font-medium">{stats.compressed}</span>
              <span className="text-muted-foreground">Skipped</span>
              <span className="text-right font-medium">{stats.skipped}</span>
              <span className="text-muted-foreground">Failed</span>
              <span className="text-right font-medium">{stats.failed}</span>
              <span className="text-muted-foreground">Original size</span>
              <span className="text-right font-medium">{formatBytes(stats.originalBytes)}</span>
              <span className="text-muted-foreground">Compressed size</span>
              <span className="text-right font-medium">{formatBytes(stats.compressedBytes)}</span>
              <span className="text-muted-foreground">Total space saved</span>
              <span className="text-right font-medium">{formatBytes(stats.savedBytes)}</span>
              <span className="text-muted-foreground">Savings</span>
              <span className="text-right font-medium">{savingsPercent.toFixed(1)}%</span>
            </div>

            {compression.error && (
              <p className="text-sm text-destructive">{compression.error}</p>
            )}
            {compression.finished && !compression.error && stats.processed === 0 && (
              <p className="text-sm text-muted-foreground">
                No invoice files larger than 300KB were found in this date range.
              </p>
            )}
          </div>

          <DialogFooter>
            {compression.running ? (
              <Button variant="outline" onClick={compression.cancel}>Stop after this batch</Button>
            ) : (
              <Button onClick={() => { setCompressOpen(false); compression.reset(); }}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
