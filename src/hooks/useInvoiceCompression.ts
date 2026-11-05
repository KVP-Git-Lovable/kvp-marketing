import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CompressionStats {
  processed: number;
  totalTarget: number;
  compressed: number;
  skipped: number;
  failed: number;
  originalBytes: number;
  compressedBytes: number;
  savedBytes: number;
}

const emptyStats: CompressionStats = {
  processed: 0,
  totalTarget: 0,
  compressed: 0,
  skipped: 0,
  failed: 0,
  originalBytes: 0,
  compressedBytes: 0,
  savedBytes: 0,
};

export function useInvoiceCompression() {
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stats, setStats] = useState<CompressionStats>(emptyStats);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    setStats(emptyStats);
    setError(null);
    setFinished(false);
    cancelRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /** Runs batches of 10 through the edge function until no eligible files remain. */
  const start = useCallback(async (fromDate: string, toDate: string) => {
    reset();
    setRunning(true);

    let acc = { ...emptyStats };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Your session expired — please sign in again');
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (cancelRef.current) break;

        const { data, error: fnError } = await supabase.functions.invoke(
          'compress-historical-invoices',
          {
            body: { fromDate, toDate },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);
        if (data?.locked) throw new Error(data.message ?? 'A compression job is already running.');

        const results: any[] = data?.results ?? [];
        const remaining: number = Number(data?.remaining ?? 0);
        const totalEligible: number = Number(data?.total_eligible ?? 0);

        acc = {
          ...acc,
          totalTarget: Math.max(acc.totalTarget, acc.processed + totalEligible),
        };

        for (const r of results) {
          acc.processed += 1;
          acc.originalBytes += Number(r.original_size_bytes) || 0;
          if (r.status === 'COMPRESSED') {
            acc.compressed += 1;
            acc.compressedBytes += Number(r.compressed_size_bytes) || 0;
            acc.savedBytes += Number(r.saved_bytes) || 0;
          } else if (r.status === 'SKIPPED_NOT_SMALLER') {
            acc.skipped += 1;
            acc.compressedBytes += Number(r.original_size_bytes) || 0;
          } else {
            acc.failed += 1;
            acc.compressedBytes += Number(r.original_size_bytes) || 0;
          }
        }

        setStats({ ...acc });

        if (!results.length || remaining <= 0) break;
      }
      setFinished(true);
    } catch (e: any) {
      setError(e?.message ?? 'Compression failed');
      setFinished(true);
    } finally {
      setRunning(false);
    }
  }, [reset]);

  const savingsPercent =
    stats.originalBytes > 0 ? (stats.savedBytes / stats.originalBytes) * 100 : 0;

  return { running, finished, stats, error, savingsPercent, start, cancel, reset };
}
