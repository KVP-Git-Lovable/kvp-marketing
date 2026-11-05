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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Download, MoreHorizontal, Play, Pause, Archive, Trash2, Pencil, Rocket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

interface Campaign {
  id: string; name: string; objective: string | null; buying_type: string | null;
  budget_type: string | null; daily_budget: number | null; status: string;
  start_date: string | null; end_date: string | null; meta_campaign_id: string;
  ad_account_id: string;
}

const OBJECTIVES = ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_SALES", "OUTCOME_APP_PROMOTION"];
const SPECIAL_CATEGORIES = ["HOUSING", "EMPLOYMENT", "CREDIT", "ISSUES_ELECTIONS_POLITICS", "ONLINE_GAMBLING_AND_GAMING", "FINANCIAL_PRODUCTS_SERVICES"];

const statusColors: Record<string, string> = {
  paused: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  archived: "bg-slate-200 text-slate-700",
  deleted: "bg-destructive/10 text-destructive",
};

const initialForm = {
  name: "", objective: OBJECTIVES[0], buying_type: "AUCTION",
  budget_type: "daily" as "daily" | "lifetime", budget_amount: "",
  bid_strategy: "", spend_cap: "", special_ad_categories: [] as string[],
  start_date: "", end_date: "",
};

export default function MetaCampaignsPanel({ adAccountRowId }: { adAccountRowId: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Delete needs to inspect a refused-but-not-an-error response (meta_delete_failed)
  // before deciding whether to prompt the user, so it can't use the throwing `invoke`.
  const invokeRaw = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("meta-api", { body: { action, ...extra } });
    if (error) throw error;
    return data;
  };

  const { data: allCampaigns = [], isLoading } = useQuery({
    queryKey: ["meta-campaigns-list"],
    queryFn: () => invoke("campaigns_list") as Promise<Campaign[]>,
  });
  const campaigns = adAccountRowId ? allCampaigns.filter((c) => c.ad_account_id === adAccountRowId) : allCampaigns;

  const importMutation = useMutation({
    mutationFn: () => invoke("campaigns_import"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns-list"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ad-sets-list"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-list"] });
      toast.success(`Imported/synced ${data.campaigns ?? data.synced} campaign(s), ${data.ad_sets ?? 0} ad set(s), ${data.ads ?? 0} ad(s) from Meta`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: () => invoke("campaigns_create", {
      ad_account_row_id: adAccountRowId, name: form.name, objective: form.objective,
      buying_type: form.buying_type, budget_type: form.budget_type, budget_amount: Number(form.budget_amount) || undefined,
      bid_strategy: form.bid_strategy || undefined, spend_cap: Number(form.spend_cap) || undefined,
      special_ad_categories: form.special_ad_categories, start_date: form.start_date || undefined, end_date: form.end_date || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns-list"] });
      setShowCreate(false); setForm(initialForm);
      toast.success("Campaign created (paused) — publish it when ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => invoke("campaigns_update", {
      campaign_id: editId, name: form.name,
      budget_amount: Number(form.budget_amount) || undefined,
      bid_strategy: form.bid_strategy || undefined, spend_cap: Number(form.spend_cap) || undefined,
      start_date: form.start_date || undefined, end_date: form.end_date || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns-list"] });
      setShowCreate(false); setEditId(null); setForm(initialForm);
      toast.success("Campaign updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: Campaign) => {
    setEditId(c.id);
    setForm({
      name: c.name, objective: c.objective || OBJECTIVES[0], buying_type: c.buying_type || "AUCTION",
      budget_type: (c.budget_type as "daily" | "lifetime") || "daily", budget_amount: c.daily_budget != null ? String(c.daily_budget) : "",
      bid_strategy: "", spend_cap: "", special_ad_categories: [],
      start_date: c.start_date ? c.start_date.slice(0, 16) : "", end_date: c.end_date ? c.end_date.slice(0, 16) : "",
    });
    setShowCreate(true);
  };

  const statusMutation = useMutation({
    mutationFn: (vars: { campaign_id: string; action: string }) => invoke(vars.action, { campaign_id: vars.campaign_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns-list"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ campaign_id, force_local }: { campaign_id: string; force_local?: boolean }) =>
      ({ campaign_id, data: await invokeRaw("campaigns_delete", { campaign_id, force_local }) }),
    onSuccess: ({ campaign_id, data }) => {
      if (data?.meta_delete_failed) {
        if (confirm("Meta refused to delete this campaign (it may have delivery history). Delete it locally only?")) {
          deleteMutation.mutate({ campaign_id, force_local: true });
        }
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["meta-campaigns-list"] });
      toast.success(data.meta_deleted ? "Campaign deleted" : "Campaign removed locally");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleCategory = (cat: string) =>
    setForm((f) => ({
      ...f,
      special_ad_categories: f.special_ad_categories.includes(cat)
        ? f.special_ad_categories.filter((c) => c !== cat)
        : [...f.special_ad_categories, cat],
    }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="text-xs text-muted-foreground">Showing {campaigns.length} of {allCampaigns.length} campaign(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => importMutation.mutate()} disabled={importMutation.isPending}>
            <Download className={`h-4 w-4 mr-2 ${importMutation.isPending ? "animate-spin" : ""}`} /> Import from Meta
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={!adAccountRowId}>
            <Plus className="h-4 w-4 mr-2" /> Create Campaign
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Objective</TableHead>
                <TableHead>Buying Type</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Meta ID</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns yet</TableCell></TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs">{c.objective}</TableCell>
                    <TableCell className="text-xs">{c.buying_type}</TableCell>
                    <TableCell className="text-xs">{c.daily_budget ? `₹${c.daily_budget} / ${c.budget_type}` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.start_date ? format(new Date(c.start_date), "MMM d") : "—"}
                      {c.end_date ? ` – ${format(new Date(c.end_date), "MMM d")}` : ""}
                    </TableCell>
                    <TableCell><Badge className={statusColors[c.status] || statusColors.paused}>{c.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.meta_campaign_id}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          {c.status === "paused" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ campaign_id: c.id, action: "campaigns_publish" })}>
                              <Play className="h-3.5 w-3.5 mr-2" /> Publish / Resume
                            </DropdownMenuItem>
                          )}
                          {c.status === "active" && (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ campaign_id: c.id, action: "campaigns_pause" })}>
                              <Pause className="h-3.5 w-3.5 mr-2" /> Pause
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => statusMutation.mutate({ campaign_id: c.id, action: "campaigns_archive" })}>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                          >
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Rocket className="h-4 w-4" /> {editId ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Diwali Offers 2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Objective{editId && " (locked after creation)"}</Label>
                <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })} disabled={!!editId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{OBJECTIVES.map((o) => <SelectItem key={o} value={o}>{o.replace("OUTCOME_", "")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Buying Type{editId && " (locked after creation)"}</Label>
                <Select value={form.buying_type} onValueChange={(v) => setForm({ ...form, buying_type: v })} disabled={!!editId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="AUCTION">Auction</SelectItem><SelectItem value="RESERVED">Reserved</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Budget Type</Label>
                <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v as "daily" | "lifetime" })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="lifetime">Lifetime</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Budget Amount</Label>
                <Input type="number" value={form.budget_amount} onChange={(e) => setForm({ ...form, budget_amount: e.target.value })} placeholder="500" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Bid Strategy (optional)</Label>
                <Select value={form.bid_strategy} onValueChange={(v) => setForm({ ...form, bid_strategy: v })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest cost</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid cap</SelectItem>
                    <SelectItem value="COST_CAP">Cost cap</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_MIN_ROAS">Minimum ROAS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Spend Cap (optional)</Label>
                <Input type="number" value={form.spend_cap} onChange={(e) => setForm({ ...form, spend_cap: e.target.value })} placeholder="5000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start</Label>
                <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">End (optional)</Label>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Special Ad Categories{editId && " (locked after creation)"}</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {SPECIAL_CATEGORIES.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-xs">
                    <Checkbox checked={form.special_ad_categories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} disabled={!!editId} />
                    {cat.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            {editId ? (
              <Button onClick={() => updateMutation.mutate()} disabled={!form.name || updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || !form.budget_amount || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate({ campaign_id: deleteTarget.id });
          setDeleteTarget(null);
        }}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This permanently removes it from Meta Ads Manager and cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
