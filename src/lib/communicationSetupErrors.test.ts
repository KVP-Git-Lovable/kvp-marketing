import { describe, expect, it } from "vitest";
import { canCreateMarketingListView, metaTermsUrl, readMetaFailure } from "./communicationSetupErrors";

describe("communication setup failures", () => {
  it("allows every marketing database, including Event, to be saved as a list view", () => {
    expect(canCreateMarketingListView("event")).toBe(true);
    expect(canCreateMarketingListView("institutional")).toBe(true);
    expect(canCreateMarketingListView("distributor")).toBe(true);
    expect(canCreateMarketingListView("")).toBe(false);
    expect(canCreateMarketingListView("unknown")).toBe(false);
  });
  it("preserves Meta's terms requirement from a non-success response", async () => {
    const url = "https://business.facebook.com/ads/manage/customaudiences/tos/?act=2135109103791264";
    const error = { message: "Edge function returned a non-2xx status code", context: new Response(JSON.stringify({ error: "Meta requires the Custom Audience Terms to be accepted for this ad account first.", tos_url: url }), { status: 400 }) };
    expect(await readMetaFailure(null, error)).toEqual({ message: "Meta requires the Custom Audience Terms to be accepted for this ad account first.", termsUrl: url });
    expect(error.context.bodyUsed).toBe(false);
  });
  it("does not allow untrusted terms links", () => {
    expect(metaTermsUrl("https://business.facebook.com.attacker.example/ads/manage/customaudiences/tos/")).toBeUndefined();
    expect(metaTermsUrl("javascript:alert(1)")).toBeUndefined();
  });
  it("does not turn success into a failure", async () => {
    expect(await readMetaFailure({ audience: { id: "audience" } }, null)).toBeUndefined();
  });
});