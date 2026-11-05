import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Building2, Network, Layers3, Store, Factory, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OwnerSelector } from "@/components/distributor/OwnerSelector";
import {
  useDistributorTypes,
  resolveTypeCode,
  type DistributorType,
} from "@/hooks/useDistributorTypes";

/**
 * The distributor form — ONE definition, used by both Add and Edit.
 *
 * They were previously two 600-line copies that had drifted: Edit still offered
 * the legacy four-tier list (Super Stockist / Distributor / Sub-Distributor /
 * Agent) while Add offered the three DMS types, Edit let any distributor be any
 * distributor's parent, and `drop_reason` existed only in Edit. Keeping the
 * markup here means the two screens cannot disagree again — they differ only in
 * what they do with the values on submit.
 */

/** An icon and a sentence per type. Presentation only — the hierarchy itself
 *  comes from `distributor_types`, which has no business carrying an icon. A
 *  type with no entry here still works, it just gets the generic treatment. */
export const TYPE_PRESENTATION: Record<string, { icon: typeof Store; description: string }> = {
  OEM: {
    icon: Factory,
    description: 'The company at the top of the network. Receives primary orders from the distributors below it.',
  },
  DD: {
    icon: Store,
    description: 'Places primary orders directly with the company. Supplies goods to retailers.',
  },
  SS: {
    icon: Layers3,
    description: 'Places primary orders with the company. Distributes to Under Super Stockists and retailers.',
  },
  USS: {
    icon: Network,
    description: 'Places primary orders via a Super Stockist parent. Supplies to retailers.',
  },
  AG: {
    icon: Briefcase,
    description: 'An agent in the network. Not a rung in the ordering hierarchy.',
  },
};

/** Whether a type of this kind has a parent to pick, straight from the table. */
export const typeTakesParent = (type?: DistributorType | null) => !!type?.parent_allowed;

/** Values retired from `distribution_level` that no type maps to. Shown as-is
 *  rather than blanked, so editing such a row does not quietly look unset. */
const LEGACY_LABELS: Record<string, string> = {
  distributor: 'Distributor',
  sub_distributor: 'Sub-Distributor',
  agent: 'Agent',
};

export interface DistributorFormValues {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_pincode: string;
  delivery_same_as_billing: boolean;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_pincode: string;
  delivery_contact_person: string;
  delivery_contact_phone: string;
  gst_number: string;
  established_year: string;
  distribution_experience_years: string;
  sales_team_size: string;
  assets_vans: string;
  assets_trucks: string;
  network_retailers_count: string;
  region_coverage: string;
  /** The chosen `distributor_types.id`. The source of truth for the type. */
  type_id: string;
  /** Mirrored from the type by a database trigger. Held here so the screens
   *  that still read it stay correct without a refetch, and so an untyped
   *  legacy row keeps the value it already has. */
  distribution_level: string;
  parent_id: string;
  distributor_status: string;
  partnership_status: string;
  onboarding_date: string;
  years_of_relationship: string;
  products_distributed: string;
  other_products: string;
  competition_products: string;
  strength: string;
  weakness: string;
  opportunities: string;
  threats: string;
  about_business: string;
  drop_reason: string;
  owner_id: string;
  owner_name: string;
}

export const EMPTY_DISTRIBUTOR_FORM: DistributorFormValues = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  billing_address: "",
  billing_city: "",
  billing_state: "",
  billing_pincode: "",
  delivery_same_as_billing: true,
  delivery_address: "",
  delivery_city: "",
  delivery_state: "",
  delivery_pincode: "",
  delivery_contact_person: "",
  delivery_contact_phone: "",
  gst_number: "",
  established_year: "",
  distribution_experience_years: "",
  sales_team_size: "",
  assets_vans: "",
  assets_trucks: "",
  network_retailers_count: "",
  region_coverage: "",
  // Left unset so the form can seed it from the types table once loaded,
  // rather than naming a type this file has no business knowing about.
  type_id: "",
  distribution_level: "",
  parent_id: "",
  distributor_status: "initial_connect",
  partnership_status: "registered",
  onboarding_date: "",
  years_of_relationship: "",
  products_distributed: "",
  other_products: "",
  competition_products: "",
  strength: "",
  weakness: "",
  opportunities: "",
  threats: "",
  about_business: "",
  drop_reason: "",
  owner_id: "",
  owner_name: "",
};

