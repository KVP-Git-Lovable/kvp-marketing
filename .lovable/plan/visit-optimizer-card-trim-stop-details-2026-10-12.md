# Visit Optimizer card — trim stop details

Scope: only `src/components/VisitOptimizerRouteCard.tsx`. No change to scoring, the edge function, the hook, or any other file.

## What changes

`stopReason()` currently builds each stop's reason line from: typical order time, days since last visit, pending dues, and order strike rate. It becomes order time + last visit only:

- Remove the pending dues fragment (`₹X pending`) from the stop reason line.
- Remove the order strike rate fragment (`X% order strike rate`) from the stop reason line.
- Keep: `usually orders around HH AM/PM` and `last visit Nd ago` / `not visited yet`.
- The `inr` helper is deleted if nothing else uses it.
- The `pending` field stays part of the `RouteStop` type (the hook still supplies it); it is simply not rendered here.

## Subtitle update

Line 128 currently reads "Best visiting order from your order times, GPS distances and dues". Dues are no longer shown anywhere on the card, so the subtitle becomes "Best visiting order from your order times, GPS distances and visit history".

## What does NOT change

- The 4-factor score (recency 40 + strike rate 35 + 30-day order value 25) still drives ranking server-side — strike rate stays a scoring factor, it is just not displayed.
- Stop order, total km, clusters, "Suggest Route"/"Reset", collapse behaviour, and styling are untouched.

## Validation

Build check, then a Playwright look at `/visits/retailers` with the card expanded to confirm stop lines show only order time and last-visit info.
