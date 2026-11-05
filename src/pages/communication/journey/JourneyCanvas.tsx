import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Panel, addEdge,
  useNodesState, useEdgesState, type Node, type Edge, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Users, MessageCircleMore, Clock, GitBranch, MessageCircle, Tag, LogOut,
  Save, Play, Pause, BarChart3, Pencil, Megaphone, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { journeyNodeTypes } from "@/components/journey/JourneyNodes";
import { NodePropertyPanel } from "@/components/journey/NodePropertyPanel";
import { JourneySettingsPanel } from "@/components/journey/JourneySettingsPanel";
import { JourneyAnalyticsPanel } from "@/components/journey/JourneyAnalyticsPanel";
import { EditJourneyDetailsDialog } from "@/components/journey/EditJourneyDetailsDialog";
import { JourneyAudiencePreviewDialog } from "@/components/journey/JourneyAudiencePreviewDialog";
import { useMessageResponseLiveCounts } from "@/hooks/useMessageResponseLiveCounts";

const MARKETING_SEGMENT_TYPES = new Set(["marketing_institutional", "marketing_distributor"]);

interface WhatsAppTemplate { id: string; name: string; body?: string }
interface MetaAdSetOption { id: string; name: string; campaign_name?: string; custom_audience_name?: string; custom_audience_row_count?: number }
interface JourneyDetail {
  id: string; name: string; status: string;
  segment_type: string;
  filters: { category?: string; territory_id?: string; beat_id?: string; list_view_id?: string };
  canvas_data: { nodes?: Node[]; edges?: Edge[]; steps?: unknown[] };
  approval_status: string;
  approval_notes: string | null;
  objective?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  budget_cap?: number | null;
  description?: string | null;
  schedule: { id: string; schedule_type: string; start_at: string; recurrence_rule: string | null; next_run_at: string | null } | null;
  excluded_contacts: Array<{ id: string; retailer_id: string; reason: string | null; excluded_at: string; retailers: { name: string; phone: string } | null }>;
  cost_settings: { whatsapp_cost_per_message: number } | null;
  sent_message_count: number;
  enrolled_count: number;
  completed_count: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  archived: "bg-muted text-muted-foreground",
};

// Exit is available from the toolbar but not auto-added here — an Entry
// node with no outgoing edge is already handled as a safe dead end by
// both journey-actions (publish) and process-journeys (sweep), so a new
// journey starts as just Entry and the author adds Exit only if/when needed.
export const defaultScaffold = (): { nodes: Node[]; edges: Edge[] } => ({
  nodes: [
    { id: "entry-1", type: "entry", position: { x: 250, y: 0 }, data: { category: "any" } },
  ],
  edges: [],
});

