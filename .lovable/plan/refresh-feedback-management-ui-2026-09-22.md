# Refresh Feedback Management UI

## Goal
Make the **Overview** and **Feedback Configuration** areas easier to scan and more polished, while preserving all existing feedback data, filters, actions, forms, and rules.

## What will change
- Refine the page header and main Overview/Configuration switch so the two areas are clearer and visually balanced.
- Improve the Overview date filter, category tabs, record counts, table framing, loading states, and empty states.
- Improve Feedback Configuration hierarchy with clearer question-set selection, question sections, policy rows, statuses, and action placement.
- Keep the interface compact and professional, using the app’s existing navy, gold, neutral, success, warning, and destructive theme tokens.
- Make the updated layouts work cleanly on desktop and smaller screens without changing the information shown.

## Technical details
- UI-only updates in the existing Feedback Management and feedback configuration components.
- Keep all Supabase queries, scoring, policy evaluation, create/edit/delete actions, filters, dialogs, and detail views unchanged.
- Use existing shared controls and semantic color tokens; no new sample data or unrelated feature changes.
- Remove the existing tab badge ref warning by keeping badges outside the tab trigger’s cloned child path, without changing counts or tab behavior.
- Validate with the project build and a focused source/runtime check; authenticated visual verification may require a signed-in preview session because this project uses externally managed authentication.
