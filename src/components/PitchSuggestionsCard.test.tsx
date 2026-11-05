import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PitchSuggestionsCard } from "./PitchSuggestionsCard";
import { PitchProductImage } from "./PitchProductImage";

const { readCache } = vi.hoisted(() => ({ readCache: vi.fn() }));
vi.mock("@/utils/pitchSuggestionsCache", () => ({ readPitchCache: readCache, writePitchCache: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/usePitchProductImages", () => ({ usePitchProductImages: () => ({}), pitchImageKey: (item: { productId: string }) => item.productId }));
const { toggleSpy } = vi.hoisted(() => ({ toggleSpy: vi.fn() }));
const { schemeMapMock } = vi.hoisted(() => ({ schemeMapMock: { current: {} as Record<string, unknown[]> } }));
vi.mock("@/hooks/usePitchApplicableSchemes", () => ({ usePitchApplicableSchemes: () => schemeMapMock.current }));
vi.mock("@/hooks/usePitchFeedback", async () => {
  const React = await import("react");
  return { usePitchFeedback: () => { const [f, setF] = React.useState<Record<string, string>>({}); return { feedback: f, toggle: (i: { productId: string; variantId?: string | null }, t: string, r?: string) => { toggleSpy(i, t, r); setF(p => { const k = `${i.productId}:${i.variantId ?? "base"}`; const n = { ...p }; if (n[k] === t) delete n[k]; else n[k] = t; return n; }); } }; } };
});
const item = { productId: "parent", variantId: "exact-variant", name: "Exact pack 400G", qty: 3, unit: "Dozen", category: "retailer_favourite", reason: "Bought on three visits.", tag: "starter" };
beforeEach(() => readCache.mockReturnValue({ kind: "pitch", isNewBeat: true, categories: [
  { key: "retailer_favourite", items: [item] },
  { key: "beat_favourite", items: [{ ...item, productId: "beat", variantId: null, category: "beat_favourite", tag: "territory" }] },
  { key: "top_seller", items: [{ ...item, productId: "top", variantId: null, category: "top_seller", tag: "new_launch" }] },
  { key: "scheme", items: [{ ...item, productId: "launch", variantId: null, category: "scheme", tag: "new_launch" }] },
] }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("Option 4 pitch presentation", () => {
  it("starts closed, switches categories, and collapses the entire body", () => {
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />);
    expect(screen.queryByText(item.name)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ }));
    expect(screen.queryByText("Starter Picks")).toBeNull();
    expect(screen.queryByText("Store Type")).toBeNull();
    expect(screen.queryByRole("list", { name: "Insights" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Details for ${item.name}` }));
    expect(screen.getByText("Starter Picks")).toBeTruthy();
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /Beat Favourite/ }));
    expect(screen.queryByText("Recent Orders")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Collapse AI Suggestions" }));
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "Add All" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expand AI Suggestions" }));
    expect(screen.getByRole("group")).toBeTruthy();
  });
  it("toggles Add→Added→removed through both the Add button and the plus icon", () => {
    const onAutoFill = vi.fn();
    const onRemove = vi.fn();
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={onAutoFill} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(onAutoFill.mock.calls[0][0][0]).toMatchObject({ productId: "parent", variantId: "exact-variant", quantity: 3, unit: "Dozen", productName: item.name });
    const addedButton = screen.getByRole("button", { name: "Added" }) as HTMLButtonElement;
    expect(addedButton.disabled).toBe(false);
    fireEvent.click(addedButton);
    expect(onRemove).toHaveBeenCalledWith({ productId: "parent", variantId: "exact-variant" });
    expect(screen.getByRole("button", { name: /^Add$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Added" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(onAutoFill.mock.calls[1][0][0]).toMatchObject({ productId: "parent", variantId: "exact-variant" });
    expect(screen.getByRole("button", { name: "Added" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add All" }));
    expect(onAutoFill.mock.calls[2][0]).toHaveLength(3);
  });
  it("shows New Launch only in Schemes & Offers", () => {
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Top Seller/ }));
    expect(screen.queryByText("New Launch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Schemes & Offers/ }));
    expect(screen.queryByText("New Launch")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `Details for ${item.name}` }));
    expect(screen.getByText("New Launch")).toBeTruthy();
  });
  it("shows two-word labels and no Top Seller badge on Top Seller items", () => {
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Top Seller/ }));
    expect(screen.queryByText("High Demand")).toBeNull();
    expect(screen.getAllByText("Top Seller")).toHaveLength(1);
  });
  it("shows the New Beat indicator and not New Retailer for an existing store", () => {
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />);
    expect(screen.getByText("New Beat")).toBeTruthy();
    expect(screen.queryByText("New Retailer")).toBeNull();
  });
  it("synchronizes duplicate variants from the real order and deduplicates Take Action", () => {
    readCache.mockReturnValue({ kind: "pitch", categories: [{ key: "retailer_favourite", items: [item] }, { key: "top_seller", items: [{ ...item, category: "top_seller" }] }] });
    const onAutoFill = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(<PitchSuggestionsCard retailerId="store" onAutoFill={onAutoFill} onRemove={onRemove} orderedKeys={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Add All" }));
    expect(onAutoFill.mock.calls[0][0]).toHaveLength(1);
    rerender(<PitchSuggestionsCard retailerId="store" onAutoFill={onAutoFill} onRemove={onRemove} orderedKeys={["parent:exact-variant"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Top Seller/ }));
    fireEvent.click(screen.getByRole("button", { name: "Added" }));
    expect(onRemove).toHaveBeenCalledWith({ productId: "parent", variantId: "exact-variant" });
    fireEvent.click(screen.getByRole("button", { name: "Add All" }));
    expect(onAutoFill).toHaveBeenCalledTimes(1);
  });
  it("never bumps the recommended quantity to order entry, even when a scheme needs more", () => {
    const onAutoFill = vi.fn();
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={onAutoFill} orderedKeys={[]} schemeContext={{ items: [], schemes: [{ id: "s", name: "Offer", scheme_type: "percentage_discount", product_id: "parent", variant_id: "exact-variant", condition_quantity: 12, discount_percentage: 10 }], policies: { maxSchemesPerOrder: 1, allowSchemeStacking: false, sameTypeStacking: false, autoApplyBestScheme: true, priorityResolution: "highest_discount" }, resolveRate: () => 10 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(onAutoFill.mock.calls[0][0][0].quantity).toBe(3);
    expect(onAutoFill.mock.calls[0][0][0].schemeId).toBeUndefined();
  });
  it("shows the exact near-miss wording and auto-applies once the recommended quantity already qualifies", () => {
    const onAutoFill = vi.fn();
    const { rerender } = render(<PitchSuggestionsCard retailerId="store" onAutoFill={onAutoFill} orderedKeys={[]} schemeContext={{ items: [], schemes: [{ id: "s", name: "Offer", scheme_type: "percentage_discount", product_id: "parent", variant_id: "exact-variant", condition_quantity: 4, discount_percentage: 10 }], policies: { maxSchemesPerOrder: 1, allowSchemeStacking: false, sameTypeStacking: false, autoApplyBestScheme: true, priorityResolution: "highest_discount" }, resolveRate: () => 10 }} />);
    fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ }));
    fireEvent.click(screen.getByRole("button", { name: `Details for ${item.name}` }));
    expect(screen.getByText("Your usual quantity is 3 Dozen; add just 1 Dozen more to unlock this scheme!")).toBeTruthy();
  });
});
describe("optional pack image", () => {
  it("renders nothing for missing images", () => {
    const { container } = render(<PitchProductImage name="Pack" />);
    expect(container.innerHTML).toBe("");
  });
  it("displays only successfully loaded images and removes broken ones", () => {
    let loader: { onload: (() => void) | null; onerror: (() => void) | null; naturalWidth: number };
    vi.stubGlobal("Image", class {
      onload = null; onerror = null; naturalWidth = 50; src = "";
      constructor() { loader = this; }
    });
    const { rerender } = render(<PitchProductImage name="Pack" url="https://example.test/actual.jpg" />);
    expect(screen.queryByRole("img")).toBeNull();
    fireEvent(window, new Event("load"));
    // Flush the preloader's successful response through React's event wrapper.
    fireEvent.click(document.body);
    return import("@testing-library/react").then(({ act }) => {
      act(() => loader?.onload?.());
      expect(screen.getByRole("img").getAttribute("src")).toBe("https://example.test/actual.jpg");
      fireEvent.error(screen.getByRole("img"));
      expect(screen.queryByRole("img")).toBeNull();
      rerender(<PitchProductImage name="Pack" url="https://example.test/broken.jpg" />);
      act(() => loader?.onerror?.());
      expect(screen.queryByRole("img")).toBeNull();
    });
  });
  it("shows the scheme badge only on the item with an applicable scheme", () => {
    schemeMapMock.current = { "parent:exact-variant": [{ id: "s1", name: "Buy 10 get 1" }] };
    render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ }));
    expect(screen.getByText("Scheme Available")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Beat Favourite/ }));
    expect(screen.queryByText("Scheme Available")).toBeNull();
    schemeMapMock.current = {};
  });
});
describe("Dislike reason popup", () => {
  const open = () => { render(<PitchSuggestionsCard retailerId="store" onAutoFill={vi.fn()} />); fireEvent.click(screen.getByRole("button", { name: /Retailer Favourites/ })); fireEvent.click(screen.getByRole("button", { name: `Dislike ${item.name}` })); };
  beforeEach(() => toggleSpy.mockClear());
  it("Cancel closes without saving", () => {
    open(); fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(toggleSpy).not.toHaveBeenCalled();
  });
  it("Save records dislike with reason; tapping again clears with no popup", () => {
    open(); fireEvent.click(screen.getByRole("button", { name: "Price too high" })); fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(toggleSpy).toHaveBeenCalledWith(expect.objectContaining({ productId: "parent", variantId: "exact-variant" }), "dislike", "Price too high");
    fireEvent.click(screen.getByRole("button", { name: `Dislike ${item.name}` }));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(toggleSpy).toHaveBeenLastCalledWith(expect.anything(), "dislike", undefined);
  });
});