interface ParentOption {
  id: string;
  name: string;
  type_id: string | null;
  distribution_level: string | null;
}

export function DistributorForm({
  initialValues,
  excludeParentId,
  saving,
  submitLabel,
  onSubmit,
}: {
  initialValues: DistributorFormValues;
  /** The row being edited, so it cannot be offered as its own parent. */
  excludeParentId?: string;
  saving: boolean;
  submitLabel: string;
  onSubmit: (values: DistributorFormValues) => void;
}) {
  // Owned here and seeded once. Edit mounts this only after its row has
  // loaded, so there is no second set of values to reconcile with.
  const [formData, setFormData] = useState<DistributorFormValues>(initialValues);
  const { types, hierarchyTypes, byId, loading: typesLoading } = useDistributorTypes();
  const [candidates, setCandidates] = useState<ParentOption[]>([]);
  /** A parent the current level cannot have — older rows were allowed to pick
   *  any distributor. Named here so clearing it on save is never a surprise. */
  const [strandedParent, setStrandedParent] = useState<string | null>(null);

  // Every distributor, filtered to the right type below. The old query asked
  // the database for super stockists by `distribution_level`, which could not
  // find the OEM and would have missed the half of the rows whose level and
  // type disagree. Ten rows today, so the filtering is better done where the
  // legacy fallback can be applied.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('distributors')
        .select('id, name, type_id, distribution_level')
        .is('archived_at', null)
        .order('name');
      if (cancelled) return;
      if (error) {
        toast.error('Could not load the list of possible parents: ' + error.message);
        return;
      }
      setCandidates((data ?? []).filter((d) => d.id !== excludeParentId) as ParentOption[]);
    })();
    return () => { cancelled = true; };
  }, [excludeParentId]);

  const selectedType: DistributorType | null = formData.type_id ? byId[formData.type_id] ?? null : null;

  // Seed the type once the table is known: from the level already on the row if
  // there is one, otherwise the first rung below the root.
  useEffect(() => {
    if (formData.type_id || hierarchyTypes.length === 0) return;
    const fromLevel = resolveTypeCode({ distribution_level: formData.distribution_level }, types);
    const seed =
      hierarchyTypes.find((t) => t.code === fromLevel) ??
      hierarchyTypes.find((t) => t.parent_allowed) ??
      hierarchyTypes[0];
    if (seed) {
      setFormData((prev) => ({
        ...prev,
        type_id: seed.id,
        distribution_level: prev.distribution_level || seed.legacy_mapping || '',
      }));
    }
  }, [formData.type_id, formData.distribution_level, hierarchyTypes, types]);

  /** Only distributors of the type this type's parent must be. An untyped row
   *  is offered when its legacy level resolves to that type, which is how the
   *  older half of the data stays usable. */
  const parentOptions = selectedType?.parent_type_code
    ? candidates.filter((c) => resolveTypeCode(c, types) === selectedType.parent_type_code)
    : candidates;

  const strandedParentId =
    selectedType && !typeTakesParent(selectedType) && formData.parent_id ? formData.parent_id : null;

  useEffect(() => {
    if (!strandedParentId) { setStrandedParent(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('distributors')
        .select('name')
        .eq('id', strandedParentId)
        .maybeSingle();
      if (!cancelled) setStrandedParent(data?.name ?? "another distributor");
    })();
    return () => { cancelled = true; };
  }, [strandedParentId]);

  // delivery_same_as_billing is a boolean, every other field is a string.
  const handleChange = (field: keyof DistributorFormValues, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  /** Picking a type also sets the level mirrored from it, and drops a parent the
   *  new type may not have — otherwise switching type left a hidden parent that
   *  the database would then refuse. */
  const handleTypeChange = (typeId: string) => {
    const next = byId[typeId];
    setFormData((prev) => ({
      ...prev,
      type_id: typeId,
      distribution_level: next?.legacy_mapping || prev.distribution_level,
      parent_id: typeTakesParent(next) ? prev.parent_id : '',
    }));
  };

  const TypeIcon = (selectedType && TYPE_PRESENTATION[selectedType.code]?.icon) || Building2;
  const typeDescription = selectedType
    ? TYPE_PRESENTATION[selectedType.code]?.description ?? selectedType.description ?? ''
    : '';
  // A stored level that no type maps to — shown rather than silently rewritten.
  const legacyLevel =
    !selectedType && formData.distribution_level ? formData.distribution_level : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.contact_person.trim() || !formData.phone.trim()) {
      toast.error("Please fill in required fields");
      return;
    }

    if (!formData.type_id) {
      toast.error("Please choose a distributor type");
      return;
    }

    // Saving without it would be refused by the database anyway, once the
    // parent type is constrained; better to say so before the round trip.
    if (selectedType?.parent_type_code && !formData.parent_id) {
      const parentLabel = types.find((t) => t.code === selectedType.parent_type_code)?.name
        ?? selectedType.parent_type_code;
      toast.error(`A ${selectedType.name} must be linked to a ${parentLabel}`);
      return;
    }

    onSubmit({
      ...formData,
      // The parent only exists for a USS. Without this, picking a parent and
      // then switching the level away from USS saved a hidden parent the form
      // no longer shows.
      parent_id: typeTakesParent(selectedType) ? formData.parent_id : "",
      // Likewise a reason only belongs to a dropped distributor.
      drop_reason: formData.distributor_status === 'drop' ? formData.drop_reason : "",
    });
  };

  return (
    <>
      {/* DMS Type Card */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 mb-4 flex items-start gap-3">
        <TypeIcon className="h-6 w-6 mt-0.5 flex-shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-primary">
            {legacyLevel ? LEGACY_LABELS[legacyLevel] ?? legacyLevel : selectedType?.name ?? 'Distributor'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {legacyLevel
              ? 'Retired distribution level. Choose a current type to update it.'
              : typeDescription}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Business Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter business name"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="contact_person">Contact Person *</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person}
                  onChange={(e) => handleChange("contact_person", e.target.value)}
                  placeholder="Contact name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="Phone number"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Email address"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Full address"
                rows={2}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The general address. Billing and goods delivery are set below and fall back to this.
              </p>
            </div>

            {/* An invoice is raised to the registered address; a lorry goes to
                the godown. They are often different places, and one free-text
                address could not say so. */}
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Billing address — used on invoices
              </p>
              <Textarea
                id="billing_address"
                value={formData.billing_address}
                onChange={(e) => handleChange("billing_address", e.target.value)}
                placeholder="Leave blank to use the address above"
                rows={2}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input placeholder="City" value={formData.billing_city}
                  onChange={(e) => handleChange("billing_city", e.target.value)} />
                <Input placeholder="State" value={formData.billing_state}
                  onChange={(e) => handleChange("billing_state", e.target.value)} />
                <Input placeholder="Pincode" value={formData.billing_pincode}
                  onChange={(e) => handleChange("billing_pincode", e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Goods delivery address
                </p>
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={formData.delivery_same_as_billing}
                    onChange={(e) => handleChange("delivery_same_as_billing", e.target.checked)}
                  />
                  Same as billing
                </label>
              </div>
              {formData.delivery_same_as_billing ? (
                <p className="text-xs text-muted-foreground">
                  Goods go to the billing address.
                </p>
              ) : (
                <>
                  <Textarea
                    id="delivery_address"
                    value={formData.delivery_address}
                    onChange={(e) => handleChange("delivery_address", e.target.value)}
                    placeholder="Godown or warehouse address"
                    rows={2}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input placeholder="City" value={formData.delivery_city}
                      onChange={(e) => handleChange("delivery_city", e.target.value)} />
                    <Input placeholder="State" value={formData.delivery_state}
                      onChange={(e) => handleChange("delivery_state", e.target.value)} />
                    <Input placeholder="Pincode" value={formData.delivery_pincode}
                      onChange={(e) => handleChange("delivery_pincode", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Person at the godown" value={formData.delivery_contact_person}
                      onChange={(e) => handleChange("delivery_contact_person", e.target.value)} />
                    <Input placeholder="Their phone" value={formData.delivery_contact_phone}
                      onChange={(e) => handleChange("delivery_contact_phone", e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div>
              <Label htmlFor="gst_number">GST Number</Label>
              <Input
                id="gst_number"
                value={formData.gst_number}
                onChange={(e) => handleChange("gst_number", e.target.value)}
                placeholder="GST registration number"
              />
            </div>

            {/* Owner Selector */}
            <OwnerSelector
              value={formData.owner_id || null}
              valueName={formData.owner_name || null}
              onChange={(id, name) => {
                setFormData((prev) => ({
                  ...prev,
                  owner_id: id || "",
                  owner_name: name || "",
                }));
              }}
            />
          </CardContent>
        </Card>

        {/* About Business */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">About Business</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="about_business"
              value={formData.about_business}
              onChange={(e) => handleChange("about_business", e.target.value)}
              placeholder="Additional notes about the business"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Distribution Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribution Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Distributor Type *</Label>
                <Select value={formData.type_id} onValueChange={handleTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={typesLoading ? 'Loading types…' : 'Select a type'} />
                  </SelectTrigger>
                  <SelectContent>
                    {hierarchyTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {legacyLevel && (
                  <p className="text-xs text-warning mt-1">
                    Currently stored as the retired level{' '}
                    <strong>{LEGACY_LABELS[legacyLevel] ?? legacyLevel}</strong>. Choosing a type
                    above will replace it.
                  </p>
                )}
              </div>
              {typeTakesParent(selectedType) && (() => {
                const parentTypeName = selectedType?.parent_type_code
                  ? types.find((t) => t.code === selectedType.parent_type_code)?.name
                    ?? selectedType.parent_type_code
                  : 'Parent';
                return (
                  <div>
                    <Label>
                      Parent {parentTypeName}
                      {selectedType?.parent_type_code ? ' *' : ''}
                    </Label>
                    <Select
                      value={formData.parent_id || "none"}
                      onValueChange={(v) => handleChange("parent_id", v === "none" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${parentTypeName}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {parentOptions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parentOptions.length === 0 && !typesLoading && (
                      <p className="text-xs text-warning mt-1">
                        No {parentTypeName} on record yet. Add one first.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {strandedParent && (
              <p className="text-xs text-warning">
                This distributor is linked to <strong>{strandedParent}</strong> as a parent. A{" "}
                {selectedType?.name ?? "distributor of this type"} sits at the top of the network and
                cannot have one. Saving will clear that link.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Onboarding Status</Label>
                <Select
                  value={formData.distributor_status}
                  onValueChange={(v) => handleChange("distributor_status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial_connect">Initial Connect</SelectItem>
                    <SelectItem value="evaluation">Evaluation</SelectItem>
                    <SelectItem value="strong_candidate">Strong Candidate</SelectItem>
                    <SelectItem value="documentation">Documentation</SelectItem>
                    <SelectItem value="onboarded">Onboarded</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="drop">Dropped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Partnership Status</Label>
                <Select
                  value={formData.partnership_status}
                  onValueChange={(v) => handleChange("partnership_status", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="registered">Registered</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.distributor_status === 'drop' && (
              <div>
                <Label htmlFor="drop_reason">Reason for Drop</Label>
                <Textarea
                  id="drop_reason"
                  value={formData.drop_reason}
                  onChange={(e) => handleChange("drop_reason", e.target.value)}
                  placeholder="Why was this distributor dropped?"
                  rows={2}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="established_year">Established Year</Label>
                <Input
                  id="established_year"
                  type="number"
                  value={formData.established_year}
                  onChange={(e) => handleChange("established_year", e.target.value)}
                  placeholder="e.g., 2010"
                />
              </div>
              <div>
                <Label htmlFor="distribution_experience_years">Experience (Years)</Label>
                <Input
                  id="distribution_experience_years"
                  type="number"
                  value={formData.distribution_experience_years}
                  onChange={(e) => handleChange("distribution_experience_years", e.target.value)}
                  placeholder="Years of experience"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="onboarding_date">Onboarding Date</Label>
                <Input
                  id="onboarding_date"
                  type="date"
                  value={formData.onboarding_date}
                  onChange={(e) => handleChange("onboarding_date", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="years_of_relationship">Years of Relationship</Label>
                <Input
                  id="years_of_relationship"
                  type="number"
                  value={formData.years_of_relationship}
                  onChange={(e) => handleChange("years_of_relationship", e.target.value)}
                  placeholder="Years with us"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Network & Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Network &amp; Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="sales_team_size">Sales Team Size</Label>
                <Input
                  id="sales_team_size"
                  type="number"
                  value={formData.sales_team_size}
                  onChange={(e) => handleChange("sales_team_size", e.target.value)}
                  placeholder="Number of team members"
                />
              </div>
              <div>
                <Label htmlFor="network_retailers_count">Retailers Supported</Label>
                <Input
                  id="network_retailers_count"
                  type="number"
                  value={formData.network_retailers_count}
                  onChange={(e) => handleChange("network_retailers_count", e.target.value)}
                  placeholder="Number of retailers"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="assets_vans">Vans</Label>
                <Input
                  id="assets_vans"
                  type="number"
                  value={formData.assets_vans}
                  onChange={(e) => handleChange("assets_vans", e.target.value)}
                  placeholder="Number of vans"
                />
              </div>
              <div>
                <Label htmlFor="assets_trucks">Trucks</Label>
                <Input
                  id="assets_trucks"
                  type="number"
                  value={formData.assets_trucks}
                  onChange={(e) => handleChange("assets_trucks", e.target.value)}
                  placeholder="Number of trucks"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="region_coverage">Region Coverage</Label>
              <Input
                id="region_coverage"
                value={formData.region_coverage}
                onChange={(e) => handleChange("region_coverage", e.target.value)}
                placeholder="e.g., North Karnataka, 5 Districts"
              />
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Products &amp; Competition</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="products_distributed">Our Products Distributed</Label>
              <Input
                id="products_distributed"
                value={formData.products_distributed}
                onChange={(e) => handleChange("products_distributed", e.target.value)}
                placeholder="Comma separated list"
              />
            </div>
            <div>
              <Label htmlFor="other_products">Other Products Distributed</Label>
              <Input
                id="other_products"
                value={formData.other_products}
                onChange={(e) => handleChange("other_products", e.target.value)}
                placeholder="Comma separated list"
              />
            </div>
            <div>
              <Label htmlFor="competition_products">Competition Products</Label>
              <Input
                id="competition_products"
                value={formData.competition_products}
                onChange={(e) => handleChange("competition_products", e.target.value)}
                placeholder="Comma separated list"
              />
            </div>
          </CardContent>
        </Card>

        {/* SWOT Analysis */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">SWOT Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="strength">Strengths</Label>
              <Textarea
                id="strength"
                value={formData.strength}
                onChange={(e) => handleChange("strength", e.target.value)}
                placeholder="Key strengths of this distributor"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="weakness">Weaknesses</Label>
              <Textarea
                id="weakness"
                value={formData.weakness}
                onChange={(e) => handleChange("weakness", e.target.value)}
                placeholder="Areas of improvement"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="opportunities">Opportunities</Label>
              <Textarea
                id="opportunities"
                value={formData.opportunities}
                onChange={(e) => handleChange("opportunities", e.target.value)}
                placeholder="Growth opportunities"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="threats">Threats</Label>
              <Textarea
                id="threats"
                value={formData.threats}
                onChange={(e) => handleChange("threats", e.target.value)}
                placeholder="Potential threats or risks"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button type="submit" className="w-full gap-2" disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : submitLabel}
        </Button>
      </form>
    </>
  );
}

/** The shared shape the two screens write to `distributors`. Kept beside the
 *  form so a field added above cannot be forgotten on the way to the table. */
export const toDistributorRow = (v: DistributorFormValues) => ({
  name: v.name.trim(),
  contact_person: v.contact_person.trim(),
  phone: v.phone.trim(),
  email: v.email.trim() || null,
  address: v.address.trim() || null,
  billing_address: v.billing_address.trim() || null,
  billing_city: v.billing_city.trim() || null,
  billing_state: v.billing_state.trim() || null,
  billing_pincode: v.billing_pincode.trim() || null,
  delivery_same_as_billing: v.delivery_same_as_billing,
  // Goods-delivery fields are cleared when they mirror billing, so a later
  // change to the billing address cannot leave a stale godown behind.
  delivery_address: v.delivery_same_as_billing ? null : (v.delivery_address.trim() || null),
  delivery_city: v.delivery_same_as_billing ? null : (v.delivery_city.trim() || null),
  delivery_state: v.delivery_same_as_billing ? null : (v.delivery_state.trim() || null),
  delivery_pincode: v.delivery_same_as_billing ? null : (v.delivery_pincode.trim() || null),
  delivery_contact_person: v.delivery_same_as_billing ? null : (v.delivery_contact_person.trim() || null),
  delivery_contact_phone: v.delivery_same_as_billing ? null : (v.delivery_contact_phone.trim() || null),
  gst_number: v.gst_number.trim() || null,
  established_year: v.established_year ? parseInt(v.established_year) : null,
  distribution_experience_years: v.distribution_experience_years ? parseInt(v.distribution_experience_years) : null,
  sales_team_size: v.sales_team_size ? parseInt(v.sales_team_size) : null,
  assets_vans: v.assets_vans ? parseInt(v.assets_vans) : null,
  assets_trucks: v.assets_trucks ? parseInt(v.assets_trucks) : null,
  network_retailers_count: v.network_retailers_count ? parseInt(v.network_retailers_count) : null,
  region_coverage: v.region_coverage.trim() || null,
  type_id: v.type_id || null,
  // A trigger overwrites this from the type whenever type_id is set, so the
  // value sent here only matters for a row that has no type yet.
  distribution_level: v.distribution_level || null,
  parent_id: v.parent_id || null,
  distributor_status: v.distributor_status,
  partnership_status: v.partnership_status,
  onboarding_date: v.onboarding_date || null,
  years_of_relationship: v.years_of_relationship ? parseInt(v.years_of_relationship) : null,
  products_distributed: v.products_distributed ? v.products_distributed.split(',').map((s) => s.trim()) : null,
  other_products: v.other_products ? v.other_products.split(',').map((s) => s.trim()) : null,
  competition_products: v.competition_products ? v.competition_products.split(',').map((s) => s.trim()) : null,
  strength: v.strength.trim() || null,
  weakness: v.weakness.trim() || null,
  opportunities: v.opportunities.trim() || null,
  threats: v.threats.trim() || null,
  about_business: v.about_business.trim() || null,
  drop_reason: v.drop_reason.trim() || null,
  owner_id: v.owner_id || null,
  owner_name: v.owner_name || null,
});
