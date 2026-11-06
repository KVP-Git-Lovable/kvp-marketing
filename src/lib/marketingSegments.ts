// The marketing databases a journey can target. Each maps a journey `segment_type`
// to the `database_type` of marketing_contacts / marketing_contact_list_views.

export const MARKETING_SEGMENTS = [
  { segment: "marketing_institutional", database: "institutional", label: "Institutional Marketing Database" },
  { segment: "marketing_distributor", database: "distributor", label: "Distributor Marketing Database" },
  { segment: "marketing_event", database: "event", label: "Event Marketing Database" },
] as const;

export type MarketingSegmentType = (typeof MARKETING_SEGMENTS)[number]["segment"];
export type MarketingDatabaseType = (typeof MARKETING_SEGMENTS)[number]["database"];

export const MARKETING_SEGMENT_TYPES: ReadonlySet<string> = new Set(MARKETING_SEGMENTS.map((s) => s.segment));

export const isMarketingSegment = (segmentType: string | null | undefined): boolean =>
  !!segmentType && MARKETING_SEGMENT_TYPES.has(segmentType);

/** journey segment_type -> contact/list-view database_type (defaults to distributor like before). */
export const segmentToDatabaseType = (segmentType: string): MarketingDatabaseType =>
  MARKETING_SEGMENTS.find((s) => s.segment === segmentType)?.database ?? "distributor";

/** list-view/contact database_type -> journey segment_type (defaults to distributor like before). */
export const databaseToSegmentType = (database: string | null | undefined): MarketingSegmentType =>
  MARKETING_SEGMENTS.find((s) => s.database === database)?.segment ?? "marketing_distributor";
