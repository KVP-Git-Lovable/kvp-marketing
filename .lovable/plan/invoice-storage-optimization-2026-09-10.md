# Invoice Storage Optimization

Add an export + compression toolbar to the Invoices tab of Invoice Management, driven by one shared date range.

## What you'll see

At the top of the Invoices tab, a new panel:

```text
From Date: 2026-06-01     To Date: 2026-08-15
[ Export Files ]   [ Compress Large Invoices (>300KB) ]
```

Both buttons use the same two dates — no separate ranges. The user should be able to choose the from and to dates as a date picker. do not harcode any date

**Export Files** scans the invoice file store for files created in the range, shows a confirmation with file count and total size, then builds a ZIP download that keeps original filenames and folder paths. A progress display shows files done / total, size and percentage. Originals are never touched.

**Compress Large Invoices** finds files in the range larger than 300KB that were not already processed, and works through them in batches of 10 until none are left. A progress modal shows processed/total, compressed, skipped, failed, original size, compressed size, total saved and savings %.

### Note on current data

The invoice file store today holds 127 files; the largest is about 12KB, and files created between 1 Jun and 15 Aug 2026 total roughly 0.6MB. So compression will find zero files over 300KB right now and will correctly report "no eligible files". The feature is still built as specified so it works once large invoices exist.

## Technical plan

### Database (migration)

- `public.invoice_compression_logs`: `id`, `file_path` (unique), `original_size_bytes`, `compressed_size_bytes`, `saved_bytes`, `backup_path`, `status`, `error_message`, `processed_at`, `created_at`. Status constrained to `COMPRESSED | SKIPPED_NOT_SMALLER | FAILED_VALIDATION | ERROR`.
- GRANTs: `SELECT` to `authenticated`, `ALL` to `service_role`; RLS on; read policy for authenticated, writes only via service role (edge function).
- Advisory-lock based single-run guard: edge function takes `pg_try_advisory_lock` on a fixed key so concurrent jobs return `{ locked: true }`.

### Storage

- Create private bucket `invoices-backup` via the storage tool.
- RLS policies on `storage.objects` for that bucket: no anon/authenticated access (service role only).

### Edge function `compress-historical-invoices`

Input: `{ fromDate, toDate }`. Per invocation:

1. Acquire advisory lock; release in `finally`.
2. Select candidates via a SECURITY DEFINER RPC (`get_invoice_compression_candidates(p_from, p_to, p_limit)`) that reads `storage.objects` for bucket `invoices` where `created_at >= from`, `created_at < to+1 day`, `(metadata->>'size')::bigint > 307200`, and `name` not in `invoice_compression_logs` with status `COMPRESSED`/`SKIPPED_NOT_SMALLER`. Keyset ordering by `name` — no OFFSET.
3. For each of up to 10 files: download original → upload to `invoices-backup/<same path>` → verify backup exists and size matches → load with `pdf-lib`, re-save with object streams → validate (parses, non-empty, identical page count) → compare sizes.
  - Smaller → upload over original (upsert), re-verify uploaded size, log `COMPRESSED`.
  - Not smaller → log `SKIPPED_NOT_SMALLER`, original untouched.
  - Validation fails → `FAILED_VALIDATION`. Unexpected error → `ERROR`. Each file wrapped in its own try/catch so one failure never aborts the batch.
4. Return per-file results plus `remaining` count so the client keeps calling until zero.

`verify_jwt = true` for this function (admin-only page); it validates the caller is an admin before running.

### Frontend

- New `src/components/invoice/InvoiceStorageToolbar.tsx`: shared date range (Popover + Calendar, defaults 2026-06-01 / 2026-08-15), the two buttons, confirmation `AlertDialog` for export, and progress modal for compression.
- New `src/utils/invoiceStorageExport.ts`: lists matching files through a small RPC (`list_invoice_files_in_range`) so date filtering happens server-side, downloads each file from the `invoices` bucket, streams into a ZIP using `jszip` (new dependency), preserving path structure, reporting progress via callback.
- New `src/hooks/useInvoiceCompression.ts`: loops the edge function in batches of 10, accumulates counters/sizes for the modal, stops on `remaining === 0` or a `locked` response.
- `AllInvoicesList.tsx`: render the toolbar above the existing table. No other change to invoice behaviour.

### Not touched

Templates, display settings, credit notes, per-row invoice actions, invoice generation.