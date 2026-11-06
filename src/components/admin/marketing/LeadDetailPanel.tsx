import { useEffect, useRef, useState } from "react";
import { databaseToSegmentType } from "@/lib/marketingSegments";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Workflow, ArrowRightLeft, StickyNote, ListFilter, Upload, Check, ChevronDown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { DatabaseType } from "./MarketingListViewBuilder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onChanged?: () => void;
}

const STATUS_STEPS = [
  { value: "new", label: "New" },
  { value: "in_discussion", label: "In Discussion" },
  { value: "interested", label: "Interested" },
  { value: "converted", label: "Converted" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  new: "New", in_discussion: "In Discussion", interested: "Interested",
  not_interested: "Not Interested", wrong_data: "Wrong Data", converted: "Converted",
};

const CATEGORY_META: Record<DatabaseType, { label: string; className: string }> = {
  institutional: { label: "Institutional", className: "bg-indigo-100 text-indigo-700" },
  distributor: { label: "Distributor", className: "bg-teal-100 text-teal-700" },
  event: { label: "Event", className: "bg-amber-100 text-amber-700" },
};

const SOURCE_META: Record<string, { label: string; className: string }> = {
  direct: { label: "Direct", className: "bg-sky-100 text-sky-700" },
  external: { label: "External", className: "bg-violet-100 text-violet-700" },
  purchased: { label: "Purchased", className: "bg-pink-100 text-pink-700" },
};

const ACTIVITY_STYLE: Record<string, { icon: any; className: string }> = {
  status_change: { icon: ArrowRightLeft, className: "bg-sky-500" },
  note: { icon: StickyNote, className: "bg-amber-500" },
  list_view_added: { icon: ListFilter, className: "bg-accent-gold" },
  imported: { icon: Upload, className: "bg-slate-400" },
};

async function invokeEdge(fn: string, payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Request failed");
  return json;
}

export function LeadDetailPanel({ open, onOpenChange, contactId, onChanged }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const contactQuery = useQuery({
    queryKey: ["marketing-lead-detail", contactId],
    enabled: open && !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_contacts").select("*").eq("id", contactId).single();
      if (error) throw error;
      return data;
    },
  });

  const activityQuery = useQuery({
    queryKey: ["marketing-lead-activity", contactId],
    enabled: open && !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_leads_activity_log").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const contactDatabaseType = contactQuery.data?.database_type as DatabaseType | undefined;

  const listViewsQuery = useQuery({
    queryKey: ["marketing-list-views-for-lead", contactDatabaseType],
    enabled: open && !!contactDatabaseType,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_contact_list_views").select("id, name").eq("database_type", contactDatabaseType).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const membershipQuery = useQuery({
    queryKey: ["marketing-lead-list-view-membership", contactId, (listViewsQuery.data || []).map((lv: any) => lv.id).join(",")],
    enabled: open && !!contactId && (listViewsQuery.data || []).length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        (listViewsQuery.data || []).map(async (lv: any) => {
          const res = await invokeEdge("marketing-list-view-resolve", { list_view_id: lv.id, mode: "ids" });
          return (res.ids || []).includes(contactId) ? lv : null;
        })
      );
      return results.filter(Boolean) as { id: string; name: string }[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["marketing-lead-detail", contactId] });
    queryClient.invalidateQueries({ queryKey: ["marketing-lead-activity", contactId] });
    onChanged?.();
  };

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const oldStatus = contactQuery.data?.status;
      const { error } = await supabase.from("marketing_contacts").update({ status: newStatus }).eq("id", contactId);
      if (error) throw error;
      if (oldStatus && oldStatus !== newStatus) {
        await supabase.from("marketing_leads_activity_log").insert({
          contact_id: contactId, type: "status_change",
          body: `Status changed ${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[newStatus] || newStatus}`,
          meta: { from: oldStatus, to: newStatus },
        });
      }
    },
    onSuccess: invalidateAll,
    onError: (e: Error) => toast.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: async () => {
      if (!noteText.trim()) return;
      const { error } = await supabase.from("marketing_leads_activity_log").insert({
        contact_id: contactId, type: "note", body: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText("");
      invalidateAll();
      toast.success("Note added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contact = contactQuery.data;
  const isDisqualified = contact?.status === "not_interested" || contact?.status === "wrong_data";
  const currentStepIndex = contact ? STATUS_STEPS.findIndex((s) => s.value === contact.status) : -1;

  const convert = (listViewId: string) => {
    const segmentType = databaseToSegmentType(contactDatabaseType);
    navigate(`/communication?tab=journey-builder&new_segment_type=${segmentType}&new_list_view_id=${listViewId}`);
  };

  const initials = (contact?.name || "??").split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#F7F5F0] overflow-y-auto">
      {!contact ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="bg-gradient-hero px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" /> All Leads
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { noteInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); noteInputRef.current?.focus(); }}
                  className="bg-transparent border-white/40 text-white hover:bg-white/15 hover:text-white"
                >
                  Add Note
                </Button>
                {contactDatabaseType !== "event" && (membershipQuery.data || []).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-accent-gold hover:bg-accent-gold/90 text-accent-gold-foreground">
                        <Workflow className="h-3.5 w-3.5 mr-1.5" /> Convert → Send to Journey Builder <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(membershipQuery.data || []).map((lv) => (
                        <DropdownMenuItem key={lv.id} onClick={() => convert(lv.id)}>Send "{lv.name}" to Journey Builder</DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="max-w-5xl mx-auto flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-base font-bold text-white shrink-0">{initials}</div>
              <div>
                <div className="flex items-center gap-2 text-2xl font-bold text-white">
                  {contact.name}
                  <Badge variant="secondary" className="bg-white/15 text-white border-white/20 hover:bg-white/15">{CATEGORY_META[contact.database_type as DatabaseType].label}</Badge>
                </div>
                <p className="text-sm text-white/70 mt-0.5">
                  Added {new Date(contact.created_at).toLocaleDateString()} · Uploaded via {CATEGORY_META[contact.database_type as DatabaseType].label} Leads import
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            {/* Status path */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center">
                {STATUS_STEPS.map((step, idx) => {
                  const done = !isDisqualified && idx < currentStepIndex;
                  const current = !isDisqualified && idx === currentStepIndex;
                  return (
                    <div key={step.value} className="flex items-center flex-1 last:flex-none">
                      <button
                        type="button"
                        onClick={() => statusMutation.mutate(step.value)}
                        className="flex items-center gap-1.5 shrink-0"
                        disabled={statusMutation.isPending}
                      >
                        {done ? (
                          <div className="h-5 w-5 rounded-full bg-accent-gold flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-accent-gold-foreground" />
                          </div>
                        ) : current ? (
                          <div className="h-6 w-6 rounded-full border-2 border-accent-gold flex items-center justify-center shrink-0">
                            <div className="h-2.5 w-2.5 rounded-full bg-accent-gold" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                        )}
                        <span className={`text-xs ${current ? "font-bold" : done ? "font-medium" : "text-muted-foreground"}`}>{step.label}</span>
                        {current && <span className="text-[10px] text-muted-foreground">current stage</span>}
                      </button>
                      {idx < STATUS_STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${idx < currentStepIndex ? "bg-accent-gold" : "bg-border"}`} />}
                    </div>
                  );
                })}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="text-xs font-medium text-destructive ml-4 shrink-0">
                      {isDisqualified ? STATUS_LABELS[contact.status] : "Mark as disqualified"} <ChevronDown className="h-3 w-3 inline" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => statusMutation.mutate("not_interested")}>Not Interested</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => statusMutation.mutate("wrong_data")}>Wrong Data</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <p className="text-sm font-semibold">Lead Information</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-[11px] uppercase text-muted-foreground">Phone</p><p className="font-mono text-xs">{contact.phone || "—"}</p></div>
                    <div><p className="text-[11px] uppercase text-muted-foreground">Email</p><p className="text-xs">{contact.email || "—"}</p></div>
                    <div><p className="text-[11px] uppercase text-muted-foreground">Website</p><p className="text-xs">{contact.website || "—"}</p></div>
                    <div>
                      <p className="text-[11px] uppercase text-muted-foreground">Source</p>
                      <p className="text-xs">{contact.lead_source ? (SOURCE_META[contact.lead_source]?.label || contact.lead_source) : "—"}</p>
                    </div>
                    <div><p className="text-[11px] uppercase text-muted-foreground">State</p><p className="text-xs">{contact.state || "—"}</p></div>
                    <div><p className="text-[11px] uppercase text-muted-foreground">Country</p><p className="text-xs">{contact.country || "—"}</p></div>
                  </div>
                  <div><p className="text-[11px] uppercase text-muted-foreground">Address</p><p className="text-xs">{[contact.address, contact.city, contact.pincode].filter(Boolean).join(", ") || "—"}</p></div>
                  <div><p className="text-[11px] uppercase text-muted-foreground">Contact</p><p className="text-xs">{[contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—"}</p></div>
                  {contact.business_details && (
                    <div><p className="text-[11px] uppercase text-muted-foreground">Business Details</p><p className="text-xs leading-relaxed">{contact.business_details}</p></div>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-2">
                  <p className="text-sm font-semibold">List Views containing this lead</p>
                  {membershipQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Checking...</p>
                  ) : (membershipQuery.data || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Not in any List View yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(membershipQuery.data || []).map((lv) => (
                        <Badge key={lv.id} variant="outline" className="text-xs bg-accent-gold/15 text-accent-gold border-accent-gold/30">{lv.name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-3">
                <p className="text-sm font-semibold">Activity Timeline</p>
                <div className="flex gap-2">
                  <Textarea
                    ref={noteInputRef}
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>
                <Button size="sm" variant="outline" disabled={!noteText.trim() || noteMutation.isPending} onClick={() => noteMutation.mutate()}>
                  {noteMutation.isPending ? "Adding..." : "Add Note"}
                </Button>
                <div className="space-y-3 max-h-80 overflow-y-auto pt-1">
                  {activityQuery.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading...</p>
                  ) : (activityQuery.data || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No activity yet.</p>
                  ) : (
                    (activityQuery.data || []).map((entry: any) => {
                      const style = ACTIVITY_STYLE[entry.type] || { icon: StickyNote, className: "bg-muted-foreground" };
                      const Icon = style.icon;
                      return (
                        <div key={entry.id} className="flex gap-2.5">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${style.className}`}>
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-snug">{entry.body}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(entry.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
