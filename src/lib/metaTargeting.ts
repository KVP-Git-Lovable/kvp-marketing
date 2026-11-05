export type GeoRegion = { key: string; name: string; country?: string };
export type GeoCity = { key: string; name: string; country?: string; region?: string; radius: number; distance_unit: "kilometer" | "mile" };
export type GeoSelection = { countries: string[]; regions: GeoRegion[]; cities: GeoCity[] };

export const emptyGeo = (): GeoSelection => ({ countries: [], regions: [], cities: [] });

export const geoIsEmpty = (geo: GeoSelection) => !geo.countries.length && !geo.regions.length && !geo.cities.length;

export const CITY_RADIUS_OPTIONS = [5, 10, 15, 25, 40, 50, 80];

export const COUNTRY_OPTIONS = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NZ", name: "New Zealand" },
  { code: "ZA", name: "South Africa" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "QA", name: "Qatar" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "NP", name: "Nepal" },
  { code: "LK", name: "Sri Lanka" },
  { code: "BD", name: "Bangladesh" },
];

export function countryName(code: string): string {
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.name || code;
}

export function describeGeo(geo: GeoSelection): string {
  const parts = [
    ...geo.countries.map(countryName),
    ...geo.regions.map((r) => r.name),
    ...geo.cities.map((c) => `${c.name} (+${c.radius}km)`),
  ];
  return parts.join(", ");
}

/** Reads a stored ad set `targeting` jsonb value back into a GeoSelection, falling back to a legacy country-code array. */
export function readGeo(targeting: { geo?: GeoSelection; locations?: string[] } | null | undefined): { geo: GeoSelection; fromLegacy: boolean } {
  if (targeting?.geo && (targeting.geo.countries?.length || targeting.geo.regions?.length || targeting.geo.cities?.length)) {
    return { geo: targeting.geo, fromLegacy: false };
  }
  const countries = (targeting?.locations || []).filter((c) => /^[A-Z]{2}$/i.test(c)).map((c) => c.toUpperCase());
  return { geo: { countries, regions: [], cities: [] }, fromLegacy: countries.length > 0 };
}
