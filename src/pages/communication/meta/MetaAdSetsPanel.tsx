import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Play, Pause, Trash2, Target, X, Pencil, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { LocationPicker } from "@/components/communication/meta/LocationPicker";
import { CustomerListAudienceDialog } from "@/components/communication/meta/CustomerListAudienceDialog";
import { emptyGeo, readGeo, type GeoSelection } from "@/lib/metaTargeting";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

interface CustomAudience { id: string; name: string; status: string; row_count: number }

interface AdSet {
  id: string; name: string; status: string; optimization_goal: string | null; billing_event: string | null;
  bid_strategy: string | null; bid_amount: number | null;
  daily_budget: number | null; budget_type: string | null; meta_ad_set_id: string;
  start_at: string | null; end_at: string | null;
  targeting: { geo_locations?: { countries?: string[] }; locations?: string[]; geo?: GeoSelection; age_min?: number; age_max?: number; genders?: number[] } | null;
  placements: { type: "automatic" | "manual"; selected?: string[] } | null;
  custom_audience_row_id: string | null;
  meta_campaigns: { id: string; name: string; ad_account_id: string };
}
interface Campaign { id: string; name: string; ad_account_id: string; budget_type: "daily" | "lifetime" | null; daily_budget: number | null }

const OPTIMIZATION_GOALS = [
  "REACH", "IMPRESSIONS", "LINK_CLICKS", "LANDING_PAGE_VIEWS", "CONVERSIONS", "LEAD_GENERATION",
  "OFFSITE_CONVERSIONS", "THRUPLAY", "VALUE", "POST_ENGAGEMENT", "VIDEO_VIEWS", "QUALITY_LEAD", "APP_INSTALLS",
];
const BILLING_EVENTS = ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY", "APP_INSTALLS", "PAGE_LIKES", "POST_ENGAGEMENT", "VIDEO_VIEWS", "PURCHASE"];
const AD_SET_BID_STRATEGIES = ["COST_CAP", "LOWEST_COST_WITH_BID_CAP"];
const PLACEMENT_OPTIONS = [
  { key: "FACEBOOK_FEED", label: "Facebook Feed" },
  { key: "INSTAGRAM_FEED", label: "Instagram Feed" },
  { key: "FACEBOOK_STORIES", label: "Facebook Stories" },
  { key: "INSTAGRAM_STORIES", label: "Instagram Stories" },
  { key: "REELS", label: "Reels (Facebook + Instagram)" },
  { key: "FACEBOOK_MARKETPLACE", label: "Facebook Marketplace" },
  { key: "FACEBOOK_VIDEO_FEEDS", label: "Facebook Video Feeds" },
  { key: "INSTAGRAM_EXPLORE", label: "Instagram Explore" },
];
const GENDER_OPTIONS: { label: string; value: number[] }[] = [
  { label: "All", value: [] }, { label: "Men", value: [1] }, { label: "Women", value: [2] },
];

const statusColors: Record<string, string> = {
  paused: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  deleted: "bg-destructive/10 text-destructive",
};

const initialForm = {
  campaign_row_id: "", name: "", optimization_goal: OPTIMIZATION_GOALS[0], billing_event: BILLING_EVENTS[0],
  bid_strategy: "", bid_amount: "", budget_type: "daily" as "daily" | "lifetime", budget_amount: "",
  start_at: "", end_at: "", age_min: "18", age_max: "65", genders: [] as number[],
  geo: emptyGeo(), geoFromLegacy: false, geoLegacyText: "",
  placementsType: "automatic" as "automatic" | "manual", placementsSelected: [] as string[],
  audienceType: "broad" as "broad" | "custom", custom_audience_row_id: "",
};

