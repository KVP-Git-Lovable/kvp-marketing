import { useEffect } from "react";
import { isMarketingSegment } from "@/lib/marketingSegments";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, X } from "lucide-react";
import { effectiveResponseTarget, isTemplateStep, templateLabel } from "@/lib/journeyResponseTargets";
import type { LiveCounts } from "@/hooks/useMessageResponseLiveCounts";
import { AD_SCHEDULE_MODES, adScheduleModeOf, resolveAdSchedule } from "@/lib/metaAdSchedule";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/journeyCampaign";
import { format } from "date-fns";

interface WhatsAppTemplate {
  id: string;
  name: string;
  body?: string;
}

interface MetaAdSetOption {
  id: string;
  name: string;
  campaign_name?: string;
  custom_audience_name?: string;
  custom_audience_row_count?: number;
  start_at?: string | null;
  end_at?: string | null;
}

export interface MetaAdLinkInfo {
  applied_at?: string | null;
  applied_start_at?: string | null;
  applied_end_at?: string | null;
  last_error?: string | null;
  paused_by_journey?: boolean;
}

interface Props {
  node: Node;
  templates: WhatsAppTemplate[];
  adSets: MetaAdSetOption[];
  metaAdLinkedNodeIds?: Set<string>;
  /** Window of the journey this node belongs to (used by "Follow journey dates"). */
  journeyWindow?: { start_date?: string | null; end_date?: string | null };
  metaAdLinks?: Record<string, MetaAdLinkInfo>;
  /** Ad set row id -> names of OTHER journeys that already use it. */
  adSetSharing?: Record<string, string[]>;
  onApplyMetaSchedule?: (nodeId: string) => void;
  applyingMetaSchedule?: boolean;
  nodes: Node[];
  edges: Edge[];
  liveCounts?: Record<string, LiveCounts>;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CONDITIONS: { value: string; label: string }[] = [
  { value: "delivered", label: "Delivered" },
  { value: "not_delivered", label: "Not Delivered" },
  { value: "read", label: "Read" },
  { value: "not_read", label: "Not Read" },
  { value: "replied", label: "Replied" },
  { value: "not_replied", label: "Not Replied" },
  { value: "failed", label: "Failed" },
  { value: "undelivered", label: "Undelivered" },
];

const WAIT_PRESETS: { label: string; value: number; unit: "minutes" | "hours" }[] = [
  { label: "Immediately", value: 0, unit: "hours" },
  { label: "30 min", value: 30, unit: "minutes" },
  { label: "1 hr", value: 1, unit: "hours" },
  { label: "6 hr", value: 6, unit: "hours" },
  { label: "24 hr", value: 24, unit: "hours" },
];

export function NodePropertyPanel({ node, templates, adSets, metaAdLinkedNodeIds, journeyWindow, metaAdLinks, adSetSharing, onApplyMetaSchedule, applyingMetaSchedule, nodes, edges, liveCounts, onChange, onDelete, onClose }: Props) {
  const data = (node.data || {}) as Record<string, unknown>;
  const canDelete = node.type !== "entry" && node.type !== "exit";
  const selectedTemplate = templates.find((t) => t.id === (data.template_id as string));

  // Auto-link: if this response node has no (or a now-dangling) saved
  // target, silently back in the nearest upstream Message node so the
  // canvas data matches what the panel displays even before the user
  // touches the dropdown.
  useEffect(() => {
    if (node.type !== "message_response") return;
    const saved = data.target_node_id as string | undefined;
    if (saved && nodes.some((n) => n.id === saved)) return;
    const eff = effectiveResponseTarget({ id: node.id, type: node.type, data }, nodes, edges);
    if (!eff) return;
    onChange(node.id, { ...data, target_node_id: eff.target.id, target_node_label: templateLabel(eff.target) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, data.target_node_id, nodes.length, edges.length]);

  return (
    <div className="w-72 shrink-0 border-l bg-card p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold capitalize">Edit {node.type === "message_response" ? "Message Response" : node.type}</p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {node.type === "entry" && (
          isMarketingSegment(data.segment_type as string | undefined) ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Target Audience — Retailer View</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-1">
                <p className="font-medium">{(data.list_view_name as string) || "List View"}</p>
                <p className="text-muted-foreground">
                  {typeof data.audience_count === "number" ? `${data.audience_count.toLocaleString()} contacts` : "Loading count..."}
                </p>
              </div>
              {typeof data.onPreviewAudience === "function" && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => (data.onPreviewAudience as () => void)()}>
                  Preview Audience
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">Change the audience from Edit Journey.</p>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Retailer Category</Label>
              <Select value={(data.category as string) || "any"} onValueChange={(v) => onChange(node.id, { ...data, category: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">All retailers</SelectItem>
                  <SelectItem value="A">Category A</SelectItem>
                  <SelectItem value="B">Category B</SelectItem>
                  <SelectItem value="C">Category C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )
        )}

        {node.type === "message" && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Message Type</Label>
              <div className="h-9 flex items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                Template
              </div>
            </div>
            <div>
              <Label className="text-xs">WhatsApp Template</Label>
              <Select
                value={(data.template_id as string) || ""}
                onValueChange={(v) => onChange(node.id, { ...data, template_id: v, template_name: templates.find((t) => t.id === v)?.name })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {templates.length === 0 && <p className="text-[11px] text-destructive mt-1">No approved templates yet.</p>}
            </div>
            <div>
              <Label className="text-xs">Message Body</Label>
              <Textarea readOnly rows={4} value={selectedTemplate?.body || ""} placeholder="Select an approved WhatsApp template" className="resize-none text-xs" />
            </div>
            <div>
              <Label className="text-xs">Link to track (optional)</Label>
              <Input
                type="url" className="h-9" placeholder="https://..."
                value={(data.cta_url as string) || ""}
                onChange={(e) => onChange(node.id, { ...data, cta_url: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Only used if the template has exactly one variable — a trackable short link replaces it so clicks count toward engagement.
              </p>
            </div>
          </div>
        )}

        {node.type === "meta_ad" && (() => {
          const selectedAdSet = adSets.find((a) => a.id === (data.ad_set_row_id as string));
          const isLinked = !!metaAdLinkedNodeIds?.has(node.id);
          return (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Ad Set</Label>
                <Select
                  value={(data.ad_set_row_id as string) || ""}
                  onValueChange={(v) => {
                    const adSet = adSets.find((a) => a.id === v);
                    onChange(node.id, { ...data, ad_set_row_id: v, ad_set_name: adSet?.name, campaign_name: adSet?.campaign_name, audience_replace_confirmed: false });
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select a synced ad set" /></SelectTrigger>
                  <SelectContent>
                    {adSets.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}{a.campaign_name ? ` — ${a.campaign_name}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {adSets.length === 0 && (
                  <p className="text-[11px] text-destructive mt-1">
                    No ad sets have a Custom Audience attached yet — attach one from Meta → Advertisements → Ad Sets first.
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Each contact reaching this step is pushed into a Meta Custom Audience linked to this ad set, hashed and uploaded automatically — the audience grows live as the journey runs.
              </p>
              {selectedAdSet && (() => {
                const mode = adScheduleModeOf(data);
                const plan = resolveAdSchedule(data, journeyWindow || {});
                const link = metaAdLinks?.[node.id];
                const others = adSetSharing?.[selectedAdSet.id] || [];
                const fmt = (iso?: string | null) => (iso ? format(new Date(iso), "dd MMM yyyy, p") : "—");
                return (
                  <div className="space-y-2 rounded-md border p-2.5">
                    <Label className="text-xs font-medium">Ad schedule</Label>
                    <Select value={mode} onValueChange={(v) => onChange(node.id, { ...data, schedule_mode: v })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AD_SCHEDULE_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">{AD_SCHEDULE_MODES.find((m) => m.value === mode)?.hint}</p>
                    {mode === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Start</Label>
                          <Input type="datetime-local" className="h-9" value={toDateTimeLocal(data.ad_start_at as string | undefined)}
                            onChange={(e) => onChange(node.id, { ...data, ad_start_at: fromDateTimeLocal(e.target.value) })} />
                        </div>
                        <div>
                          <Label className="text-[11px] text-muted-foreground">End</Label>
                          <Input type="datetime-local" className="h-9" value={toDateTimeLocal(data.ad_end_at as string | undefined)}
                            onChange={(e) => onChange(node.id, { ...data, ad_end_at: fromDateTimeLocal(e.target.value) })} />
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">On Meta now: {fmt(selectedAdSet.start_at)} → {selectedAdSet.end_at ? fmt(selectedAdSet.end_at) : "no end"}</p>
                    {mode !== "none" && (plan.start || plan.end) && plan.errors.length === 0 && (
                      <p className="text-[11px]">Will set: {plan.start ? fmt(plan.start) : "start unchanged"} → {plan.end ? fmt(plan.end) : "end unchanged"}</p>
                    )}
                    {plan.errors.map((m) => <p key={m} className="text-[11px] text-destructive">{m}</p>)}
                    {plan.warnings.map((m) => <p key={m} className="text-[11px] text-amber-700">{m}</p>)}
                    {others.length > 0 && (
                      <p className="text-[11px] rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-800">
                        This ad set is also used by: {others.join(", ")}. Changing its dates or pausing it affects those journeys too.
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">Pausing this journey also pauses this ad set on Meta; resuming the journey resumes it (only if the journey paused it).</p>
                    {link?.applied_at && !link.last_error && (
                      <p className="text-[11px] text-green-700">Applied {fmt(link.applied_at)}: {link.applied_start_at ? fmt(link.applied_start_at) : "start unchanged"} → {link.applied_end_at ? fmt(link.applied_end_at) : "end unchanged"}</p>
                    )}
                    {link?.last_error && <p className="text-[11px] text-destructive">Meta: {link.last_error}</p>}
                    {isLinked && mode !== "none" && onApplyMetaSchedule && (
                      <Button size="sm" variant="outline" className="w-full" disabled={applyingMetaSchedule || plan.errors.length > 0}
                        onClick={() => onApplyMetaSchedule(node.id)}>
                        {applyingMetaSchedule ? "Applying..." : "Save and apply to Meta now"}
                      </Button>
                    )}
                    {!isLinked && mode !== "none" && (
                      <p className="text-[11px] text-muted-foreground">The schedule is applied to Meta when you publish the journey.</p>
                    )}
                  </div>
                );
              })()}
              {selectedAdSet && (
                isLinked ? (
                  <p className="text-[11px] rounded-md border bg-muted/40 px-2.5 py-2 text-muted-foreground">
                    Already linked — this ad set's audience is live and growing for this journey; re-activating won't replace it again.
                  </p>
                ) : (
                  <label className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-[11px]">
                    <Checkbox
                      className="mt-0.5"
                      checked={!!data.audience_replace_confirmed}
                      onCheckedChange={(checked) => onChange(node.id, { ...data, audience_replace_confirmed: !!checked })}
                    />
                    <span>
                      {selectedAdSet.custom_audience_name
                        ? <>This will replace "{selectedAdSet.custom_audience_name}" ({selectedAdSet.custom_audience_row_count ?? 0} contacts) currently on this ad set with contacts from this journey as they arrive.</>
                        : <>This will replace this ad set's current Custom Audience with contacts from this journey as they arrive.</>}
                      {" "}I understand and want to proceed.
                    </span>
                  </label>
                )
              )}
            </div>
          );
        })()}

        {node.type === "delay" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Duration</Label>
              <Input
                type="number" min={0} className="h-9"
                value={(data.duration as number) ?? 0}
                onChange={(e) => onChange(node.id, { ...data, duration: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Unit</Label>
              <Select value={(data.unit as string) || "hours"} onValueChange={(v) => onChange(node.id, { ...data, unit: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {node.type === "decision" && (
          <p className="text-xs text-muted-foreground">
            Branches on whether the most recent WhatsApp message to this retailer sent successfully. Connect the "Yes" handle (right) and "No" handle (left) to different next steps.
          </p>
        )}

        {node.type === "message_response" && (() => {
          const templateOptions = nodes.filter(isTemplateStep);
          const targetId = data.target_node_id as string | undefined;
          const targetExists = !!targetId && nodes.some((n) => n.id === targetId);
          const condition = (data.condition as string) || "read";
          const waitValue = Number(data.wait_value ?? 0);
          const waitUnit = (data.wait_unit as string) || "hours";
          const showEarlyExit = ["read", "delivered", "replied"].includes(condition);
          const counts = liveCounts?.[node.id];
          return (
            <div className="space-y-3">
              {templateOptions.length === 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  Add a WhatsApp Message node before this one so there's something to evaluate.
                </p>
              )}
              {targetId && !targetExists && (
                <p className="text-[11px] text-destructive">Referenced message node no longer exists — please reselect.</p>
              )}
              <div>
                <Label className="text-xs">Evaluate Message</Label>
                <Select
                  value={targetExists ? targetId : ""}
                  onValueChange={(v) => {
                    const targetNode = nodes.find((n) => n.id === v);
                    onChange(node.id, { ...data, target_node_id: v, target_node_label: targetNode ? templateLabel(targetNode) : undefined });
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select a message node" /></SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((n) => (
                      <SelectItem key={n.id} value={n.id}>{templateLabel(n)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Only upstream WhatsApp Message nodes are eligible.</p>
              </div>

              <div>
                <Label className="text-xs">Condition</Label>
                <Select value={condition} onValueChange={(v) => onChange(node.id, { ...data, condition: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Wait Period</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {WAIT_PRESETS.map((p) => (
                    <Button
                      key={p.label} type="button" size="sm" variant="outline" className="h-7 text-[11px] px-2"
                      onClick={() => onChange(node.id, { ...data, wait_value: p.value, wait_unit: p.unit })}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input
                    type="number" min={0} className="h-9"
                    value={waitValue}
                    onChange={(e) => onChange(node.id, { ...data, wait_value: Number(e.target.value) || 0 })}
                  />
                  <Select value={waitUnit} onValueChange={(v) => onChange(node.id, { ...data, wait_unit: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">The journey waits this long after the message is sent before evaluating the condition.</p>
              </div>

              {showEarlyExit && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="early-exit" checked={!!data.early_exit}
                    onCheckedChange={(checked) => onChange(node.id, { ...data, early_exit: !!checked })}
                  />
                  <Label htmlFor="early-exit" className="text-[11px] font-normal text-muted-foreground leading-tight">
                    Keep checking until the wait ends — contacts move to Yes as soon as it happens; the rest move to No when the wait ends.
                  </Label>
                </div>
              )}

              {counts && (
                <p className="text-[11px] text-muted-foreground">Live: <span className="text-green-600 font-medium">{counts.yes} Yes</span> · <span className="text-red-600 font-medium">{counts.no} No</span></p>
              )}
            </div>
          );
        })()}

        {node.type === "exit" && (
          <p className="text-xs text-muted-foreground">Ends the journey for retailers who reach this node.</p>
        )}
      </div>

      {canDelete && (
        <div className="pt-3 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Node
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="capitalize">Delete {node.type === "message_response" ? "Message Response" : node.type} node?</AlertDialogTitle>
                <AlertDialogDescription>This removes the node and any connections to/from it. This can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(node.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
