import { supabase } from '@/integrations/supabase/client';

export interface InvoiceStorageFile {
  file_path: string;
  size_bytes: number;
  created_at: string;
}

export interface ExportProgress {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
  percent: number;
}

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Lists invoice files in the storage bucket created within [from, to] inclusive.
 * Date filtering happens server-side (created_at >= from 00:00, < to + 1 day).
 */
export async function listInvoiceFilesInRange(
  fromDate: string,
  toDate: string,
): Promise<InvoiceStorageFile[]> {
  const { data, error } = await supabase.rpc('list_invoice_files_in_range' as any, {
    p_from: fromDate,
    p_to: toDate,
  });
  if (error) throw error;
  return ((data as unknown as InvoiceStorageFile[]) ?? []).map((f) => ({
    ...f,
    size_bytes: Number(f.size_bytes) || 0,
  }));
}

/**
 * Downloads every listed file and streams it into a ZIP, preserving the original
 * path/folder structure. Originals are only read — never modified or removed.
 */
export async function exportInvoiceFilesAsZip(
  files: InvoiceStorageFile[],
  onProgress: (p: ExportProgress) => void,
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const totalBytes = files.reduce((s, f) => s + f.size_bytes, 0);
  let done = 0;
  let bytes = 0;

  for (const file of files) {
    const { data, error } = await supabase.storage.from('invoices').download(file.file_path);
    if (!error && data) {
      zip.file(file.file_path, await data.arrayBuffer());
      bytes += file.size_bytes;
    }
    done += 1;
    onProgress({
      done,
      total: files.length,
      bytes,
      totalBytes,
      percent: files.length ? Math.round((done / files.length) * 100) : 100,
    });
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
