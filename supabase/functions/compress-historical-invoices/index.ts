import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

const SOURCE_BUCKET = 'invoices';
const BACKUP_BUCKET = 'invoices-backup';
const BATCH_SIZE = 10;
const LOCK_KEY = 918273645;

type FileResult = {
  file_path: string;
  status: 'COMPRESSED' | 'SKIPPED_NOT_SMALLER' | 'FAILED_VALIDATION' | 'ERROR';
  original_size_bytes: number;
  compressed_size_bytes: number | null;
  saved_bytes: number;
  error_message: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  let lockAcquired = false;

  try {
    // ---- auth: caller must be a signed-in user -------------------------------
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      console.error('[compress-historical-invoices] missing Authorization bearer token');
      return json({ error: 'Missing session token. Please sign in again.', code: 'MISSING_TOKEN' }, 401);
    }

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
    );
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      console.error(
        '[compress-historical-invoices] token rejected:',
        claimsErr?.message ?? 'no claims returned',
      );
      return json({ error: 'Session token rejected. Please sign in again.', code: 'INVALID_TOKEN' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const fromDate = String(body?.fromDate ?? '');
    const toDate = String(body?.toDate ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return json({ error: 'fromDate and toDate are required (YYYY-MM-DD)' }, 400);
    }

    // ---- single-run guard ----------------------------------------------------
    const { data: lockRows, error: lockErr } = await admin.rpc('try_invoice_compression_lock', {
      p_key: LOCK_KEY,
    });
    if (lockErr) return json({ error: `Could not acquire job lock: ${lockErr.message}` }, 500);
    if (lockRows !== true) return json({ locked: true, message: 'A compression job is already running.' });
    lockAcquired = true;

    // ---- candidates ---------------------------------------------------------
    const { data: candidates, error: candErr } = await admin.rpc(
      'get_invoice_compression_candidates',
      { p_from: fromDate, p_to: toDate, p_limit: BATCH_SIZE },
    );
    if (candErr) throw new Error(candErr.message);

    const list = (candidates ?? []) as { file_path: string; size_bytes: number; total_remaining: number }[];
    const totalEligible = list.length ? Number(list[0].total_remaining) : 0;

    if (!list.length) {
      return json({ results: [], processed: 0, remaining: 0, total_eligible: 0 });
    }

    const results: FileResult[] = [];

    for (const item of list) {
      const filePath = item.file_path;
      const originalSize = Number(item.size_bytes) || 0;
      let result: FileResult = {
        file_path: filePath,
        status: 'ERROR',
        original_size_bytes: originalSize,
        compressed_size_bytes: null,
        saved_bytes: 0,
        error_message: null,
      };

      try {
        // 1. download original
        const { data: original, error: dlErr } = await admin.storage.from(SOURCE_BUCKET).download(filePath);
        if (dlErr || !original) throw new Error(`Download failed: ${dlErr?.message ?? 'no data'}`);
        const originalBytes = new Uint8Array(await original.arrayBuffer());

        // 2. backup
        const { error: backupErr } = await admin.storage
          .from(BACKUP_BUCKET)
          .upload(filePath, originalBytes, { contentType: 'application/pdf', upsert: true });
        if (backupErr) throw new Error(`Backup failed: ${backupErr.message}`);

        // 3. verify backup
        const { data: backupCopy, error: backupDlErr } = await admin.storage
          .from(BACKUP_BUCKET)
          .download(filePath);
        if (backupDlErr || !backupCopy) throw new Error('Backup verification failed: file missing');
        const backupSize = (await backupCopy.arrayBuffer()).byteLength;
        if (backupSize !== originalBytes.byteLength) {
          throw new Error('Backup verification failed: size mismatch');
        }

        // 4. compress
        const srcDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
        const originalPages = srcDoc.getPageCount();
        const compressedBytes = await srcDoc.save({ useObjectStreams: true, addDefaultPage: false });

        // 5. validate
        let validationError: string | null = null;
        if (!compressedBytes || compressedBytes.byteLength === 0) {
          validationError = 'Compressed file is empty';
        } else {
          try {
            const check = await PDFDocument.load(compressedBytes, { ignoreEncryption: true });
            if (check.getPageCount() !== originalPages) {
              validationError = `Page count mismatch (${check.getPageCount()} vs ${originalPages})`;
            }
          } catch (e) {
            validationError = `Compressed file is not a valid PDF: ${(e as Error).message}`;
          }
        }

        if (validationError) {
          result = {
            ...result,
            status: 'FAILED_VALIDATION',
            compressed_size_bytes: compressedBytes?.byteLength ?? null,
            error_message: validationError,
          };
        } else if (compressedBytes.byteLength >= originalBytes.byteLength) {
          result = {
            ...result,
            status: 'SKIPPED_NOT_SMALLER',
            compressed_size_bytes: compressedBytes.byteLength,
          };
        } else {
          // 6. replace original, then verify what landed
          const { error: upErr } = await admin.storage
            .from(SOURCE_BUCKET)
            .upload(filePath, compressedBytes, { contentType: 'application/pdf', upsert: true });
          if (upErr) throw new Error(`Replace failed: ${upErr.message}`);

          const { data: verify, error: verifyErr } = await admin.storage
            .from(SOURCE_BUCKET)
            .download(filePath);
          if (verifyErr || !verify) throw new Error('Post-upload verification failed');
          const verifyBytes = new Uint8Array(await verify.arrayBuffer());
          if (verifyBytes.byteLength !== compressedBytes.byteLength) {
            // restore from backup to be safe
            await admin.storage
              .from(SOURCE_BUCKET)
              .upload(filePath, originalBytes, { contentType: 'application/pdf', upsert: true });
            throw new Error('Post-upload size mismatch, original restored');
          }
          await PDFDocument.load(verifyBytes, { ignoreEncryption: true });

          result = {
            ...result,
            status: 'COMPRESSED',
            compressed_size_bytes: compressedBytes.byteLength,
            saved_bytes: originalBytes.byteLength - compressedBytes.byteLength,
          };
        }
      } catch (e) {
        result = { ...result, status: 'ERROR', error_message: (e as Error).message };
      }

      await admin.from('invoice_compression_logs').upsert(
        {
          file_path: filePath,
          original_size_bytes: result.original_size_bytes,
          compressed_size_bytes: result.compressed_size_bytes,
          saved_bytes: result.saved_bytes,
          backup_path: `${BACKUP_BUCKET}/${filePath}`,
          status: result.status,
          error_message: result.error_message,
          processed_at: new Date().toISOString(),
        },
        { onConflict: 'file_path' },
      );

      results.push(result);
    }

    // recompute remaining eligible files after this batch
    const { data: after } = await admin.rpc('get_invoice_compression_candidates', {
      p_from: fromDate,
      p_to: toDate,
      p_limit: 1,
    });
    const remaining = after && (after as any[]).length ? Number((after as any[])[0].total_remaining) : 0;

    return json({
      results,
      processed: results.length,
      remaining,
      total_eligible: totalEligible,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  } finally {
    if (lockAcquired) {
      await Promise.resolve(admin.rpc('release_invoice_compression_lock', { p_key: LOCK_KEY })).catch(() => {});
    }
  }
});