export default function MetaAdSetsPanel({ adAccountId, adAccountRowId }: { adAccountId: string; adAccountRowId?: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [form, setForm] = useState(initialForm);
  const [showAudienceUpload, setShowAudienceUpload] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: audiences = [], refetch: refetchAudiences, isFetching: refreshingAudiences } = useQuery({
    queryKey: ["meta-custom-audiences"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_custom_audiences").select("id, name, status, row_count").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CustomAudience[];
    },
  });

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const invokeRaw = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    return data;
  };

  const { data: campaigns = [] } = useQuery({
    queryKey: ["meta-campaigns-for-adsets"],
    queryFn: () => invoke("campaigns_list") as Promise<Campaign[]>,
  });

  const { data: adSets = [], isLoading } = useQuery({
    queryKey: ["meta-ad-sets-list"],
    queryFn: () => invoke("ad_sets_list") as Promise<AdSet[]>,
  });

  const campaignsInAccount = adAccountRowId ? campaigns.filter((c) => c.ad_account_id === adAccountRowId) : campaigns;
  const adSetsInAccount = adAccountRowId ? adSets.filter((a) => a.meta_campaigns?.ad_account_id === adAccountRowId) : adSets;
  const visibleRows = campaignFilter === "all" ? adSetsInAccount : adSetsInAccount.filter((a) => a.meta_campaigns?.id === campaignFilter);

  const selectedCampaign = campaignsInAccount.find((c) => c.id === form.campaign_row_id);
  const campaignHasBudget = !!selectedCampaign?.budget_type && selectedCampaign?.daily_budget != null;

  const createMutation = useMutation({
    mutationFn: () => invoke("ad_sets_create", {
      campaign_row_id: form.campaign_row_id, name: form.name,
      optimization_goal: form.optimization_goal, billing_event: form.billing_event,
      bid_strategy: form.bid_strategy || undefined, bid_amount: Number(form.bid_amount) || undefined,
      ...(campaignHasBudget ? {} : { budget_type: form.budget_type, budget_amount: Number(form.budget_amount) || undefined }),
      start_at: form.start_at || undefined, end_at: form.end_at || undefined,
      age_min: Number(form.age_min), age_max: Number(form.age_max),
      genders: form.genders.length ? form.genders : undefined,
      geo: form.geo,
      placements: { type: form.placementsType, selected: form.placementsType === "manual" ? form.placementsSelected : undefined },
      custom_audience_row_id: form.audienceType === "custom" ? form.custom_audience_row_id || undefined : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-sets-list"] });
      setShowCreate(false); setForm(initialForm);
      toast.success("Ad set created (paused) — publish it when ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => invoke("ad_sets_update", {
      ad_set_id: editId, name: form.name,
      bid_strategy: form.bid_strategy || undefined, bid_amount: Number(form.bid_amount) || undefined,
      ...(campaignHasBudget ? {} : { budget_type: form.budget_type, budget_amount: Number(form.budget_amount) || undefined }),
      start_at: form.start_at || undefined, end_at: form.end_at || undefined,
      age_min: Number(form.age_min), age_max: Number(form.age_max),
      genders: form.genders.length ? form.genders : undefined,
      geo: form.geo,
      placements: { type: form.placementsType, selected: form.placementsType === "manual" ? form.placementsSelected : undefined },
      custom_audience_row_id: form.audienceType === "custom" ? form.custom_audience_row_id || undefined : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-sets-list"] });
      setShowCreate(false); setEditId(null); setForm(initialForm);
      toast.success("Ad set updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (a: AdSet) => {
    setEditId(a.id);
    const { geo, fromLegacy } = readGeo(a.targeting || undefined);
    setForm({
      campaign_row_id: a.meta_campaigns?.id || "", name: a.name,
      optimization_goal: a.optimization_goal || OPTIMIZATION_GOALS[0], billing_event: a.billing_event || BILLING_EVENTS[0],
      bid_strategy: a.bid_strategy || "", bid_amount: a.bid_amount != null ? String(a.bid_amount) : "",
      budget_type: (a.budget_type as "daily" | "lifetime") || "daily", budget_amount: a.daily_budget != null ? String(a.daily_budget) : "",
      start_at: a.start_at ? a.start_at.slice(0, 16) : "", end_at: a.end_at ? a.end_at.slice(0, 16) : "",
      age_min: a.targeting?.age_min != null ? String(a.targeting.age_min) : "18",
      age_max: a.targeting?.age_max != null ? String(a.targeting.age_max) : "65",
      genders: a.targeting?.genders || [],
      geo, geoFromLegacy: fromLegacy, geoLegacyText: (a.targeting?.locations || []).join(", "),
      placementsType: a.placements?.type || "automatic", placementsSelected: a.placements?.selected || [],
      audienceType: a.custom_audience_row_id ? "custom" : "broad", custom_audience_row_id: a.custom_audience_row_id || "",
    });
    setShowCreate(true);
  };

  const statusMutation = useMutation({
    mutationFn: (vars: { ad_set_id: string; action: string }) => invoke(vars.action, { ad_set_id: vars.ad_set_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ad-sets-list"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ ad_set_id, force_local }: { ad_set_id: string; force_local?: boolean }) =>
      ({ ad_set_id, data: await invokeRaw("ad_sets_delete", { ad_set_id, force_local }) }),
    onSuccess: ({ ad_set_id, data }) => {
      if (data?.meta_delete_failed) {
        if (confirm("Meta refused to delete this ad set (it may have delivery history). Delete it locally only?")) {
          deleteMutation.mutate({ ad_set_id, force_local: true });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["meta-ad-sets-list"] });
      toast.success(data.meta_deleted ? "Ad set deleted" : "Ad set removed locally");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Ad Sets</h2>
          <p className="text-xs text-muted-foreground">Showing {visibleRows.length} of {adSets.length}</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All campaigns" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaignsInAccount.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {campaignFilter !== "all" && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCampaignFilter("all")}><X className="h-4 w-4" /></Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={campaignsInAccount.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Create Ad Set
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Set Name</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Optimization</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Meta ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No ad sets yet</TableCell></TableRow>
              ) : (
                visibleRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.targeting?.geo?.countries?.map((c) => c).join(", ") || a.targeting?.locations?.join(", ") || a.targeting?.geo_locations?.countries?.join(", ") || ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">{a.meta_campaigns?.name}</TableCell>
                    <TableCell className="text-xs">{a.optimization_goal}</TableCell>
                    <TableCell className="text-xs">{a.daily_budget ? `₹${a.daily_budget} / ${a.budget_type}` : "—"}</TableCell>
                    <TableCell><Badge className={statusColors[a.status] || statusColors.paused}>{a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.meta_ad_set_id}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          {a.status === "paused" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ ad_set_id: a.id, action: "ad_sets_publish" })}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Publish / Resume
                            </DropdownMenuItem>
                          )}
                          {a.status === "active" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ ad_set_id: a.id, action: "ad_sets_pause" })}>
                              <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ id: a.id, name: a.name })}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) { setEditId(null); setForm(initialForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> {editId ? "Edit Ad Set" : "Create Ad Set"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Campaign</Label>
              <Select value={form.campaign_row_id} onValueChange={(v) => setForm({ ...form, campaign_row_id: v })} disabled={!!editId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>{campaignsInAccount.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Optimization Goal{editId && " (locked after creation)"}</Label>
                <Select value={form.optimization_goal} onValueChange={(v) => setForm({ ...form, optimization_goal: v })} disabled={!!editId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{OPTIMIZATION_GOALS.map((g) => <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Billing Event{editId && " (locked after creation)"}</Label>
                <Select value={form.billing_event} onValueChange={(v) => setForm({ ...form, billing_event: v })} disabled={!!editId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{BILLING_EVENTS.map((g) => <SelectItem key={g} value={g}>{g.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Bid Strategy</Label>
              <Select value={form.bid_strategy} onValueChange={(v) => setForm({ ...form, bid_strategy: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>{AD_SET_BID_STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {campaignHasBudget ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Budget is set at the campaign level for this campaign — ₹{selectedCampaign?.daily_budget}/{selectedCampaign?.budget_type}.
                </div>
                <div>
                  <Label className="text-xs">Bid Amount</Label>
                  <Input type="number" value={form.bid_amount} onChange={(e) => setForm({ ...form, bid_amount: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Budget Type</Label>
                  <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v as "daily" | "lifetime" })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="lifetime">Lifetime</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Budget</Label>
                  <Input type="number" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Bid Amount</Label>
                  <Input type="number" value={form.bid_amount} onChange={(e) => setForm({ ...form, bid_amount: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <Label className="text-xs mb-1.5 block">Gender</Label>
              <div className="flex gap-4 text-xs">
                {GENDER_OPTIONS.map((g) => (
                  <label key={g.label} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={JSON.stringify(form.genders) === JSON.stringify(g.value)}
                      onChange={() => setForm({ ...form, genders: g.value })}
                    /> {g.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">End (optional)</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Age Min</Label>
                <Input type="number" value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Age Max</Label>
                <Input type="number" value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Locations</Label>
              <LocationPicker
                value={form.geo}
                onChange={(geo) => setForm((f) => ({ ...f, geo, geoFromLegacy: false }))}
                fromLegacy={form.geoFromLegacy}
                legacyText={form.geoLegacyText}
              />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Placements</Label>
              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.placementsType === "automatic"} onChange={() => setForm({ ...form, placementsType: "automatic" })} /> Automatic
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.placementsType === "manual"} onChange={() => setForm({ ...form, placementsType: "manual" })} /> Manual
                </label>
              </div>
              {form.placementsType === "manual" && (
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {PLACEMENT_OPTIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={form.placementsSelected.includes(p.key)}
                        onCheckedChange={() =>
                          setForm((f) => ({
                            ...f,
                            placementsSelected: f.placementsSelected.includes(p.key)
                              ? f.placementsSelected.filter((k) => k !== p.key)
                              : [...f.placementsSelected, p.key],
                          }))
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Audience</Label>
              <div className="flex gap-4 text-xs mb-2">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.audienceType === "broad"} onChange={() => setForm({ ...form, audienceType: "broad" })} /> Advantage+ audience (broad)
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={form.audienceType === "custom"} onChange={() => setForm({ ...form, audienceType: "custom" })} /> Custom audience
                </label>
              </div>
              {form.audienceType === "custom" && (
                <div className="flex gap-2 items-center">
                  <Select value={form.custom_audience_row_id} onValueChange={(v) => setForm({ ...form, custom_audience_row_id: v })}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Select a customer list" /></SelectTrigger>
                    <SelectContent>
                      {audiences.filter((a) => a.status === "ready").map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.row_count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => refetchAudiences()} disabled={refreshingAudiences}>
                    <RefreshCw className={`h-4 w-4 ${refreshingAudiences ? "animate-spin" : ""}`} />
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAudienceUpload(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload new list
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            {editId ? (
              <Button onClick={() => updateMutation.mutate()} disabled={!form.name || updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!form.campaign_row_id || !form.name || (!campaignHasBudget && !form.budget_amount) || !form.bid_amount || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Ad Set"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerListAudienceDialog
        open={showAudienceUpload}
        onOpenChange={setShowAudienceUpload}
        adAccountId={adAccountId}
        onCreated={(audience) => {
          refetchAudiences();
          setForm((f) => ({ ...f, custom_audience_row_id: audience.id }));
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ ad_set_id: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title="Delete Ad Set"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This permanently removes it from Meta Ads Manager and cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
