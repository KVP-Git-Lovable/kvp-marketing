import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { nextFeedback } from "./usePitchFeedback";
import { schemeAppliesToItem } from "./usePitchApplicableSchemes";

describe("pitch like/dislike", () => {
  it("tapping the same choice clears it", () => expect(nextFeedback("like", "like")).toBeNull());
  it("tapping the other choice switches", () => expect(nextFeedback("like", "dislike")).toBe("dislike"));
});

describe("scheme badge matches exact item", () => {
  it("variant scheme does not apply to another variant", () =>
    expect(schemeAppliesToItem({ product_id: "p", variant_id: "v1" }, { productId: "p", variantId: "v2" })).toBe(false));
  it("variant scheme applies to its own variant", () =>
    expect(schemeAppliesToItem({ product_id: "p", variant_id: "v1" }, { productId: "p", variantId: "v1" })).toBe(true));
  it("product scheme does not apply to a different product", () =>
    expect(schemeAppliesToItem({ product_id: "p" }, { productId: "q" })).toBe(false));
});
