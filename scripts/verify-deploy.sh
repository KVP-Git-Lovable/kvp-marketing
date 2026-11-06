#!/usr/bin/env bash
# Prints the build marker each deployed edge function reports, so a deploy can be confirmed after a push.
BASE="https://fuicsoheofipzbmomdtv.supabase.co/functions/v1"
for fn in meta-api journey-actions process-journeys webhook-whatsapp journey-retry whatsapp-inbound; do
  header=$(curl -s -i -X OPTIONS "$BASE/$fn" | tr -d '\r' | grep -i -E '^x-(meta-api|journeys|webhook|retry|inbound)-build:' | head -1)
  printf '%-18s %s\n' "$fn" "${header:-NO BUILD MARKER (old version or not deployed)}"
done
