import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./useOfflineSchemes", () => ({ useOfflineSchemes: vi.fn() }));
import { retailerSchemeEligible } from "./useEligibleOrderSchemes";
const scope = { retailerId: "r", beatId: "b", territoryId: "t", distributorId: "d", salespersonId: "u", hasOrderedBefore: false, rows: [{ scheme_id: "s", applicability_level: "salesperson", entity_id: "someone-else" }] };
describe("retailer eligibility", () => {
  it("never grants a salesperson offer intended for another salesperson", () => {
    expect(retailerSchemeEligible({ id: "s", name: "s", scheme_type: "percentage_discount", applicability_type: "targeted" }, scope)).toBe(false);
    expect(retailerSchemeEligible({ id: "s", name: "s", scheme_type: "percentage_discount", applicability_type: "targeted" }, { ...scope, salespersonId: "someone-else" })).toBe(true);
  });
  it("excludes first-order offers after previous orders", () => {
    expect(retailerSchemeEligible({ id: "s", name: "s", scheme_type: "first_order_discount", is_first_order_only: true }, { ...scope, hasOrderedBefore: true })).toBe(false);
  });
});