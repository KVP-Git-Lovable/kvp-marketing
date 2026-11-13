import { Handle, Position, useStore, type NodeProps } from "@xyflow/react";
import { isMarketingSegment } from "@/lib/marketingSegments";
import { UserPlus, MessageSquare, Clock, GitBranch, Flag, MessageCircle, Eye, Megaphone } from "lucide-react";

const CONDITION_LABELS: Record<string, string> = {
  delivered: "Delivered",
  not_delivered: "Not Delivered",
  read: "Read",
  not_read: "Not Read",
  replied: "Replied",
  not_replied: "Not Replied",
  failed: "Failed",
  undelivered: "Undelivered",
};

const base = "rounded-lg border-2 bg-card shadow-sm px-3 py-2 min-w-[160px] text-xs";

export function EntryNode({ data, selected }: NodeProps) {
  const d = data as {
    category?: string; territory_id?: string; beat_id?: string;
    segment_type?: string; list_view_name?: string; audience_count?: number;
    onPreviewAudience?: () => void;
  };
  const isMarketing = isMarketingSegment(d.segment_type);
  const audience = isMarketing
    ? (d.list_view_name || "List View")
    : d.category && d.category !== "any" ? `Category ${d.category}` : "All retailers";
  return (
    <div className={`${base} border-emerald-400 ${selected ? "ring-2 ring-emerald-400" : ""}`}>
      <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
        <UserPlus className="h-3.5 w-3.5" /> Entry
      </div>
      <p className="text-muted-foreground mt-1">{audience}</p>
      {isMarketing && (
        <>
          <p className="font-semibold mt-0.5">{(d.audience_count ?? "…").toLocaleString?.() ?? d.audience_count} contacts</p>
          <button
            type="button"
            className="flex items-center gap-1 text-primary mt-1.5 hover:underline"
            onClick={(e) => { e.stopPropagation(); d.onPreviewAudience?.(); }}
          >
            <Eye className="h-3 w-3" /> Preview Audience
          </button>
        </>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  const d = data as { template_name?: string };
  return (
    <div className={`${base} border-blue-400 ${selected ? "ring-2 ring-blue-400" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400">
        <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Message
      </div>
      <p className="text-muted-foreground mt-1 truncate">{d.template_name || "No template selected"}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as { duration?: number; unit?: string };
  return (
    <div className={`${base} border-amber-400 ${selected ? "ring-2 ring-amber-400" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
        <Clock className="h-3.5 w-3.5" /> Delay
      </div>
      <p className="text-muted-foreground mt-1">Wait {d.duration ?? 0} {d.unit || "hours"}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function DecisionNode({ selected }: NodeProps) {
  return (
    <div className={`${base} border-purple-400 ${selected ? "ring-2 ring-purple-400" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-purple-700 dark:text-purple-400">
        <GitBranch className="h-3.5 w-3.5" /> Message Sent OK?
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
        <span>No</span><span>Yes</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: "25%" }} />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "75%" }} />
    </div>
  );
}

export function MessageResponseNode({ id, data, selected }: NodeProps) {
  const d = data as {
    target_node_label?: string; condition?: string;
    wait_value?: number; wait_unit?: string;
    live?: { yes: number; no: number } | null;
  };
  const connected = useStore((s) => {
    let yes = false, no = false;
    for (const e of s.edges) {
      if (e.source !== id) continue;
      if (e.sourceHandle === "yes") yes = true;
      else if (e.sourceHandle === "no") no = true;
    }
    return { yes, no };
  });
  const condition = CONDITION_LABELS[d.condition || "read"] || "Read";
  const waitValue = Number(d.wait_value ?? 0);
  const waitUnit = d.wait_unit || "hours";
  const waitText = waitValue === 0 ? "Immediately" : `Wait ${waitValue} ${waitUnit}`;
  const live = d.live;
  return (
    <div className={`rounded-lg border-2 bg-card shadow-sm px-3 py-2 min-w-[200px] text-xs ${selected ? "ring-2 ring-teal-400 border-teal-400" : "border-teal-400"}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-teal-700 dark:text-teal-400">
        <MessageCircle className="h-3.5 w-3.5" /> Message Response
      </div>
      <p className="text-muted-foreground mt-1 truncate">{d.target_node_label || "No target selected"}</p>
      <p className="text-muted-foreground mt-0.5">If <span className="font-medium">{condition}</span> · {waitText}</p>
      <div className="flex justify-between mt-1.5 text-[10px]">
        <span className="text-red-600 font-medium inline-flex items-center gap-1" title={connected.no ? undefined : "Not connected — contacts finish here"}>
          {!connected.no && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
          No{live && <span className="rounded bg-red-100 px-1 text-red-700">{live.no}</span>}
        </span>
        <span className="text-green-600 font-medium inline-flex items-center gap-1" title={connected.yes ? undefined : "Not connected — contacts finish here"}>
          Yes{live && <span className="rounded bg-green-100 px-1 text-green-700">{live.yes}</span>}
          {!connected.yes && <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: "25%" }} className="!bg-red-500" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "75%" }} className="!bg-green-500" />
    </div>
  );
}

export function MetaAdNode({ data, selected }: NodeProps) {
  const d = data as {
    ad_set_row_id?: string; ad_set_name?: string; campaign_name?: string; pushed_count?: number; audience_replace_confirmed?: boolean;
    schedule_mode?: string; ad_start_at?: string | null; ad_end_at?: string | null;
    link_applied_at?: string | null; link_error?: string | null; link_paused?: boolean;
  };
  const shortDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "…");
  const needsConfirmation = !!d.ad_set_row_id && typeof d.pushed_count !== "number" && !d.audience_replace_confirmed;
  return (
    <div className={`${base} border-indigo-400 ${selected ? "ring-2 ring-indigo-400" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-400">
        <Megaphone className="h-3.5 w-3.5" /> Meta Ad
      </div>
      <p className="text-muted-foreground mt-1 truncate">{d.ad_set_name || "No ad set selected"}</p>
      {d.campaign_name && <p className="text-muted-foreground text-[10px] truncate">{d.campaign_name}</p>}
      {typeof d.pushed_count === "number" && (
        <p className="font-semibold mt-0.5">{d.pushed_count.toLocaleString()} pushed to audience</p>
      )}
      {d.schedule_mode === "follow_journey" && <p className="text-[10px] text-muted-foreground">Dates: follows journey</p>}
      {d.schedule_mode === "custom" && <p className="text-[10px] text-muted-foreground">Dates: {shortDate(d.ad_start_at)} → {shortDate(d.ad_end_at)}</p>}
      {d.link_error ? <p className="text-destructive text-[10px] truncate" title={d.link_error}>⚠ Meta: {d.link_error}</p>
        : d.link_applied_at ? <p className="text-green-700 text-[10px]">✓ Schedule applied</p> : null}
      {d.link_paused && <p className="text-amber-700 text-[10px]">Ad set paused with journey</p>}
      {needsConfirmation && <p className="text-destructive font-medium mt-0.5">⚠ Needs confirmation before activating</p>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function ExitNode({ selected }: NodeProps) {
  return (
    <div className={`${base} border-slate-400 ${selected ? "ring-2 ring-slate-400" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
        <Flag className="h-3.5 w-3.5" /> Exit
      </div>
    </div>
  );
}

export const journeyNodeTypes = {
  entry: EntryNode,
  message: MessageNode,
  delay: DelayNode,
  decision: DecisionNode,
  message_response: MessageResponseNode,
  meta_ad: MetaAdNode,
  exit: ExitNode,
};
