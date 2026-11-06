# Send WhatsApp templates through the "Abhishek's Twilio (1)" connector

## What's different today
- **Trayi Jewellers** sends every WhatsApp message (including template test sends) through the linked Twilio connector. The connector holds the correct Twilio account login, so the sender number always matches the account.
- **This project** logs in to Twilio directly with the saved Account SID / Auth Token secrets. Those belong to a different Twilio account than the one where +91 7411678484 is registered — that's why "Send Test" says the number isn't a valid sender, while replies to "Hi" (which don't need a login) work.
- "Abhishek's Twilio (1)" is available and linkable to this project; it just hasn't been linked yet.

## Steps
1. **Link the connector** — open the connect card for "Abhishek's Twilio (1)" so you can approve it in chat.
2. **Switch "Send Test" to the connector** — the template test send (e.g. `kvp_welcome_message`) will go through the connector, using the template's Twilio Content ID and variables, from +91 7411678484 — same method as Trayi.
3. **Switch "Import from Twilio" to the connector** too, so templates are read from the same account that sends them.
4. Keep the old direct login as a fallback only if the connector isn't linked.
5. **Test**: send `kvp_welcome_message` to your phone from /communication-center and confirm it arrives.

## Technical details
- Edge function `whatsapp-templates`: replace `api.twilio.com/2010-04-01/Accounts/{sid}/...` calls with `https://connector-gateway.lovable.dev/twilio/Messages.json` (and `/content/v1/Content` for imports), headers `Authorization: Bearer LOVABLE_API_KEY` + `X-Connection-Api-Key: TWILIO_API_KEY`, form-encoded body with `From=whatsapp:+917411678484`, `To`, `ContentSid`, `ContentVariables` (mirrors Trayi's `whatsapp-send`).
- Keep the existing 200 `{success:false}` error shape so failures show a pop-up, not a blank screen.
- After linking, recommend enabling SMS Pumping Protection and Geo Permissions in Twilio.
