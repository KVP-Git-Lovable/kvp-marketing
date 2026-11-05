# AI Pitch Suggestions — Option 4 redesign

## Verified current implementation

- `PitchSuggestionsCard.tsx` displays four horizontal category tiles and expands the selected category into text pills. Reasons are currently available only as hover text; images and an overall collapse control are not rendered.
- Recommendations already carry exact product/variant IDs, quantities, units, reasons, and `starter`, `territory`, or `new_launch` tags.
- Generated database types expose `sku_image_url` on both `products` and `product_variants`. Order Entry's existing product loader fetches these fields and caches products and variants locally. The AI suggestion response does not provide images.

## Presentation changes

1. Replace large category tiles with compact selectable tabs: **Retailer Favourites**, **Beat Favourite**, **Top Seller**, and **Schemes & Offers**.
  - Initially show the tabs with all recommendation sections closed, as requested.
  - Selecting a category expands its recommendations directly below the tabs. Only one category can be open; selecting it again closes it.
  - Keep zero-count categories visible but disabled, and preserve all returned item counts.
2. Add a chevron control beside the heading and **Take Action** to collapse or expand the entire panel body.
  - Collapsing hides both the tabs and recommendations; the heading and Take Action remain visible.
  - Use a downward V when collapsed and an upward chevron when expanded, with accessible labels and expanded state.
3. Match the reference's restrained layout: subtle borders, compact spacing, category-colored icons and selected states, and a lightly tinted selected-category section.
  - Use semantic theme colors and existing design-system controls.
  - Show two product recommendations side by side where space allows, stacking on narrow screens. Keep category labels readable without overflow.
4. Each recommendation displays its unchanged exact name, suggested quantity and unit, available status label, and existing supporting reason as visible text.
  - Use the exact labels **Starter Picks**, **Territory Fallback**, and **New Launch** for their corresponding supplied tags only it meets the conditions.
  - New Launch appears only under Schemes & Offers, never Top Seller.
  - Do not invent demand labels, statistics, product sizes, or explanatory claims from the example image.
5. Provide an **Add** control for each item using the existing autofill mapping, retaining its exact product/variant identity, quantity, and unit. Preserve category-wide add functionality in the expanded section and the unchanged all-items Take Action behavior. once the product is added then show the button as added.

## Image-display handling

- Resolve actual `sku_image_url` values client-side for the recommended IDs only; do not change the recommendation endpoint.
- Match variant recommendations to their exact variant image, and base recommendations to their product image. Do not substitute another variant or a parent image for an image-less variant.
- Render successful images beside the product details with contained sizing, without cropping the pack.
- For missing, blank, invalid, failed, or unavailable images, render the same recommendation layout without an image element or reserved empty image box. Keep normal spacing and quantity/Add alignment.
- Image lookup or loading failures must not block recommendations or actions. Use local cached fields when available offline; otherwise show the text-only layout.
- Never construct image URLs from SKUs, display placeholders, or embed the reference screenshot.

## Technical scope

- Update `src/components/PitchSuggestionsCard.tsx` and narrowly scoped UI/image helpers and tests if needed.
- Resolve images from the existing local product/variant cache with a small batched, authenticated lookup of `id, sku_image_url` for recommended IDs when online; keep image data separate from recommendation data.
- Use the existing storage URL handling where needed and handle image load failures locally.
- No changes to backend recommendation logic, database schema, master-data sync, recommendation caching rules, or other Order Entry functionality.
- Product selection, variant selection, quantities, scheme eligibility, ranking, exclusions, duplicate prevention, and item counts remain unchanged.

## Validation after approval

- Verify tabs visible/products closed initially; opening, switching, and closing categories; overall collapse/re-expand; disabled empty categories; keyboard controls.
- Test real image fields where accessible, plus controlled UI cases covering valid product images, exact variant images, absent fields, broken URLs, and offline/unavailable lookups. Confirm no placeholders or broken-image icons remain.
- Check the three exact labels and ensure Top Seller never displays New Launch.
- Verify per-item Add, category Add, and Take Action send the unchanged IDs, variants, quantities, and units through the existing callback.
- Inspect desktop and narrow-screen layouts for overlap, clipping, excessive height, and image alignment; check light and dark themes and preview errors.
- If authenticated live data cannot be accessed, clearly distinguish controlled UI tests from a real-store end-to-end check.