let idCounter = 1;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idCounter++}`;

export default function JourneyCanvas({ journeyId, onBack, initialTab }: { journeyId: string; onBack: () => void; initialTab?: string }) {
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "canvas");
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [audiencePreviewOpen, setAudiencePreviewOpen] = useState(false);

  const invoke = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Request failed");
    return json;
  };

  const { data: journey } = useQuery({
    queryKey: ["journey-detail", journeyId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/journey-actions?id=${journeyId}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load journey");
      return res.json() as Promise<JourneyDetail>;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates-for-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_templates").select("id, name, body").eq("status", "approved").ilike("name", "kvp_%").order("name");
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
  });

  const { data: adSets = [] } = useQuery({
    queryKey: ["meta-ad-sets-for-journeys"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-api", { body: { action: "ad_sets_list" } });
      if (error) throw error;
      // Only ad sets with a Custom Audience already attached — the raw synced list includes
      // every ad set on the connected account, which can be large and carry naming that has
      // nothing to do with audience targeting; requiring one already attached (set up from
      // Meta → Advertisements → Ad Sets) keeps this picker to ones meant for this.
      return (data || [])
        .filter((a: any) => !!a.custom_audience_row_id)
        .map((a: any) => ({
          id: a.id, name: a.name, campaign_name: a.meta_campaigns?.name,
          custom_audience_name: a.meta_custom_audiences?.name, custom_audience_row_count: a.meta_custom_audiences?.row_count,
        })) as MetaAdSetOption[];
    },
  });

  const isMarketingJourney = !!journey && MARKETING_SEGMENT_TYPES.has(journey.segment_type);
  const listViewId = journey?.filters?.list_view_id;

  const { data: listViewMeta } = useQuery({
    queryKey: ["journey-canvas-list-view-meta", listViewId],
    queryFn: async () => {
      const { data, error } = await supabase.from("marketing_contact_list_views").select("name").eq("id", listViewId).single();
      if (error) throw error;
      return data as { name: string };
    },
    enabled: isMarketingJourney && !!listViewId,
  });

  const { data: audienceCount } = useQuery({
    queryKey: ["journey-canvas-audience-count", listViewId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-list-view-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ list_view_id: listViewId, mode: "count" }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load audience count");
      return json.count as number;
    },
    enabled: isMarketingJourney && !!listViewId,
  });

  useEffect(() => {
    if (!journey || loaded) return;
    const cd = journey.canvas_data || {};
    if (cd.nodes && cd.nodes.length > 0) {
      setNodes(cd.nodes);
      setEdges(cd.edges || []);
    } else {
      const scaffold = defaultScaffold();
      setNodes(scaffold.nodes);
      setEdges(scaffold.edges);
    }
    setLoaded(true);
  }, [journey, loaded, setNodes, setEdges]);

  const { data: liveCounts } = useMessageResponseLiveCounts(journeyId, nodes, edges);

  const { data: metaAdPushedCounts } = useQuery({
    queryKey: ["journey-meta-ad-links", journeyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("journey_meta_ad_links").select("node_id, pushed_count").eq("journey_id", journeyId);
      if (error) throw error;
      return Object.fromEntries((data || []).map((r) => [r.node_id, r.pushed_count])) as Record<string, number>;
    },
    enabled: !!journeyId,
  });
  const metaAdLinkedNodeIds = new Set(Object.keys(metaAdPushedCounts || {}));

  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  const addNode = (type: "message" | "delay" | "decision" | "message_response" | "meta_ad" | "exit") => {
    const defaults: Record<string, Record<string, unknown>> = {
      message: { template_id: "" },
      delay: { duration: 1, unit: "hours" },
      decision: { condition: "sent_ok" },
      message_response: { condition: "read", wait_value: 1, wait_unit: "hours" },
      meta_ad: { ad_set_row_id: "", audience_replace_confirmed: false },
      exit: {},
    };
    const maxY = nodes.reduce((m, n) => Math.max(m, n.position.y), 0);
    const newNode: Node = { id: nextId(type), type, position: { x: 250 + (nodes.length % 3) * 40, y: maxY + 140 }, data: defaults[type] };
    setNodes((ns) => [...ns, newNode]);
  };

  const updateNodeData = (id: string, data: Record<string, unknown>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data } : n)));

  const deleteNode = (id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
  };

  const saveMutation = useMutation({
    mutationFn: () => invoke({ action: "update", journey_id: journeyId, nodes, edges }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
      toast.success("Journey saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => invoke({ action: "publish", journey_id: journeyId }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
      toast.success(data.scheduled && data.start_date
        ? `Campaign scheduled to start ${new Date(data.start_date).toLocaleString()}`
        : `Journey published — ${data.newly_enrolled} retailer(s) enrolled`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revertToDraftMutation = useMutation({
    mutationFn: () => invoke({ action: "revert-to-draft", journey_id: journeyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
      toast.success("Campaign moved back to draft");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pauseMutation = useMutation({
    mutationFn: () => invoke({ action: "pause", journey_id: journeyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journeys"] });
      queryClient.invalidateQueries({ queryKey: ["journey-detail", journeyId] });
      toast.success("Journey paused");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renderedNodes = nodes.map((n) => {
    if (n.type === "message_response" && liveCounts?.[n.id]) {
      return { ...n, data: { ...n.data, live: liveCounts[n.id] } };
    }
    if (n.type === "meta_ad" && typeof metaAdPushedCounts?.[n.id] === "number") {
      return { ...n, data: { ...n.data, pushed_count: metaAdPushedCounts[n.id] } };
    }
    if (n.type === "entry" && isMarketingJourney) {
      return {
        ...n,
        data: {
          ...n.data,
          segment_type: journey?.segment_type,
          list_view_name: listViewMeta?.name,
          audience_count: audienceCount,
          onPreviewAudience: () => setAudiencePreviewOpen(true),
        },
      };
    }
    return n;
  });
  const selectedNode = renderedNodes.find((n) => n.id === selectedId) || null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <p className="text-sm font-semibold">{journey?.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {journey?.status && <Badge className={`capitalize ${statusColors[journey.status] || statusColors.draft}`}>{journey.status}</Badge>}
              {journey?.filters?.category && journey.filters.category !== "any" && (
                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Category {journey.filters.category}</Badge>
              )}
              {isMarketingJourney && listViewMeta && (
                <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> {listViewMeta.name}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setActiveTab("analytics")}>
            <BarChart3 className="h-4 w-4 mr-1.5" /> Analytics
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditDetailsOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" /> Edit Journey
          </Button>
          <Button variant="outline" size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1.5" /> {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
          {journey?.status === "active" ? (
            <Button size="sm" variant="secondary" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending}>
              <Pause className="h-4 w-4 mr-1.5" /> Pause
            </Button>
          ) : journey?.status === "scheduled" ? (
            <Button size="sm" variant="secondary" onClick={() => revertToDraftMutation.mutate()} disabled={revertToDraftMutation.isPending}>
              <Undo2 className="h-4 w-4 mr-1.5" /> Scheduled — back to draft
            </Button>
          ) : (
            <Button size="sm" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {journey?.start_date && new Date(journey.start_date).getTime() > Date.now()
                ? <Clock className="h-4 w-4 mr-1.5" />
                : <Play className="h-4 w-4 mr-1.5" />} {journey?.start_date && new Date(journey.start_date).getTime() > Date.now() ? "Schedule" : journey?.status === "paused" ? "Resume" : "Activate"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="canvas">Canvas</TabsTrigger>
          <TabsTrigger value="settings">Approval, Schedule &amp; Exclusions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="space-y-3">
          <div className="flex h-[32rem] rounded-md border overflow-hidden">
            <div className="flex-1 relative">
              <ReactFlow
                nodes={renderedNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                onPaneClick={() => setSelectedId(null)}
                nodeTypes={journeyNodeTypes}
                fitView
              >
                <Background />
                <Controls />
                <MiniMap pannable zoomable className="hidden md:block" />
                <Panel position="top-left">
                  <div className="flex gap-1 bg-background border rounded-lg p-1 shadow-sm">
                    <Button variant="ghost" size="sm" disabled title="Already on the canvas — every journey has exactly one Entry node">
                      <Users className="h-4 w-4 mr-1" /> Entry
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("message")} title="Message Node">
                      <MessageCircleMore className="h-4 w-4 mr-1" /> Message
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("delay")} title="Delay Node">
                      <Clock className="h-4 w-4 mr-1" /> Delay
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("decision")} title="Decision Node">
                      <GitBranch className="h-4 w-4 mr-1" /> Decision
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("message_response")} title="Message Response Node">
                      <MessageCircle className="h-4 w-4 mr-1" /> Message Response
                    </Button>
                    <Button variant="ghost" size="sm" disabled title="Coming soon — no Mailchimp integration yet">
                      <Tag className="h-4 w-4 mr-1" /> Mailchimp Tag
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("meta_ad")} title="Meta Ad Node">
                      <Megaphone className="h-4 w-4 mr-1" /> Meta Ad
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => addNode("exit")} title="Exit Node">
                      <LogOut className="h-4 w-4 mr-1" /> Exit
                    </Button>
                  </div>
                </Panel>
              </ReactFlow>
            </div>
            {selectedNode && (
              <NodePropertyPanel
                node={selectedNode}
                templates={templates}
                adSets={adSets}
                metaAdLinkedNodeIds={metaAdLinkedNodeIds}
                nodes={nodes}
                edges={edges}
                liveCounts={liveCounts}
                onChange={updateNodeData}
                onDelete={deleteNode}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">Drag from a node's bottom handle to another node's top handle to connect steps. Decision and Message Response nodes have two outputs (No on the left, Yes on the right).</p>
        </TabsContent>

        <TabsContent value="settings">
          {journey && <JourneySettingsPanel journeyId={journeyId} journey={journey} />}
        </TabsContent>

        <TabsContent value="analytics">
          {journey && (
            <JourneyAnalyticsPanel
              journeyId={journeyId}
              canvasData={journey.canvas_data as unknown as React.ComponentProps<typeof JourneyAnalyticsPanel>["canvasData"]}
              enrolledCount={journey.enrolled_count}
              completedCount={journey.completed_count}
            />
          )}
        </TabsContent>
      </Tabs>

      {journey && (
        <EditJourneyDetailsDialog
          open={editDetailsOpen}
          onOpenChange={setEditDetailsOpen}
          journeyId={journeyId}
          currentName={journey.name}
          currentSegmentType={journey.segment_type || "retailers"}
          currentListViewId={journey.filters?.list_view_id || ""}
          currentCategory={journey.filters?.category || "any"}
          currentObjective={journey.objective}
          currentStartDate={journey.start_date}
          currentEndDate={journey.end_date}
          currentBudgetCap={journey.budget_cap}
          currentDescription={journey.description}
        />
      )}
      {isMarketingJourney && listViewId && (
        <JourneyAudiencePreviewDialog
          open={audiencePreviewOpen}
          onOpenChange={setAudiencePreviewOpen}
          listViewId={listViewId}
          listViewName={listViewMeta?.name}
        />
      )}
    </div>
  );
}
