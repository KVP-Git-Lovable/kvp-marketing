import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AdMediaPicker } from "@/components/communication/meta/AdMediaPicker";
import { type AdMedia, normalizeMedia } from "@/lib/adMedia";
import { Plus, MoreHorizontal, Play, Pause, Trash2, Megaphone, Pencil, X, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { LeadFormDialog } from "@/components/communication/meta/LeadFormDialog";
import { LEAD_ADS_TOS_URL, LEAD_CTA_OPTIONS, type LeadAdsReadiness, type LeadFormRow } from "@/lib/metaLeadForms";
import { isInstantFormGoal } from "../../../../supabase/functions/_shared/metaAdSetGoals";

interface Ad {
  id: string; name: string; status: string; meta_ad_id: string;
  primary_text: string | null; headline: string | null; description: string | null;
  call_to_action: string | null; destination_url: string | null;
  creative: { media_url?: string | null; media?: unknown; ai_media?: boolean; use_destination?: boolean; page_row_id?: string | null; instagram_actor_id?: string | null; lead_form_id?: string | null } | null;
  meta_ad_sets: { id: string; name: string };
}
interface AdSet { id: string; name: string; optimization_goal?: string | null; page_id?: string | null; meta_campaigns?: { id: string; name: string; ad_account_id?: string } }
interface Page { id: string; page_id: string; page_name: string | null }
interface InstagramAccount { id: string; username: string }

const PAGE_DEFAULT = "__page__";

const CTA_OPTIONS = [
  "LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "GET_OFFER", "BOOK_NOW", "GET_QUOTE", "SUBSCRIBE",
  "ORDER_NOW", "APPLY_NOW", "DOWNLOAD", "WATCH_MORE", "LISTEN_NOW", "GET_STARTED", "SEE_MORE", "REQUEST_TIME",
  "BUY_TICKETS", "GET_SHOWTIMES", "DONATE_NOW", "PLAY_GAME", "MESSAGE_PAGE", "WHATSAPP_MESSAGE", "CALL_NOW",
  "GET_DIRECTIONS", "NO_BUTTON",
];

const statusColors: Record<string, string> = {
  paused: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  deleted: "bg-destructive/10 text-destructive",
};

const initialForm = {
  ad_set_row_id: "", name: "", page_row_id: "", primary_text: "", headline: "",
  description: "", call_to_action: CTA_OPTIONS[0], destination_url: "", media_url: "",
  instagram_actor_id: PAGE_DEFAULT, use_destination: true, ai_media: false, lead_form_id: "",
};

export default function MetaAdsPanel({ adAccountRowId }: { adAccountRowId?: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [media, setMedia] = useState<AdMedia | null>(null);
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [adSetFilter, setAdSetFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

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

  const { data: adSets = [] } = useQuery({
    queryKey: ["meta-ad-sets-for-ads"],
    queryFn: () => invoke("ad_sets_list") as Promise<AdSet[]>,
  });

  const { data: status } = useQuery({
    queryKey: ["meta-connection-status"],
    queryFn: () => invoke("status") as Promise<{ connection_id: string | null }>,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["meta-pages-for-ads", status?.connection_id],
    enabled: !!status?.connection_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("meta_pages").select("id, page_id, page_name").eq("connection_id", status!.connection_id).order("page_name");
      if (error) throw error;
      return data as Page[];
    },
  });

  const { data: instagramAccounts = [] } = useQuery({
    queryKey: ["meta-ads-instagram-accounts"],
    queryFn: async () => (await invoke("list_ad_instagram_accounts")).accounts as InstagramAccount[],
  });

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["meta-ads-list"],
    queryFn: () => invoke("ads_list") as Promise<Ad[]>,
  });

  const adSetById = useMemo(() => new Map(adSets.map((a) => [a.id, a])), [adSets]);

  // Lead-form ad sets (Leads campaign, goal "Lead generation"): the ad carries an instant form.
  const selectedAdSet = form.ad_set_row_id ? adSetById.get(form.ad_set_row_id) : undefined;
  const isLeadAd = isInstantFormGoal(selectedAdSet?.optimization_goal);
  const leadPageId = selectedAdSet?.page_id || pages.find((p) => p.id === form.page_row_id)?.page_id || "";
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const { data: leadFormsData, isFetching: leadFormsLoading, refetch: refetchLeadForms } = useQuery({
    queryKey: ["meta-lead-forms", leadPageId],
    enabled: showCreate && isLeadAd && !!leadPageId,
    queryFn: async () => {
      try {
        return { forms: ((await invoke("list_lead_forms", { page_id: leadPageId })).forms || []) as LeadFormRow[], error: null as string | null };
      } catch (e) {
        return { forms: [] as LeadFormRow[], error: e instanceof Error ? e.message : "Could not load lead forms" };
      }
    },
  });
  const leadForms = leadFormsData?.forms || [];
  const { data: leadReadiness } = useQuery({
    queryKey: ["meta-lead-readiness", leadPageId],
    enabled: showCreate && isLeadAd && !!leadPageId,
    queryFn: () => invoke("lead_ads_readiness", { page_id: leadPageId }) as Promise<LeadAdsReadiness>,
  });
  const leadCtaValues = LEAD_CTA_OPTIONS.map(([v]) => v);
  const ctaOptions: Array<[string, string]> = isLeadAd
    ? LEAD_CTA_OPTIONS
    : CTA_OPTIONS.map((c) => [c, c.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")]);
  const adSetCampaignId = (adSetId: string | undefined) => (adSetId ? adSetById.get(adSetId)?.meta_campaigns?.id : undefined);

  const adSetsInAccount = useMemo(
    () => (adAccountRowId ? adSets.filter((a) => a.meta_campaigns?.ad_account_id === adAccountRowId) : adSets),
    [adSets, adAccountRowId]
  );

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();
    adSetsInAccount.forEach((a) => { if (a.meta_campaigns) map.set(a.meta_campaigns.id, a.meta_campaigns.name); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((x, y) => x.name.localeCompare(y.name));
  }, [adSetsInAccount]);

  const adSetOptions = useMemo(
    () => (campaignFilter === "all" ? adSetsInAccount : adSetsInAccount.filter((a) => a.meta_campaigns?.id === campaignFilter)),
    [adSetsInAccount, campaignFilter]
  );

  const applyCampaignFilter = (value: string) => {
    setCampaignFilter(value);
    if (value !== "all" && adSetFilter !== "all" && adSetCampaignId(adSetFilter) !== value) {
      setAdSetFilter("all");
    }
  };

  const clearFilters = () => { setCampaignFilter("all"); setAdSetFilter("all"); };

  const adSetIdsInAccount = useMemo(() => new Set(adSetsInAccount.map((a) => a.id)), [adSetsInAccount]);

  const visibleRows = useMemo(
    () => ads.filter((a) =>
      (!adAccountRowId || adSetIdsInAccount.has(a.meta_ad_sets?.id || "")) &&
      (campaignFilter === "all" || adSetCampaignId(a.meta_ad_sets?.id) === campaignFilter) &&
      (adSetFilter === "all" || a.meta_ad_sets?.id === adSetFilter)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ads, adSets, adAccountRowId, adSetIdsInAccount, campaignFilter, adSetFilter]
  );

  const createMutation = useMutation({
    mutationFn: () => invoke("ads_create", {
      ad_set_row_id: form.ad_set_row_id, name: form.name, page_row_id: form.page_row_id,
      primary_text: form.primary_text, headline: form.headline || undefined, description: form.description || undefined,
      call_to_action: form.call_to_action, destination_url: !isLeadAd && form.use_destination ? form.destination_url || undefined : undefined,
      media: media || undefined, media_url: media?.url || undefined, use_destination: form.use_destination, ai_media: form.ai_media,
      lead_form_id: isLeadAd ? form.lead_form_id || undefined : undefined,
      instagram_actor_id: form.instagram_actor_id !== PAGE_DEFAULT ? form.instagram_actor_id : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-list"] });
      setShowCreate(false); setForm(initialForm); setMedia(null);
      toast.success("Ad created (paused) — publish it when ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => invoke("ads_update", {
      ad_id: editId, name: form.name, page_row_id: form.page_row_id || undefined,
      primary_text: form.primary_text, headline: form.headline || undefined, description: form.description || undefined,
      call_to_action: form.call_to_action, destination_url: !isLeadAd && form.use_destination ? form.destination_url || undefined : undefined,
      media: media || undefined, media_url: media?.url || undefined, use_destination: form.use_destination, ai_media: form.ai_media,
      lead_form_id: isLeadAd ? form.lead_form_id || undefined : undefined,
      instagram_actor_id: form.instagram_actor_id !== PAGE_DEFAULT ? form.instagram_actor_id : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-list"] });
      setShowCreate(false); setEditId(null); setForm(initialForm); setMedia(null);
      toast.success("Ad updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (a: Ad) => {
    setEditId(a.id);
    setForm({
      ad_set_row_id: a.meta_ad_sets?.id || "", name: a.name, page_row_id: a.creative?.page_row_id || "",
      primary_text: a.primary_text || "", headline: a.headline || "", description: a.description || "",
      call_to_action: a.call_to_action || CTA_OPTIONS[0], destination_url: a.destination_url || "",
      media_url: a.creative?.media_url || "", instagram_actor_id: a.creative?.instagram_actor_id || PAGE_DEFAULT,
      use_destination: a.creative?.use_destination !== false && !!a.destination_url, ai_media: !!a.creative?.ai_media,
      lead_form_id: a.creative?.lead_form_id || "",
    });
    setMedia(normalizeMedia(a.creative?.media) || (a.creative?.media_url ? { kind: "image", url: a.creative.media_url } : null));
    setShowCreate(true);
  };

  const statusMutation = useMutation({
    mutationFn: (vars: { ad_id: string; action: string }) => invoke(vars.action, { ad_id: vars.ad_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-list"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ ad_id, force_local }: { ad_id: string; force_local?: boolean }) =>
      ({ ad_id, data: await invokeRaw("ads_delete", { ad_id, force_local }) }),
    onSuccess: ({ ad_id, data }) => {
      if (data?.meta_delete_failed) {
        if (confirm("Meta refused to delete this ad (it may have delivery history). Delete it locally only?")) {
          deleteMutation.mutate({ ad_id, force_local: true });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["meta-ads-list"] });
      toast.success(data.meta_deleted ? "Ad deleted" : "Ad removed locally");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Ads</h2>
          <p className="text-xs text-muted-foreground">Showing {visibleRows.length} of {ads.length}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={campaignFilter} onValueChange={applyCampaignFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All campaigns" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={adSetFilter} onValueChange={setAdSetFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="All ad sets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ad sets</SelectItem>
              {adSetOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(campaignFilter !== "all" || adSetFilter !== "all") && (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={clearFilters}><X className="h-4 w-4" /></Button>
          )}
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={adSetsInAccount.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Create Ad
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad</TableHead>
                <TableHead>Ad Set</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Meta ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No ads yet</TableCell></TableRow>
              ) : (
                visibleRows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-xs">{a.meta_ad_sets?.name}</TableCell>
                    <TableCell><Badge className={statusColors[a.status] || statusColors.paused}>{a.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.meta_ad_id}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          {a.status === "paused" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ ad_id: a.id, action: "ads_publish" })}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Publish / Resume
                            </DropdownMenuItem>
                          )}
                          {a.status === "active" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ ad_id: a.id, action: "ads_pause" })}>
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

      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) { setEditId(null); setForm(initialForm); setMedia(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-3"><DialogTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> {editId ? "Edit Ad" : "Create Ad"}</DialogTitle></DialogHeader>
          <div className="space-y-5 overflow-y-auto px-6 pb-4">
            <div className="space-y-1.5">
              <Label>Ad Set</Label>
              <Select value={form.ad_set_row_id} onValueChange={(v) => {
                const lead = isInstantFormGoal(adSetById.get(v)?.optimization_goal);
                setForm({ ...form, ad_set_row_id: v, lead_form_id: "", call_to_action: lead && !leadCtaValues.includes(form.call_to_action) ? "SIGN_UP" : form.call_to_action });
              }} disabled={!!editId}>
                <SelectTrigger><SelectValue placeholder="Select a published ad set" /></SelectTrigger>
                <SelectContent>{adSetsInAccount.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ad Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="space-y-2 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">Ad setup</h3>
                <p className="text-xs text-muted-foreground">Format · choose an ad creative layout</p>
              </div>
              <RadioGroup value="single" className="flex gap-6">
                <div className="flex items-center gap-2"><RadioGroupItem value="single" id="fmt-single" /><Label htmlFor="fmt-single" className="font-normal">Single image or video</Label></div>
                <div className="flex items-center gap-2 opacity-50"><RadioGroupItem value="carousel" id="fmt-carousel" disabled /><Label htmlFor="fmt-carousel" className="font-normal">Carousel <span className="text-xs">(coming soon)</span></Label></div>
              </RadioGroup>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">Ad creative</h3>
                <p className="text-xs text-muted-foreground">Select your ad media and text.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Media</Label>
                <AdMediaPicker value={media} onChange={setMedia} adSetId={form.ad_set_row_id} title={form.name || "Ad video"} />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="ai-media" checked={form.ai_media} onCheckedChange={(c) => setForm({ ...form, ai_media: c === true })} className="mt-0.5" />
                <div>
                  <Label htmlFor="ai-media" className="font-normal">Ad includes media created or edited with AI</Label>
                  <p className="text-xs text-muted-foreground">Recorded with this ad for your reference. Meta adds its "AI info" label through Ads Manager and its own detection; the Marketing API has no field for it.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Primary Text</Label>
                <Textarea rows={4} value={form.primary_text} onChange={(e) => setForm({ ...form, primary_text: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div>
                <h3 className="text-sm font-semibold">Identity</h3>
                <p className="text-xs text-muted-foreground">The profiles that will be used in your ad, as in Ads Manager.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Facebook Page</Label>
                  <Select value={form.page_row_id} onValueChange={(v) => setForm({ ...form, page_row_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select page" /></SelectTrigger>
                    <SelectContent>{pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.page_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Instagram profile</Label>
                  <Select value={form.instagram_actor_id} onValueChange={(v) => setForm({ ...form, instagram_actor_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PAGE_DEFAULT}>Page default (Page-backed Instagram)</SelectItem>
                      {instagramAccounts.map((ig) => <SelectItem key={ig.id} value={ig.id}>@{ig.username}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {instagramAccounts.length === 0 && (
                    <p className="text-xs text-muted-foreground">No Instagram profile is attached to this ad account on Meta. Add it under Business settings → Instagram profiles → Connect assets.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              {isLeadAd ? (
                <div className="space-y-2 rounded-md border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Lead form (instant form)</p>
                    <p className="text-xs text-muted-foreground">This ad set collects leads. People fill in the form on Facebook / Instagram instead of visiting a website; Meta sets the destination to the form.</p>
                  </div>
                  {!leadPageId && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">Choose a Facebook Page above to create or pick a lead form.</p>
                  )}
                  {leadReadiness?.tos_accepted === false && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      This Page hasn't accepted Meta's Lead Ads Terms. A Page admin must accept them at{" "}
                      <a href={LEAD_ADS_TOS_URL} target="_blank" rel="noreferrer" className="underline">facebook.com/ads/leadgen/tos</a>, then come back and refresh.
                    </p>
                  )}
                  {!!leadReadiness?.missing_permissions?.length && (
                    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      The Meta connection is missing: {leadReadiness.missing_permissions.join(", ")}. Reconnect Meta and grant these if creating forms fails.
                    </p>
                  )}
                  {leadFormsData?.error && <p className="text-xs text-destructive">{leadFormsData.error}</p>}
                  <Label className="text-xs">Lead form *</Label>
                  <div className="flex gap-2">
                    <Select value={form.lead_form_id} onValueChange={(v) => setForm({ ...form, lead_form_id: v })} disabled={!leadPageId || leadFormsLoading}>
                      <SelectTrigger className="h-9 flex-1"><SelectValue placeholder={leadFormsLoading ? "Loading forms…" : leadForms.length ? "Pick an instant form" : "No forms on this Page yet"} /></SelectTrigger>
                      <SelectContent>
                        {form.lead_form_id && !leadForms.some((f) => f.external_id === form.lead_form_id) && (
                          <SelectItem value={form.lead_form_id}>Form {form.lead_form_id}</SelectItem>
                        )}
                        {leadForms.map((f) => <SelectItem key={f.id} value={f.external_id || f.id}>{f.name}{f.leads_count ? ` · ${f.leads_count} leads` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setLeadFormOpen(true)} disabled={!leadPageId}>
                      <Plus className="h-4 w-4 mr-1" /> Create Lead form
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => refetchLeadForms()} disabled={!leadPageId || leadFormsLoading} title="Refresh forms from Meta">
                      {leadFormsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex items-start gap-2">
                <Checkbox id="use-destination" checked={form.use_destination} onCheckedChange={(c) => setForm({ ...form, use_destination: c === true })} className="mt-0.5" />
                <div>
                  <Label htmlFor="use-destination" className="font-normal">Add a destination</Label>
                  <p className="text-xs text-muted-foreground">Send people to a website after they tap the ad. Without a destination they are sent to your Facebook Page, and the ad runs as a plain photo or video post.</p>
                </div>
              </div>
              {form.use_destination && (
                <div className="space-y-1.5">
                  <Label>Destination URL <span className="text-destructive">*</span></Label>
                  <Input value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} placeholder="https://" />
                </div>
              )}
                </>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Headline</Label>
                  <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Call to Action</Label>
                  <Select value={form.call_to_action} onValueChange={(v) => setForm({ ...form, call_to_action: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ctaOptions.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            {editId ? (
              <Button onClick={() => updateMutation.mutate()} disabled={!form.name || !form.primary_text || (!isLeadAd && form.use_destination && !form.destination_url) || updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!form.ad_set_row_id || !form.page_row_id || !form.name || !form.primary_text || (!isLeadAd && form.use_destination && !form.destination_url) || (isLeadAd && !form.lead_form_id) || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Ad"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadFormDialog
        open={leadFormOpen}
        onOpenChange={setLeadFormOpen}
        pageId={leadPageId}
        onCreated={(created) => {
          queryClient.setQueryData(["meta-lead-forms", leadPageId], (cur: { forms: LeadFormRow[]; error: string | null } | undefined) => ({ forms: [created, ...(cur?.forms || []).filter((f) => f.id !== created.id)], error: null }));
          setForm((f) => ({ ...f, lead_form_id: created.external_id || created.id }));
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ ad_id: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title="Delete Ad"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This permanently removes it from Meta Ads Manager and cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
