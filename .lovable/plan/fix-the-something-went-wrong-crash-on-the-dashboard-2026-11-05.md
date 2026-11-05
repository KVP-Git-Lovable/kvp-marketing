# Fix the "Something went wrong" crash on the dashboard

## What is happening
The dashboard crashes with: "cannot add postgres_changes callbacks for realtime:notifications-changes after subscribe()".

The notification hook runs twice on the dashboard, once for the top banner and once for the bell icon. Both copies open a live-update listener with the same fixed name, `notifications-changes`. The second copy gets back the first copy's listener, which is already running. Adding to a listener that is already running throws an error, and that error blanks the page.

It shows up now because the restored database has a notifications table, so the listener actually starts.

## Fix
1. In the notification hook, give each copy its own listener name (the fixed name plus the user and a random suffix). Both the banner and the bell then get live notifications without colliding.
2. Make the same change in the two other hooks with fixed listener names that more than one screen uses:
   - payment-proof setting listener
   - visit check-in setting listener
3. Check the dashboard loads while signed in as the admin, with no crash in the console.

## Not part of this fix
- The AI cards' text service returns "invalid key" because the 29 secrets haven't been entered yet. This doesn't crash the page. It clears up once you enter the secrets.

## Technical details
- `src/hooks/useNotifications.ts`: `.channel(\`notifications-changes-${user.id}-${crypto.randomUUID()}\`)`; cleanup via `removeChannel` stays the same.
- `src/hooks/usePaymentProofMandatory.ts` and `src/hooks/useLocationFeature.ts`: same pattern, giving each hook instance its own name.
- Verify with Playwright: restore the admin session, open `/dashboard`, and confirm the error boundary is not shown and there's no realtime error.
