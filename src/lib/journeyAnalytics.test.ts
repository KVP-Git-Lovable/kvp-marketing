import { describe, it, expect } from "vitest";
import { computeJourneyAnalytics, type AnalyticsInput } from "./journeyAnalytics";

const base: AnalyticsInput = {
  logs: [], events: [], enrollments: [], clicks: [], inbound: [], phones: new Map(), nodes: [],
  enrolledCount: 3, completedCount: 3,
};

describe("computeJourneyAnalytics", () => {
  it("counts marketing contacts (contact_id) through delivered, read and reply", () => {
    const r = computeJourneyAnalytics({
      ...base,
      logs: [
        { id: "l1", node_id: "n1", status: "read", created_at: "2026-11-01T10:00:00Z", contact_id: "c1", retailer_id: null, channel: "whatsapp" },
        { id: "l2", node_id: "n1", status: "delivered", created_at: "2026-11-01T10:00:00Z", contact_id: "c2", retailer_id: null, channel: "whatsapp" },
        { id: "l3", node_id: "n1", status: "failed", created_at: "2026-11-01T10:00:00Z", contact_id: "c3", retailer_id: null, channel: "whatsapp" },
      ],
      phones: new Map([["c1", "+91 98450 11111"]]),
      inbound: [{ from_number: "whatsapp:+919845011111", created_at: "2026-11-01T11:00:00Z" }],
      nodes: [{ id: "n1", type: "message", data: { template_name: "kvp_welcome_message" } }],
    });
    expect(r.funnel.map((f) => f.count)).toEqual([3, 2, 1, 0, 1]);
    expect(r.kpis.deliveryRate).toBeCloseTo(66.7, 1);
    expect(r.kpis.failed).toBe(1);
    expect(r.nodeRows[0]).toMatchObject({ label: "kvp_welcome_message", sent: 3, delivered: 2, read: 1, failed: 1 });
  });
  it("ignores replies that arrive before the first send", () => {
    const r = computeJourneyAnalytics({
      ...base,
      logs: [{ id: "l1", node_id: "n1", status: "sent", created_at: "2026-11-02T10:00:00Z", contact_id: "c1", retailer_id: null, channel: "whatsapp" }],
      phones: new Map([["c1", "9845011111"]]),
      inbound: [{ from_number: "9845011111", created_at: "2026-11-01T10:00:00Z" }],
    });
    expect(r.funnel[4].count).toBe(0);
  });
});
