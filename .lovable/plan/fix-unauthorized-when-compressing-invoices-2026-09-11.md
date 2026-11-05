# Fix "Unauthorized" when compressing invoices

## What happens today

Clicking **Compress Large Invoices (>300KB)** fails immediately with an "Unauthorized" message, so no invoice is ever processed. The function does start up (its logs show boot events), so the request reaches it but the sign-in check inside it rejects the logged-in user.

## Cause

The compression job verifies the caller with an admin/service-role connection and the older `getUser(token)` check. On this project's current authentication setup (asymmetric signing keys), that check does not reliably confirm a signed-in user, and the request is refused before any work starts. The same request path is also gated a second time at the platform level (`verify_jwt = true`), which can reject the call before the function's own, clearer error handling runs.

## Fix

1. Validate the caller the way the rest of this project's functions do: create a normal (anon-key) client with the caller's `Authorization` header and verify the token with `getClaims`. Keep the service-role client only for storage and log writes.
2. Turn off the duplicate platform gate for this function (`verify_jwt = false` in `supabase/config.toml`) so the in-code check is the single source of truth and returns a meaningful message.
3. Send the session token explicitly from the app when invoking the job, and if there is no active session, show "Your session expired — please sign in again" instead of a raw "Unauthorized".
4. Return distinct messages for "no token sent" and "token rejected" so future failures are diagnosable from the logs.
5. Verify by running a compression batch over the selected date range and confirming the progress panel advances (processed / compressed / skipped counts) with no error.

## Technical notes

- `supabase/functions/compress-historical-invoices/index.ts`: replace `admin.auth.getUser(token)` with an anon client + `getClaims(token)`; keep `SUPABASE_SERVICE_ROLE_KEY` client for `storage` and `invoice_compression_logs`.
- `supabase/config.toml`: `[functions.compress-historical-invoices] verify_jwt = false`.
- `src/hooks/useInvoiceCompression.ts`: read `supabase.auth.getSession()`, pass `headers: { Authorization: \`Bearer ${access_token}\` }`, and surface a friendly session-expired error.
- No change to the compression, backup, validation, or export logic; no change to the table or toolbar UI.
